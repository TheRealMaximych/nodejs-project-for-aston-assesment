import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransactions1700000003000 implements MigrationInterface {
  name = "CreateTransactions1700000003000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "from_account" uuid NOT NULL,
        "to_account" uuid NOT NULL,
        "amount" numeric(20, 2) NOT NULL,
        "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "status" character varying(16) NOT NULL,
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_from_account" FOREIGN KEY ("from_account") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transactions_to_account" FOREIGN KEY ("to_account") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_transactions_status" CHECK ("status" IN ('Completed', 'Failed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_from_account" ON "transactions" ("from_account")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_to_account" ON "transactions" ("to_account")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transactions"`);
  }
}
