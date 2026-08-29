import type { ErrorRequestHandler } from "express";
import { logger } from "../../config/logger";
import { mapDomainError } from "../map-domain-error";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const mapped = mapDomainError(err);
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
