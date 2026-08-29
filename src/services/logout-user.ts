import { logger as appLogger } from "../config/logger";
import { UnauthorizedError } from "../domain/errors";

export type LogoutUserDeps = {
  users: {
    incrementTokenVersion: (id: string) => Promise<boolean>;
  };
  logger: { info: (message: string) => void };
};

async function loadDefaultDeps(): Promise<LogoutUserDeps> {
  const { userRepository } = await import("../repositories/user-repository.js");

  return {
    users: userRepository,
    logger: {
      info: (message: string) => {
        appLogger.info(message);
      },
    },
  };
}

export async function logoutUser(
  userId: string,
  deps?: LogoutUserDeps,
): Promise<void> {
  const { users, logger } = deps ?? (await loadDefaultDeps());

  const updated = await users.incrementTokenVersion(userId);
  if (!updated) {
    throw new UnauthorizedError();
  }

  logger.info(`User logout successful: userId=${userId}`);
}
