import jwt from "jsonwebtoken";

export type AccessTokenClaims = {
  userId: string;
  tokenVersion: number;
};

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
