import "reflect-metadata";
import { AppDataSource } from "./config/data-source";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { app } from "./http/app";

async function main(): Promise<void> {
  try {
    await AppDataSource.initialize();
  } catch {
    logger.error("Database connection failed");
    process.exit(1);
  }

  app.listen(config.port);
}

void main();
