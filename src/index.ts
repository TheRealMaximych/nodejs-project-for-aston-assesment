import "reflect-metadata";
import { AppDataSource } from "./config/data-source";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { app } from "./http/app";

function databaseFailureFields(error: unknown): { errName: string; code?: string } {
  const errName = error instanceof Error ? error.name : "Error";
  if (typeof error !== "object" || error === null) {
    return { errName };
  }

  const record = error as { code?: unknown; driverError?: { code?: unknown } };
  if (typeof record.code === "string") {
    return { errName, code: record.code };
  }

  if (typeof record.driverError?.code === "string") {
    return { errName, code: record.driverError.code };
  }

  return { errName };
}

async function main(): Promise<void> {
  try {
    await AppDataSource.initialize();
  } catch (error) {
    logger.error(databaseFailureFields(error), "Database connection failed");
    process.exit(1);
  }

  app.listen(config.port, () => {
    logger.info(`API listening on port ${config.port}`);
  });
}

void main();
