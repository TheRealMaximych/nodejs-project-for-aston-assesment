import { z } from "zod";
import { logger as appLogger } from "../config/logger";
import { UnauthorizedError, ValidationError } from "../domain/errors";
import { signAccessToken as defaultSignAccessToken } from "./access-token";
import { comparePassword as defaultComparePassword } from "./password-hasher";

export type LoginResult = {
  accessToken: string;
};

export type AuthCredentials = {
  id: string;
  passwordHash: string;
  tokenVersion: number;
};

export type LoginUserDeps = {
  users: {
    findAuthByEmail: (email: string) => Promise<AuthCredentials | null>;
  };
  comparePassword: (plaintext: string, passwordHash: string) => Promise<boolean>;
  signAccessToken: (claims: { userId: string; tokenVersion: number }) => Promise<string>;
  logger: { info: (message: string) => void };
};

const loginUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

// Valid bcrypt hash so unknown-email login still awaits a compare (anti-enumeration timing).
const DUMMY_PASSWORD_HASH =
  "$2b$10$9dGzXiLwJU4EtBLhxA3Gj.dsYYZra5mTNFP5Jnl70n7hcHYguxd.u";

async function loadDefaultDeps(): Promise<LoginUserDeps> {
  const { userRepository } = await import("../repositories/user-repository.js");

  return {
    users: userRepository,
    comparePassword: defaultComparePassword,
    signAccessToken: defaultSignAccessToken,
    logger: {
      info: (message: string) => {
        appLogger.info(message);
      },
    },
  };
}

export async function loginUser(
  input: unknown,
  deps?: LoginUserDeps,
): Promise<LoginResult> {
  const { users, comparePassword, signAccessToken, logger } =
    deps ?? (await loadDefaultDeps());

  const parsed = loginUserSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const { email, password } = parsed.data;

  const user = await users.findAuthByEmail(email);
  if (!user) {
    await comparePassword(password, DUMMY_PASSWORD_HASH);
    throw new UnauthorizedError();
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError();
  }

  const accessToken = await signAccessToken({
    userId: user.id,
    tokenVersion: user.tokenVersion,
  });

  logger.info(`User login successful: userId=${user.id}`);

  return { accessToken };
}
