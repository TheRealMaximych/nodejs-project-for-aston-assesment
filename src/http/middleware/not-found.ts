import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../domain/app-error";

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError("Not Found", 404));
}
