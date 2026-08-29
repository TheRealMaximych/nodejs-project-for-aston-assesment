import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMoneyCheckConstraints1700000004000 implements MigrationInterface {
  name = "AddMoneyCheckConstraints1700000004000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bank_accounts"
      ADD CONSTRAINT "CHK_bank_accounts_balance_non_negative"
      CHECK ("balance" >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_amount_positive"
      CHECK ("amount" > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      DROP CONSTRAINT "CHK_transactions_amount_positive"
    `);
    await queryRunner.query(`
      ALTER TABLE "bank_accounts"
      DROP CONSTRAINT "CHK_bank_accounts_balance_non_negative"
    `);
  }
}
