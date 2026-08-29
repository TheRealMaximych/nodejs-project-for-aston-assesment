import "reflect-metadata";
import type { QueryRunner } from "typeorm";
import { AppDataSource } from "../src/config/data-source";
import { logger } from "../src/config/logger";
import { BankAccount } from "../src/entities/bank-account";
import { User } from "../src/entities/user";
import { hashPassword } from "../src/services/password-hasher";

const DEMO_PASSWORD = "DemoPass12";

type DemoIdentity = {
  userId: string;
  email: string;
  accountId: string;
  accountHolder: string;
  currency: string;
  balance: string;
};

const ALICE: DemoIdentity = {
  userId: "11111111-1111-4111-a111-111111111111",
  email: "alice.demo@example.com",
  accountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  accountHolder: "Alice",
  currency: "USD",
  balance: "1000.00",
};

const BOB: DemoIdentity = {
  userId: "22222222-2222-4222-a222-222222222222",
  email: "bob.demo@example.com",
  accountId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  accountHolder: "Bob",
  currency: "USD",
  balance: "500.00",
};

class DemoEmailConflictError extends Error {
  constructor(email: string, existingUserId: string) {
    super(
      `Seed aborted: email=${email} already belongs to userId=${existingUserId}`,
    );
    this.name = "DemoEmailConflictError";
  }
}

async function upsertDemoUser(
  runner: QueryRunner,
  demo: DemoIdentity,
  passwordHash: string,
): Promise<void> {
  const users = runner.manager.getRepository(User);
  const byId = await users.findOne({ where: { id: demo.userId } });

  if (byId) {
    await users.update(
      { id: demo.userId },
      { email: demo.email, passwordHash },
    );
    return;
  }

  const byEmail = await users.findOne({ where: { email: demo.email } });
  if (byEmail) {
    throw new DemoEmailConflictError(demo.email, byEmail.id);
  }

  const created = users.create({
    id: demo.userId,
    email: demo.email,
    passwordHash,
    tokenVersion: 0,
  });
  await users.save(created);
}

async function upsertDemoAccount(
  runner: QueryRunner,
  demo: DemoIdentity,
): Promise<void> {
  const accounts = runner.manager.getRepository(BankAccount);
  const existing = await accounts.findOne({ where: { id: demo.accountId } });

  if (existing) {
    existing.userId = demo.userId;
    existing.accountHolder = demo.accountHolder;
    existing.currency = demo.currency;
    existing.balance = demo.balance;
    await accounts.save(existing);
    return;
  }

  const created = accounts.create({
    id: demo.accountId,
    userId: demo.userId,
    accountHolder: demo.accountHolder,
    currency: demo.currency,
    balance: demo.balance,
  });
  await accounts.save(created);
}

async function seedDemoData(): Promise<void> {
  const alicePasswordHash = await hashPassword(DEMO_PASSWORD);
  const bobPasswordHash = await hashPassword(DEMO_PASSWORD);

  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    await upsertDemoUser(runner, ALICE, alicePasswordHash);
    await upsertDemoUser(runner, BOB, bobPasswordHash);
    await upsertDemoAccount(runner, ALICE);
    await upsertDemoAccount(runner, BOB);
    await runner.commitTransaction();
  } catch (error) {
    if (runner.isTransactionActive) {
      await runner.rollbackTransaction();
    }
    throw error;
  } finally {
    await runner.release();
  }

  logger.info(`Seeded user: userId=${ALICE.userId} email=${ALICE.email}`);
  logger.info(`Seeded user: userId=${BOB.userId} email=${BOB.email}`);
  logger.info(
    `Seeded account: accountId=${ALICE.accountId}, userId=${ALICE.userId}`,
  );
  logger.info(
    `Seeded account: accountId=${BOB.accountId}, userId=${BOB.userId}`,
  );
}

async function main(): Promise<void> {
  try {
    await AppDataSource.initialize();
  } catch {
    logger.error("Database connection failed");
    process.exit(1);
  }

  try {
    await seedDemoData();
  } catch (error) {
    if (error instanceof DemoEmailConflictError) {
      logger.error(error.message);
    } else {
      logger.error("Seed failed");
    }
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void main();
