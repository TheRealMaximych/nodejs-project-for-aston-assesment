import type { OpenAPIV3 } from "openapi-types";

const errorResponseRef: OpenAPIV3.ReferenceObject = {
  $ref: "#/components/schemas/ErrorResponse",
};

function jsonError(
  description: string,
  example?: { error: string; statusCode: number },
): OpenAPIV3.ResponseObject {
  const media: OpenAPIV3.MediaTypeObject = {
    schema: errorResponseRef,
  };
  if (example !== undefined) {
    media.example = example;
  }

  return {
    description,
    content: {
      "application/json": media,
    },
  };
}

function jsonBody(
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
): OpenAPIV3.RequestBodyObject {
  return {
    required: true,
    content: {
      "application/json": { schema },
    },
  };
}

function jsonSuccess(
  description: string,
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
): OpenAPIV3.ResponseObject {
  return {
    description,
    content: {
      "application/json": { schema },
    },
  };
}

function uuidPathParam(name: string, description: string): OpenAPIV3.ParameterObject {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string", format: "uuid" },
  };
}

const bearerSecurity: OpenAPIV3.SecurityRequirementObject[] = [{ bearerAuth: [] }];

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Banking Accounts and Transfers API",
    version: "1.0.0",
    description:
      "REST API for registration, JWT authentication, bank accounts, and money transfers.",
  },
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Accounts" },
    { name: "Transactions" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        operationId: "getHealth",
        summary: "Health check",
        responses: {
          "200": jsonSuccess("Service is running", {
            $ref: "#/components/schemas/HealthResponse",
          }),
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        operationId: "register",
        summary: "Register a new user",
        requestBody: jsonBody({ $ref: "#/components/schemas/RegisterRequest" }),
        responses: {
          "201": jsonSuccess("User created", {
            $ref: "#/components/schemas/RegisterResponse",
          }),
          "400": jsonError("Validation error"),
          "409": jsonError("Email is already taken"),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        operationId: "login",
        summary: "Log in and receive an access token",
        requestBody: jsonBody({ $ref: "#/components/schemas/LoginRequest" }),
        responses: {
          "200": jsonSuccess("Authenticated", {
            $ref: "#/components/schemas/LoginResponse",
          }),
          "400": jsonError("Validation error"),
          "401": jsonError("Invalid email or password"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        operationId: "logout",
        summary: "Invalidate the current access token",
        security: bearerSecurity,
        responses: {
          "204": {
            description: "Logged out; empty body",
          },
          "401": jsonError("Missing or invalid access token"),
        },
      },
    },
    "/accounts": {
      post: {
        tags: ["Accounts"],
        operationId: "createAccount",
        summary: "Create a bank account for the authenticated user",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateAccountRequest" }),
        responses: {
          "201": jsonSuccess("Account created", {
            $ref: "#/components/schemas/AccountResponse",
          }),
          "400": jsonError("Validation error"),
          "401": jsonError("Missing or invalid access token"),
        },
      },
    },
    "/accounts/{id}/balance": {
      get: {
        tags: ["Accounts"],
        operationId: "getAccountBalance",
        summary: "Get the balance of an owned account",
        security: bearerSecurity,
        parameters: [uuidPathParam("id", "Bank account id")],
        responses: {
          "200": jsonSuccess("Current balance", {
            $ref: "#/components/schemas/BalanceResponse",
          }),
          "400": jsonError("Validation error"),
          "401": jsonError("Missing or invalid access token"),
          "403": jsonError("Account belongs to another user"),
          "404": jsonError("Account not found"),
        },
      },
    },
    "/transactions": {
      post: {
        tags: ["Transactions"],
        operationId: "createTransfer",
        summary: "Transfer money between accounts",
        description:
          "Debits fromAccount (must belong to the caller) and credits toAccount. Currencies must match. Amount must be greater than zero. fromAccount and toAccount must differ.",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/TransferRequest" }),
        responses: {
          "201": jsonSuccess("Transfer completed", {
            $ref: "#/components/schemas/TransferResponse",
          }),
          "400": jsonError(
            "Validation error, insufficient funds, currency mismatch, or same-account transfer",
            { error: "Insufficient funds", statusCode: 400 },
          ),
          "401": jsonError("Missing or invalid access token"),
          "403": jsonError("fromAccount belongs to another user"),
          "404": jsonError("Account not found"),
        },
      },
    },
    "/transactions/{accountId}": {
      get: {
        tags: ["Transactions"],
        operationId: "getAccountHistory",
        summary: "List transactions for an owned account",
        security: bearerSecurity,
        parameters: [uuidPathParam("accountId", "Bank account id")],
        responses: {
          "200": jsonSuccess("Transaction history", {
            type: "array",
            items: { $ref: "#/components/schemas/HistoryItem" },
          }),
          "400": jsonError("Validation error"),
          "401": jsonError("Missing or invalid access token"),
          "403": jsonError("Account belongs to another user"),
          "404": jsonError("Account not found"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token from POST /auth/login. Send as Authorization: Bearer <token>.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error", "statusCode"],
        additionalProperties: false,
        properties: {
          error: { type: "string" },
          statusCode: { type: "integer" },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["status"],
        additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["ok"] },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        additionalProperties: false,
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password", minLength: 8, maxLength: 72 },
        },
      },
      RegisterResponse: {
        type: "object",
        required: ["id", "email"],
        additionalProperties: false,
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        additionalProperties: false,
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["accessToken"],
        additionalProperties: false,
        properties: {
          accessToken: { type: "string" },
        },
      },
      CreateAccountRequest: {
        type: "object",
        required: ["accountHolder", "currency"],
        additionalProperties: false,
        properties: {
          accountHolder: { type: "string", minLength: 1, maxLength: 255 },
          currency: {
            type: "string",
            pattern: "^[A-Z]{3}$",
            description: "ISO 4217 currency code",
          },
        },
      },
      AccountResponse: {
        type: "object",
        required: ["id", "accountHolder", "balance", "currency"],
        additionalProperties: false,
        properties: {
          id: { type: "string", format: "uuid" },
          accountHolder: { type: "string" },
          balance: { type: "string", description: "Decimal amount as a string" },
          currency: { type: "string" },
        },
      },
      BalanceResponse: {
        type: "object",
        required: ["balance"],
        additionalProperties: false,
        properties: {
          balance: { type: "string", description: "Decimal amount as a string" },
        },
      },
      TransferRequest: {
        type: "object",
        required: ["fromAccount", "toAccount", "amount"],
        additionalProperties: false,
        properties: {
          fromAccount: { type: "string", format: "uuid" },
          toAccount: { type: "string", format: "uuid" },
          amount: {
            type: "string",
            pattern: "^(?:0|[1-9]\\d*)(?:\\.\\d{1,2})?$",
            description: "Positive decimal amount as a string",
          },
        },
      },
      TransferResponse: {
        type: "object",
        required: ["transactionId", "status"],
        additionalProperties: false,
        properties: {
          transactionId: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["Completed"] },
        },
      },
      HistoryItem: {
        type: "object",
        required: [
          "transactionId",
          "fromAccount",
          "toAccount",
          "amount",
          "timestamp",
          "status",
        ],
        additionalProperties: false,
        properties: {
          transactionId: { type: "string", format: "uuid" },
          fromAccount: { type: "string", format: "uuid" },
          toAccount: { type: "string", format: "uuid" },
          amount: { type: "string", description: "Decimal amount as a string" },
          timestamp: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["Completed", "Failed"] },
        },
      },
    },
  },
};
