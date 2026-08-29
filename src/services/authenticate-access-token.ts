import { UnauthorizedError } from "../domain/errors";
import {
  verifyAccessToken as defaultVerifyAccessToken,
  type AccessTokenClaims,
} from "./access-token";

export type AuthenticatedUser = {
  userId: string;
};

export type AuthenticateAccessTokenDeps = {
  verifyAccessToken: (token: string) => Promise<AccessTokenClaims>;
  users: {
    findAuthById: (
      id: string,
    ) => Promise<{ id: string; tokenVersion: number } | null>;
  };
};

async function loadDefaultDeps(): Promise<AuthenticateAccessTokenDeps> {
  const { userRepository } = await import("../repositories/user-repository.js");

  return {
    verifyAccessToken: defaultVerifyAccessToken,
    users: userRepository,
  };
}

export async function authenticateAccessToken(
  token: string,
  deps?: AuthenticateAccessTokenDeps,
): Promise<AuthenticatedUser> {
  const { verifyAccessToken, users } = deps ?? (await loadDefaultDeps());

  const claims = await verifyAccessToken(token);
  const user = await users.findAuthById(claims.userId);

  if (!user || user.tokenVersion !== claims.tokenVersion) {
    throw new UnauthorizedError();
  }

  return { userId: user.id };
}
