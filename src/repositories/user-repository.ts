import { QueryFailedError } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { ConflictError } from "../domain/errors";
import { User } from "../entities/user";

export type PublicUser = {
  id: string;
  email: string;
};

export type NewUser = {
  email: string;
  passwordHash: string;
};

export type UserRepository = {
  findByEmail(email: string): Promise<PublicUser | null>;
  insert(user: NewUser): Promise<PublicUser>;
};

function isPostgresUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code === "23505";
}

async function findByEmail(email: string): Promise<PublicUser | null> {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return null;
  }

  return { id: user.id, email: user.email };
}

async function insert(user: NewUser): Promise<PublicUser> {
  const repo = AppDataSource.getRepository(User);

  try {
    const created = repo.create({
      email: user.email,
      passwordHash: user.passwordHash,
      tokenVersion: 0,
    });
    const saved = await repo.save(created);
    return { id: saved.id, email: saved.email };
  } catch (error) {
    if (isPostgresUniqueViolation(error)) {
      throw new ConflictError();
    }

    throw error;
  }
}

export const userRepository: UserRepository = {
  findByEmail,
  insert,
};
