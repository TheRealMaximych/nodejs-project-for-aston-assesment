import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../domain/errors";

export type AccessTokenClaims = {
  userId: string;
  tokenVersion: number;
};

function parseAccessTokenClaims(payload: unknown): AccessTokenClaims {
  if (payload === null || typeof payload !== "object") {
    throw new UnauthorizedError();
  }

  const { userId, tokenVersion } = payload as {
    userId?: unknown;
    tokenVersion?: unknown;
  };

  if (typeof userId !== "string" || userId.length === 0) {
    throw new UnauthorizedError();
  }

  if (typeof tokenVersion !== "number" || !Number.isInteger(tokenVersion)) {
    throw new UnauthorizedError();
  }

  return { userId, tokenVersion };
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const { config } = await import("../config/env.js");

  return await new Promise<string>((resolve, reject) => {
    jwt.sign(
      { userId: claims.userId, tokenVersion: claims.tokenVersion },
      config.jwtSecret,
      { algorithm: "HS256", expiresIn: config.jwtExpiresIn },
      (error, token) => {
        if (error !== null || token === undefined) {
          reject(error ?? new Error("Failed to sign access token"));
          return;
        }

        resolve(token);
      },
    );
  });
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { config } = await import("../config/env.js");

  const payload = await new Promise<unknown>((resolve, reject) => {
    jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }, (error, decoded) => {
      if (error !== null || decoded === undefined) {
        reject(new UnauthorizedError());
        return;
      }

      resolve(decoded);
    });
  });

  return parseAccessTokenClaims(payload);
}
