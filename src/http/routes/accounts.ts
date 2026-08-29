import { Router } from "express";
import { UnauthorizedError } from "../../domain/errors";
import { createBankAccount } from "../../services/create-bank-account";
import { getAccountBalance } from "../../services/get-account-balance";
import { requireAuth } from "../middleware/require-auth";

export const accountsRouter = Router();

accountsRouter.post("/", requireAuth, async (req, res) => {
  const userId = req.userId;
  if (userId === undefined) {
    throw new UnauthorizedError();
  }

  const account = await createBankAccount(userId, req.body);
  res.status(201).json({
    id: account.id,
    accountHolder: account.accountHolder,
    balance: account.balance,
    currency: account.currency,
  });
});

accountsRouter.get("/:id/balance", requireAuth, async (req, res) => {
  const userId = req.userId;
  if (userId === undefined) {
    throw new UnauthorizedError();
  }

  const result = await getAccountBalance({
    userId,
    accountId: req.params.id,
  });
  res.status(200).json({ balance: result.balance });
});
