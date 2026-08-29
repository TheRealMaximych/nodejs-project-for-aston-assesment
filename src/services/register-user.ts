import { z } from "zod";
import { logger as appLogger } from "../config/logger";
import { ConflictError, ValidationError } from "../domain/errors";
import { hashPassword as defaultHashPassword } from "./password-hasher";

export type PublicUser = {
  id: string;
  email: string;
};

export type RegisterUserDeps = {
  users: {
    findByEmail: (email: string) => Promise<PublicUser | null>;
    insert: (user: { email: string; passwordHash: string }) => Promise<PublicUser>;
  };
  hashPassword: (plaintext: string) => Promise<string>;
  logger: { info: (message: string) => void };
};

const registerUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(72),
});

async function loadDefaultDeps(): Promise<RegisterUserDeps> {
  const { userRepository } = await import("../repositories/user-repository.js");

  return {
    users: userRepository,
    hashPassword: defaultHashPassword,
    logger: {
      info: (message: string) => {
        appLogger.info(message);
      },
    },
  };
}

export async function registerUser(
  input: unknown,
  deps?: RegisterUserDeps,
): Promise<PublicUser> {
  const { users, hashPassword, logger } = deps ?? (await loadDefaultDeps());

  const parsed = registerUserSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Validation failed");
  }

  const { email, password } = parsed.data;

  const existing = await users.findByEmail(email);
  if (existing) {
    throw new ConflictError();
  }

  const passwordHash = await hashPassword(password);
  const user = await users.insert({ email, passwordHash });

  logger.info(`User registered: email=${user.email}`);

  return { id: user.id, email: user.email };
}
