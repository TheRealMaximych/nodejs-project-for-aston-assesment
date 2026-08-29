import { Router } from "express";
import { UnauthorizedError } from "../../domain/errors";
import { transferMoney } from "../../services/transfer-money";
import { requireAuth } from "../middleware/require-auth";

export const transactionsRouter = Router();

transactionsRouter.post("/", requireAuth, async (req, res) => {
  const userId = req.userId;
  if (userId === undefined) {
    throw new UnauthorizedError();
  }

  const result = await transferMoney(userId, req.body);
  res.status(201).json({
    transactionId: result.transactionId,
    status: result.status,
  });
});
