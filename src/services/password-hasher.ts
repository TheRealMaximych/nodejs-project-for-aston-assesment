import { compare, hash } from "bcrypt";

const BCRYPT_COST = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, BCRYPT_COST);
}

export async function comparePassword(
  plaintext: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(plaintext, passwordHash);
}
