import "reflect-metadata";
import { DataSource } from "typeorm";
import { BankAccount } from "../entities/bank-account";
import { Transaction } from "../entities/transaction";
import { User } from "../entities/user";
import { config } from "./env";

function typeOrmCliMigrationGlobs(argv: string[] = process.argv): string[] {
  const runningTypeOrmCli = argv.some(
    (arg) => arg.includes("typeorm") && arg.toLowerCase().includes("cli"),
  );
  return runningTypeOrmCli ? ["migrations/*.ts"] : [];
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: config.databaseUrl,
  synchronize: false,
  migrationsRun: false,
  entities: [User, BankAccount, Transaction],
  migrations: typeOrmCliMigrationGlobs(),
});
