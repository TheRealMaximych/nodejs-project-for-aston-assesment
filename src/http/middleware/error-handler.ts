import type { ErrorRequestHandler } from "express";
import { logger } from "../../config/logger";
import { mapDomainError } from "../map-domain-error";

type MappedHttpError = {
  error: string;
  statusCode: number;
};

function mapBodyParserError(err: unknown): MappedHttpError | null {
  if (typeof err !== "object" || err === null) {
    return null;
  }

  const type = "type" in err ? err.type : undefined;
  if (type === "entity.parse.failed") {
    return { error: "Invalid JSON", statusCode: 400 };
  }

  if (type === "entity.too.large") {
    return { error: "Request body too large", statusCode: 413 };
  }

  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const mapped = mapDomainError(err) ?? mapBodyParserError(err);
  if (mapped) {
    res.status(mapped.statusCode).json(mapped);
    return;
  }

  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");

  res.status(500).json({
    error: "Internal Server Error",
    statusCode: 500,
  });
};
