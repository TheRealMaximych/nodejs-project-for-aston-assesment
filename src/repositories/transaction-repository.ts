import { AppDataSource } from "../config/data-source";
import { Transaction, type TransactionStatus } from "../entities/transaction";

export type TransactionRecord = {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: string;
  timestamp: Date;
  status: TransactionStatus;
};

export type TransactionRepository = {
  listByAccountId(accountId: string): Promise<TransactionRecord[]>;
};

function toRecord(row: Transaction): TransactionRecord {
  return {
    id: row.id,
    fromAccount: row.fromAccount,
    toAccount: row.toAccount,
    amount: row.amount,
    timestamp: row.timestamp,
    status: row.status,
  };
}

async function listByAccountId(accountId: string): Promise<TransactionRecord[]> {
  const rows = await AppDataSource.getRepository(Transaction)
    .createQueryBuilder("transaction")
    .select([
      "transaction.id",
      "transaction.fromAccount",
      "transaction.toAccount",
      "transaction.amount",
      "transaction.timestamp",
      "transaction.status",
    ])
    .where("transaction.fromAccount = :id OR transaction.toAccount = :id", {
      id: accountId,
    })
    .orderBy("transaction.timestamp", "DESC")
    .addOrderBy("transaction.id", "DESC")
    .getMany();

  return rows.map(toRecord);
}

export const transactionRepository: TransactionRepository = {
  listByAccountId,
};
