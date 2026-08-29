import pino from "pino";

const redactPaths = [
  "password",
  "passwordHash",
  "hash",
  "token",
  "accessToken",
  "jwt",
  "authorization",
  "cvv",
  "databaseUrl",
  "DATABASE_URL",
  "url",
];

export const logger = pino({
  redact: {
    paths: redactPaths,
    censor: "[Redacted]",
  },
});
