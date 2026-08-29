export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message = "Validation failed") {
    super(message);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized") {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super(message);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Not Found") {
    super(message);
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Email already taken") {
    super(message);
  }
}

export class InsufficientFundsError extends DomainError {
  constructor() {
    super("Insufficient funds");
  }
}

export class CurrencyMismatchError extends DomainError {
  constructor(message = "Currency mismatch") {
    super(message);
  }
}

export class SameAccountTransferError extends DomainError {
  constructor(message = "Cannot transfer to the same account") {
    super(message);
  }
}
