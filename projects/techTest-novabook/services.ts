import type { DatabaseSync } from "node:sqlite";
import {
  RequestValidationError,
  type AmendSaleDto,
  type SaleEventDto,
  type TaxPosition,
  type TransactionDto,
} from "./model.js";

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeDate(value: string): string {
  if (!ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new RequestValidationError("date must be a valid ISO 8601 date-time with a timezone");
  }

  return new Date(value).toISOString();
}

function validateMoney(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RequestValidationError(`${field} must be a non-negative number`);
  }
}

function validateTaxRate(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RequestValidationError("taxRate must be a number between 0 and 1");
  }
}

function validateIdentifier(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequestValidationError(`${field} must be a non-empty string`);
  }
}

export class TaxService {
  constructor(private readonly database: DatabaseSync) {}

  ingest(transaction: TransactionDto): void {
    const date = normalizeDate(transaction.date);

    if (transaction.eventType === "TAX_PAYMENT") {
      validateMoney(transaction.amount, "amount");
      this.database
        .prepare("INSERT INTO tax_payments (amount, effective_at) VALUES (?, ?)")
        .run(transaction.amount, date);
      return;
    }

    this.ingestSale({ ...transaction, date });
  }

  amendSale(amendment: AmendSaleDto): void {
    validateIdentifier(amendment.invoiceId, "invoiceId");
    validateIdentifier(amendment.itemId, "itemId");
    validateMoney(amendment.cost, "cost");
    validateTaxRate(amendment.taxRate);

    this.insertSaleItem(
      amendment.invoiceId,
      amendment.itemId,
      amendment.cost,
      amendment.taxRate,
      normalizeDate(amendment.date),
    );
  }

  getTaxPosition(asOf: string): TaxPosition {
    const date = normalizeDate(asOf);
    const sales = this.database.prepare(`
      WITH latest_items AS (
        SELECT cost, tax_rate,
          ROW_NUMBER() OVER (
            PARTITION BY invoice_id, item_id
            ORDER BY effective_at DESC, id DESC
          ) AS version
        FROM sale_item_events
        WHERE effective_at <= ?
      )
      SELECT COALESCE(SUM(cost * tax_rate), 0) AS amount
      FROM latest_items
      WHERE version = 1
    `).get(date) as { amount: number };

    const payments = this.database.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS amount
      FROM tax_payments
      WHERE effective_at <= ?
    `).get(date) as { amount: number };

    return { date, taxPosition: sales.amount - payments.amount };
  }

  private ingestSale(event: SaleEventDto): void {
    validateIdentifier(event.invoiceId, "invoiceId");
    if (!Array.isArray(event.items) || event.items.length === 0) {
      throw new RequestValidationError("items must be a non-empty array");
    }

    for (const item of event.items) {
      validateIdentifier(item.itemId, "itemId");
      validateMoney(item.cost, "cost");
      validateTaxRate(item.taxRate);
    }

    this.database.exec("BEGIN");
    try {
      for (const item of event.items) {
        this.insertSaleItem(event.invoiceId, item.itemId, item.cost, item.taxRate, event.date);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private insertSaleItem(
    invoiceId: string,
    itemId: string,
    cost: number,
    taxRate: number,
    effectiveAt: string,
  ): void {
    this.database
      .prepare(`
        INSERT INTO sale_item_events (invoice_id, item_id, cost, tax_rate, effective_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(invoiceId, itemId, cost, taxRate, effectiveAt);
  }
}