import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";

export type HistoryItem = {
  transactionId: string;
  fromAccount: string;
  toAccount: string;
  amount: string;
  timestamp: string;
  status: "Completed" | "Failed";
};

export type GetAccountHistoryDeps = {
  accounts: {
    findById: (id: string) => Promise<{
      id: string;
      accountHolder: string;
      balance: string;
      currency: string;
      userId: string;
    } | null>;
  };
  transactions: {
    listByAccountId: (accountId: string) => Promise<
      {
        id: string;
        fromAccount: string;
        toAccount: string;
        amount: string;
        timestamp: Date;
        status: "Completed" | "Failed";
      }[]
    >;
  };
};

const accountIdSchema = z.uuid();

async function loadDefaultDeps(): Promise<GetAccountHistoryDeps> {
  const { bankAccountRepository } = await import(
    "../repositories/bank-account-repository.js"
  );
  const { transactionRepository } = await import(
    "../repositories/transaction-repository.js"
  );

  return {
    accounts: bankAccountRepository,
    transactions: transactionRepository,
  };
}

export async function getAccountHistory(
  input: { userId: string; accountId: unknown },
  deps?: GetAccountHistoryDeps,
): Promise<HistoryItem[]> {
  const parsed = accountIdSchema.safeParse(input.accountId);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const { accounts, transactions } = deps ?? (await loadDefaultDeps());
  const account = await accounts.findById(parsed.data);

  if (!account) {
    throw new NotFoundError();
  }

  if (account.userId !== input.userId) {
    throw new ForbiddenError();
  }

  const rows = await transactions.listByAccountId(parsed.data);

  return rows.map((row) => ({
    transactionId: row.id,
    fromAccount: row.fromAccount,
    toAccount: row.toAccount,
    amount: row.amount,
    timestamp: row.timestamp.toISOString(),
    status: row.status,
  }));
}
