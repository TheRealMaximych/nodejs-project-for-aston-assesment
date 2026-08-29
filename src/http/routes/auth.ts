import { Router } from "express";
import { UnauthorizedError } from "../../domain/errors";
import { loginUser } from "../../services/login-user";
import { logoutUser } from "../../services/logout-user";
import { registerUser } from "../../services/register-user";
import { requireAuth } from "../middleware/require-auth";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json({ id: user.id, email: user.email });
});

authRouter.post("/login", async (req, res) => {
  const result = await loginUser(req.body);
  res.status(200).json({ accessToken: result.accessToken });
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const userId = req.userId;
  if (userId === undefined) {
    throw new UnauthorizedError();
  }

  await logoutUser(userId);
  res.status(204).end();
});
