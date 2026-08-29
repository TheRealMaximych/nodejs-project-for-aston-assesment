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
import { User } from "./user";

const numericStringTransformer: ValueTransformer = {
  to(value: unknown): string {
    if (typeof value !== "string") {
      throw new TypeError("balance must be a decimal string");
    }
    return value;
  },
  from(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }
    if (value == null) {
      return "0.00";
    }
    return String(value);
  },
};

@Entity({ name: "bank_accounts" })
export class BankAccount {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "account_holder", type: "varchar", length: 255 })
  accountHolder!: string;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 2,
    default: 0,
    transformer: numericStringTransformer,
  })
  balance!: string;

  @Column({ type: "char", length: 3 })
  currency!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
