import { z } from "zod";
import { logger as appLogger } from "../config/logger";
import {
  CurrencyMismatchError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  SameAccountTransferError,
  ValidationError,
} from "../domain/errors";

export type TransferResult = {
  transactionId: string;
  status: "Completed";
};

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
  complete(amount: string): Promise<TransferResult>;
};

export type TransferMoneyDeps = {
  withLockedAccounts: <T>(
    fromAccountId: string,
    toAccountId: string,
    work: (session: TransferSession) => Promise<T>,
  ) => Promise<T>;
  logger: { info: (message: string) => void };
};

const DECIMAL_AMOUNT = /^(?:0|[1-9]\d{0,17})(?:\.\d{1,2})?$/;

const transferMoneySchema = z.object({
  fromAccount: z.uuid(),
  toAccount: z.uuid(),
  amount: z.string().regex(DECIMAL_AMOUNT),
});

function normalizeAmount(amount: string): string {
  const [whole, fraction = ""] = amount.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function moneyToCents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole ?? "0") * 100n + BigInt(fraction.padEnd(2, "0"));
}

function failureReason(error: unknown): string | null {
  if (error instanceof InsufficientFundsError) {
    return "insufficient funds";
  }
  if (error instanceof CurrencyMismatchError) {
    return "currency mismatch";
  }
  if (error instanceof SameAccountTransferError) {
    return "same account";
  }
  if (error instanceof ForbiddenError) {
    return "forbidden";
  }
  if (error instanceof NotFoundError) {
    return "not found";
  }
  return null;
}

async function loadDefaultDeps(): Promise<TransferMoneyDeps> {
  const { withLockedAccounts } = await import("../repositories/transfer-repository.js");

  return {
    withLockedAccounts,
    logger: {
      info: (message: string) => {
        appLogger.info(message);
      },
    },
  };
}

function logFailure(
  logger: TransferMoneyDeps["logger"],
  fromAccount: string,
  error: unknown,
): void {
  const reason = failureReason(error);
  if (reason !== null) {
    logger.info(`Transfer failed: from=${fromAccount}, reason=${reason}`);
  }
}

export async function transferMoney(
  actorUserId: string,
  input: unknown,
  deps?: TransferMoneyDeps,
): Promise<TransferResult> {
  const parsed = transferMoneySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const { fromAccount, toAccount, amount } = parsed.data;
  const normalizedAmount = normalizeAmount(amount);

  if (moneyToCents(normalizedAmount) <= 0n) {
    throw new ValidationError("amount must be greater than zero");
  }

  const logger = deps?.logger ?? {
    info: (message: string) => {
      appLogger.info(message);
    },
  };

  if (fromAccount === toAccount) {
    const error = new SameAccountTransferError();
    logFailure(logger, fromAccount, error);
    throw error;
  }

  const { withLockedAccounts } = deps ?? (await loadDefaultDeps());

  try {
    const result = await withLockedAccounts(
      fromAccount,
      toAccount,
      async (session) => {
        if (session.from === null) {
          throw new NotFoundError();
        }

        if (session.from.userId !== actorUserId) {
          throw new ForbiddenError();
        }

        if (session.to === null) {
          throw new NotFoundError();
        }

        if (session.from.currency !== session.to.currency) {
          throw new CurrencyMismatchError();
        }

        if (moneyToCents(session.from.balance) < moneyToCents(normalizedAmount)) {
          throw new InsufficientFundsError();
        }

        return session.complete(normalizedAmount);
      },
    );

    logger.info(
      `Transfer completed: from=${fromAccount} to=${toAccount} amount=${normalizedAmount}`,
    );

    return { transactionId: result.transactionId, status: "Completed" };
  } catch (error) {
    logFailure(logger, fromAccount, error);
    throw error;
  }
}
