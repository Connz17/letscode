import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, test } from "node:test";
import type { Server } from "node:http";
import { createApp } from "../app.js";
import { createDatabase } from "../database.js";

let server: Server;
let database: ReturnType<typeof createDatabase>;
let baseUrl: string;

beforeEach(async () => {
  database = createDatabase(":memory:");
  server = createApp(database).listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  server.close();
  await once(server, "close");
  database.close();
});

test("ingests sales and inclusive tax payments for a tax position", async () => {
  const saleResponse = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventType: "SALES",
      date: "2024-02-22T17:29:39Z",
      invoiceId: "invoice-1",
      items: [{ itemId: "item-1", cost: 1000, taxRate: 0.2 }],
    }),
  });
  assert.equal(saleResponse.status, 202);

  const paymentResponse = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventType: "TAX_PAYMENT", date: "2024-02-22T17:29:39Z", amount: 50 }),
  });
  assert.equal(paymentResponse.status, 202);

  const positionResponse = await fetch(
    `${baseUrl}/tax-position?date=${encodeURIComponent("2024-02-22T17:29:39Z")}`,
  );
  assert.equal(positionResponse.status, 200);
  assert.deepEqual(await positionResponse.json(), {
    date: "2024-02-22T17:29:39.000Z",
    taxPosition: 150,
  });
});

test("applies an amendment received before its sale event", async () => {
  const amendmentResponse = await fetch(`${baseUrl}/sale`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      date: "2024-02-22T17:30:00Z",
      invoiceId: "invoice-1",
      itemId: "item-1",
      cost: 500,
      taxRate: 0.1,
    }),
  });
  assert.equal(amendmentResponse.status, 202);

  const saleResponse = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventType: "SALES",
      date: "2024-02-22T17:29:39Z",
      invoiceId: "invoice-1",
      items: [{ itemId: "item-1", cost: 1000, taxRate: 0.2 }],
    }),
  });
  assert.equal(saleResponse.status, 202);

  const positionResponse = await fetch(
    `${baseUrl}/tax-position?date=${encodeURIComponent("2024-02-22T17:31:00Z")}`,
  );
  assert.deepEqual(await positionResponse.json(), {
    date: "2024-02-22T17:31:00.000Z",
    taxPosition: 50,
  });
});

test("rejects invalid dates with a problem details response", async () => {
  const response = await fetch(`${baseUrl}/tax-position?date=not-a-date`);
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("content-type")?.split(";")[0], "application/problem+json");
});