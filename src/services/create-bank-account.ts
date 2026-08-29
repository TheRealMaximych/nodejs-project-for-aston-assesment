import { z } from "zod";
import { logger as appLogger } from "../config/logger";
import { ValidationError } from "../domain/errors";

export type PublicBankAccount = {
  id: string;
  accountHolder: string;
  balance: string;
  currency: string;
};

export type CreateBankAccountDeps = {
  accounts: {
    insert: (account: {
      accountHolder: string;
      currency: string;
      userId: string;
    }) => Promise<PublicBankAccount>;
  };
  logger: { info: (message: string) => void };
};

const createBankAccountSchema = z.object({
  accountHolder: z.string().trim().min(1).max(255),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
});

async function loadDefaultDeps(): Promise<CreateBankAccountDeps> {
  const { bankAccountRepository } = await import(
    "../repositories/bank-account-repository.js"
  );

  return {
    accounts: bankAccountRepository,
    logger: {
      info: (message: string) => {
        appLogger.info(message);
      },
    },
  };
}

export async function createBankAccount(
  userId: string,
  input: unknown,
  deps?: CreateBankAccountDeps,
): Promise<PublicBankAccount> {
  const { accounts, logger } = deps ?? (await loadDefaultDeps());

  const parsed = createBankAccountSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const { accountHolder, currency } = parsed.data;
  const account = await accounts.insert({ accountHolder, currency, userId });

  logger.info(`Account created: accountId=${account.id}, userId=${userId}`);

  return {
    id: account.id,
    accountHolder: account.accountHolder,
    balance: account.balance,
    currency: account.currency,
  };
}
