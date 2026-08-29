import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../domain/errors";
import { authenticateAccessToken } from "../../services/authenticate-access-token";
import "../types";

function readBearerToken(
  authorization: string | string[] | undefined,
): string | null {
  if (typeof authorization !== "string") {
    return null;
  }

  const [scheme, token, extra] = authorization.split(" ");
  if (scheme !== "Bearer" || token === undefined || token === "" || extra !== undefined) {
    return null;
  }

  return token;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readBearerToken(req.headers.authorization);
    if (token === null) {
      next(new UnauthorizedError());
      return;
    }

    const { userId } = await authenticateAccessToken(token);
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}
