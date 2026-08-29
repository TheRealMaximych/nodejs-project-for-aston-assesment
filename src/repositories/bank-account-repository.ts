import { AppDataSource } from "../config/data-source";
import { BankAccount } from "../entities/bank-account";

const OPENING_BALANCE = "0.00";

export type PublicBankAccount = {
  id: string;
  accountHolder: string;
  balance: string;
  currency: string;
};

export type BankAccountRecord = {
  id: string;
  accountHolder: string;
  balance: string;
  currency: string;
  userId: string;
};

export type NewBankAccount = {
  accountHolder: string;
  currency: string;
  userId: string;
};

export type BankAccountRepository = {
  insert(account: NewBankAccount): Promise<PublicBankAccount>;
  findById(id: string): Promise<BankAccountRecord | null>;
};

function toPublicAccount(account: BankAccount): PublicBankAccount {
  return {
    id: account.id,
    accountHolder: account.accountHolder,
    balance: account.balance,
    currency: account.currency,
  };
}

async function insert(account: NewBankAccount): Promise<PublicBankAccount> {
  const repo = AppDataSource.getRepository(BankAccount);
  const created = repo.create({
    accountHolder: account.accountHolder,
    currency: account.currency,
    userId: account.userId,
    balance: OPENING_BALANCE,
  });
  const saved = await repo.save(created);
  return toPublicAccount(saved);
}

async function findById(id: string): Promise<BankAccountRecord | null> {
  const repo = AppDataSource.getRepository(BankAccount);
  const account = await repo.findOne({
    where: { id },
    select: {
      id: true,
      accountHolder: true,
      balance: true,
      currency: true,
      userId: true,
    },
  });

  if (!account) {
    return null;
  }

  return {
    id: account.id,
    accountHolder: account.accountHolder,
    balance: account.balance,
    currency: account.currency,
    userId: account.userId,
  };
}

export const bankAccountRepository: BankAccountRepository = {
  insert,
  findById,
};
