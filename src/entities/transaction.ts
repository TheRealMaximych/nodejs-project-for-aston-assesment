import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type ValueTransformer,
} from "typeorm";
import { BankAccount } from "./bank-account";

export type TransactionStatus = "Completed" | "Failed";

const numericStringTransformer: ValueTransformer = {
  to(value: unknown): string {
    if (typeof value !== "string") {
      throw new TypeError("amount must be a decimal string");
    }
    return value;
  },
  from(value: unknown): string {
    if (typeof value === "number") {
      throw new TypeError("amount must not be an IEEE number");
    }
    if (typeof value === "string") {
      return value;
    }
    if (value == null) {
      throw new TypeError("amount must be a decimal string");
    }
    return `${value}`;
  },
};

@Entity({ name: "transactions" })
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "from_account", type: "uuid" })
  fromAccount!: string;

  @ManyToOne(() => BankAccount, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "from_account" })
  fromBankAccount!: BankAccount;

  @Index()
  @Column({ name: "to_account", type: "uuid" })
  toAccount!: string;

  @ManyToOne(() => BankAccount, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "to_account" })
  toBankAccount!: BankAccount;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 2,
    transformer: numericStringTransformer,
  })
  amount!: string;

  @CreateDateColumn({ name: "timestamp", type: "timestamptz" })
  timestamp!: Date;

  @Column({ type: "varchar", length: 16 })
  status!: TransactionStatus;
}
