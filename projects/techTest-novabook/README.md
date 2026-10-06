# Novabook Tax Position API

Requires Node.js 24 or newer (uses the built-in `node:sqlite` module).

## Run

```sh
npm install
npm start
```

The service listens on port `3000`. Set `PORT` to change the port, or
`SQLITE_DB_PATH` to change the SQLite file location. By default, data is stored
in `data/tax-position.sqlite` relative to the working directory.

## Endpoints

- `POST /transactions` accepts a `SALES` event or a `TAX_PAYMENT` event and
  responds with `202` and no body.
- `GET /tax-position?date=<ISO-8601-date-time>` returns the tax position at
  that time, including events effective at the requested time.
- `PATCH /sale` appends an item amendment and responds with `202` and no body.
  Amendments can be ingested before the corresponding sale event.

Costs, tax payments, and tax positions are expressed in pennies. Tax due is
calculated as `cost * taxRate` per item, less payments made by the requested
date. Invalid requests return `400` Problem Details JSON.

## Test

```sh
npm test
npm run build
```