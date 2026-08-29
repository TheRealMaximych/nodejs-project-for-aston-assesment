import {
  ConflictError,
  CurrencyMismatchError,
  ForbiddenError,
  InsufficientFundsError,
  NotFoundError,
  SameAccountTransferError,
  UnauthorizedError,
  ValidationError,
} from "../domain/errors";

export type MappedDomainError = {
  error: string;
  statusCode: number;
};

export function mapDomainError(err: unknown): MappedDomainError | null {
  if (
    err instanceof ValidationError ||
    err instanceof InsufficientFundsError ||
    err instanceof CurrencyMismatchError ||
    err instanceof SameAccountTransferError
  ) {
    return { error: err.message, statusCode: 400 };
  }

  if (err instanceof UnauthorizedError) {
    return { error: err.message, statusCode: 401 };
  }

  if (err instanceof ForbiddenError) {
    return { error: err.message, statusCode: 403 };
  }

  if (err instanceof NotFoundError) {
    return { error: err.message, statusCode: 404 };
  }

  if (err instanceof ConflictError) {
    return { error: err.message, statusCode: 409 };
  }

  return null;
}
