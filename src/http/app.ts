import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { accountsRouter } from "./routes/accounts";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { transactionsRouter } from "./routes/transactions";

export const app = express();

app.use(express.json());
app.use(healthRouter);
app.use("/auth", authRouter);
app.use("/accounts", accountsRouter);
app.use("/transactions", transactionsRouter);
app.use(notFound);
app.use(errorHandler);
