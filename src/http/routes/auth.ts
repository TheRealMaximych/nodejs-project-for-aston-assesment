import { Router } from "express";
import { registerUser } from "../../services/register-user";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json({ id: user.id, email: user.email });
});
