import type { QueryRunner } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { BankAccount } from "../entities/bank-account";
import { Transaction } from "../entities/transaction";

export type BankAccountRecord = {
  id: string;
  accountHolder: string;
  balance: string;
  currency: string;
  userId: string;
};

export type TransferSession = {
  from: BankAccountRecord | null;
  to: BankAccountRecord | null;
  complete(amount: string): Promise<{ transactionId: string; status: "Completed" }>;
};

function toRecord(account: BankAccount): BankAccountRecord {
  return {
    id: account.id,
    accountHolder: account.accountHolder,
    balance: account.balance,
    currency: account.currency,
    userId: account.userId,
  };
}

function moneyToCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) {
    throw new TypeError("invalid decimal money string");
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = BigInt(match[2] ?? "0");
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0"));
  return sign * (whole * 100n + fraction);
}

function centsToMoney(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  return `${sign}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
}

function addMoney(left: string, right: string): string {
  return centsToMoney(moneyToCents(left) + moneyToCents(right));
}

function subtractMoney(left: string, right: string): string {
  return centsToMoney(moneyToCents(left) - moneyToCents(right));
}

async function lockAccount(
  runner: QueryRunner,
  id: string,
): Promise<BankAccount | null> {
  return runner.manager
    .getRepository(BankAccount)
    .createQueryBuilder("account")
    .setLock("pessimistic_write")
    .where("account.id = :id", { id })
    .getOne();
}

export async function withLockedAccounts<T>(
  fromAccountId: string,
  toAccountId: string,
  work: (session: TransferSession) => Promise<T>,
): Promise<T> {
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    const orderedIds = [...new Set([fromAccountId, toAccountId])].sort();
    const locked = new Map<string, BankAccount | null>();

    for (const id of orderedIds) {
      locked.set(id, await lockAccount(runner, id));
    }

    const fromEntity = locked.get(fromAccountId) ?? null;
    const toEntity = locked.get(toAccountId) ?? null;

    const session: TransferSession = {
      from: fromEntity ? toRecord(fromEntity) : null,
      to: toEntity ? toRecord(toEntity) : null,
      complete: async (amount: string) => {
        if (fromEntity === null || toEntity === null) {
          throw new Error("Cannot complete transfer with missing accounts");
        }

        fromEntity.balance = subtractMoney(fromEntity.balance, amount);
        toEntity.balance = addMoney(toEntity.balance, amount);

        await runner.manager.save(BankAccount, [fromEntity, toEntity]);

        const created = runner.manager.create(Transaction, {
          fromAccount: fromAccountId,
          toAccount: toAccountId,
          amount,
          status: "Completed",
        });
        const saved = await runner.manager.save(Transaction, created);

        return { transactionId: saved.id, status: "Completed" };
      },
    };

    const result = await work(session);
    await runner.commitTransaction();
    return result;
  } catch (error) {
    if (runner.isTransactionActive) {
      await runner.rollbackTransaction();
    }
    throw error;
  } finally {
    await runner.release();
  }
}
