import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBankAccounts1700000002000 implements MigrationInterface {
  name = "CreateBankAccounts1700000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bank_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "account_holder" character varying(255) NOT NULL,
        "balance" numeric(20, 2) NOT NULL DEFAULT 0,
        "currency" character(3) NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bank_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bank_accounts_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bank_accounts_user_id" ON "bank_accounts" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bank_accounts"`);
  }
}
