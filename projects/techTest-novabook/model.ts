export interface SaleItemDto {
  itemId: string;
  cost: number;
  taxRate: number;
}

export interface SaleEventDto {
  eventType: "SALES";
  date: string;
  invoiceId: string;
  items: SaleItemDto[];
}

export interface TaxPaymentEventDto {
  eventType: "TAX_PAYMENT";
  date: string;
  amount: number;
}

export type TransactionDto = SaleEventDto | TaxPaymentEventDto;

export interface AmendSaleDto {
  date: string;
  invoiceId: string;
  itemId: string;
  cost: number;
  taxRate: number;
}

export interface SaleItemRecord extends SaleItemDto {
  invoiceId: string;
  date: string;
}

export interface TaxPaymentRecord {
  date: string;
  amount: number;
}

export interface TaxPosition {
  date: string;
  taxPosition: number;
}

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}