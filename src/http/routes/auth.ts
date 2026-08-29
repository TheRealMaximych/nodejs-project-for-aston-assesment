import { Router } from "express";
import { loginUser } from "../../services/login-user";
import { registerUser } from "../../services/register-user";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json({ id: user.id, email: user.email });
});

authRouter.post("/login", async (req, res) => {
  const result = await loginUser(req.body);
  res.status(200).json({ accessToken: result.accessToken });
});
