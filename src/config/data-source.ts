import "reflect-metadata";
import { DataSource } from "typeorm";
import { BankAccount } from "../entities/bank-account";
import { User } from "../entities/user";
import { config } from "./env";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: config.databaseUrl,
  synchronize: false,
  migrationsRun: false,
  entities: [User, BankAccount],
  migrations: ["migrations/*.ts"],
});
