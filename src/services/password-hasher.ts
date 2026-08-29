import { hash } from "bcrypt";

const BCRYPT_COST = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, BCRYPT_COST);
}
