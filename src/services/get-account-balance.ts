import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";

export type AccountBalance = {
  balance: string;
};

export type GetAccountBalanceDeps = {
  accounts: {
    findById: (id: string) => Promise<{
      id: string;
      accountHolder: string;
      balance: string;
      currency: string;
      userId: string;
    } | null>;
  };
};

const accountIdSchema = z.uuid();

async function loadDefaultDeps(): Promise<GetAccountBalanceDeps> {
  const { bankAccountRepository } = await import(
    "../repositories/bank-account-repository.js"
  );

  return {
    accounts: bankAccountRepository,
  };
}

export async function getAccountBalance(
  input: { userId: string; accountId: unknown },
  deps?: GetAccountBalanceDeps,
): Promise<AccountBalance> {
  const parsed = accountIdSchema.safeParse(input.accountId);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const { accounts } = deps ?? (await loadDefaultDeps());
  const account = await accounts.findById(parsed.data);

  if (!account) {
    throw new NotFoundError();
  }

  if (account.userId !== input.userId) {
    throw new ForbiddenError();
  }

  return { balance: account.balance };
}
