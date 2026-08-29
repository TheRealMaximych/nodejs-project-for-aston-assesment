import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entities/user";
import { config } from "./env";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: config.databaseUrl,
  synchronize: false,
  migrationsRun: false,
  entities: [User],
  migrations: ["migrations/*.ts"],
});
