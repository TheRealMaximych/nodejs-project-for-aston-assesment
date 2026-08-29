import type { ErrorRequestHandler } from "express";
import { logger } from "../../config/logger";
import { AppError } from "../../domain/app-error";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");

  res.status(500).json({
    error: "Internal Server Error",
    statusCode: 500,
  });
};
