import express, { type Express } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createControllers, errorHandler } from "./controllers.js";
import { createDatabase } from "./database.js";
import { TaxService } from "./services.js";

export function createApp(database: DatabaseSync = createDatabase()): Express {
  const app = express();
  app.use(express.json());
  app.use(createControllers(new TaxService(database)));
  app.use(errorHandler);
  return app;
}