import { Router, type ErrorRequestHandler, type Request, type Response, type NextFunction } from "express";
import { RequestValidationError, type AmendSaleDto, type SaleItemDto, type TransactionDto } from "./model.js";
import { TaxService } from "./services.js";

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RequestValidationError("request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequestValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RequestValidationError(`${field} must be a number`);
  }
  return value;
}

function parseTransaction(value: unknown): TransactionDto {
  const body = asObject(value);
  const date = requireString(body.date, "date");

  if (body.eventType === "TAX_PAYMENT") {
    return { eventType: "TAX_PAYMENT", date, amount: requireNumber(body.amount, "amount") };
  }

  if (body.eventType === "SALES") {
    if (!Array.isArray(body.items)) {
      throw new RequestValidationError("items must be an array");
    }

    const items: SaleItemDto[] = body.items.map((value) => {
      const item = asObject(value);
      return {
        itemId: requireString(item.itemId, "itemId"),
        cost: requireNumber(item.cost, "cost"),
        taxRate: requireNumber(item.taxRate, "taxRate"),
      };
    });

    return {
      eventType: "SALES",
      date,
      invoiceId: requireString(body.invoiceId, "invoiceId"),
      items,
    };
  }

  throw new RequestValidationError("eventType must be SALES or TAX_PAYMENT");
}

function parseAmendment(value: unknown): AmendSaleDto {
  const body = asObject(value);
  return {
    date: requireString(body.date, "date"),
    invoiceId: requireString(body.invoiceId, "invoiceId"),
    itemId: requireString(body.itemId, "itemId"),
    cost: requireNumber(body.cost, "cost"),
    taxRate: requireNumber(body.taxRate, "taxRate"),
  };
}

function handle(
  action: (request: Request, response: Response) => void,
): (request: Request, response: Response, next: NextFunction) => void {
  return (request, response, next) => {
    try {
      action(request, response);
    } catch (error) {
      next(error);
    }
  };
}

export function createControllers(service: TaxService): Router {
  const router = Router();

  router.post("/transactions", handle((request, response) => {
    service.ingest(parseTransaction(request.body));
    response.sendStatus(202);
  }));

  router.get("/tax-position", handle((request, response) => {
    const date = request.query.date;
    if (typeof date !== "string") {
      throw new RequestValidationError("date query parameter is required");
    }
    response.status(200).json(service.getTaxPosition(date));
  }));

  router.patch("/sale", handle((request, response) => {
    service.amendSale(parseAmendment(request.body));
    response.sendStatus(202);
  }));

  return router;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const malformedJson = error instanceof SyntaxError && "body" in error;
  const isValidationError = error instanceof RequestValidationError || malformedJson;
  const status = isValidationError ? 400 : 500;
  const detail = isValidationError
    ? (error instanceof Error ? error.message : "request body contains invalid JSON")
    : "An unexpected error occurred";

  response.status(status).type("application/problem+json").json({
    type: "about:blank",
    title: isValidationError ? "Bad Request" : "Internal Server Error",
    status,
    detail,
  });
};

