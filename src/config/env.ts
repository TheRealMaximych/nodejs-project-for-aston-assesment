import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().trim().min(1),
  JWT_SECRET: z.string().trim().min(1),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment configuration");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return {
    port: parsed.data.PORT,
    nodeEnv: parsed.data.NODE_ENV,
    databaseUrl: parsed.data.DATABASE_URL,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtExpiresIn: "1h" as const,
  };
}

export const config = loadConfig();
