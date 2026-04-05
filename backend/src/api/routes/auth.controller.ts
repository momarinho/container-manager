import { Request, Response } from "express";
import * as authService from "./auth.service";

export async function login(req: Request, res: Response) {
  const { username, password, apiToken } = req.body as {
    username?: string;
    password?: string;
    apiToken?: string;
  };
  let user = null;
  if (apiToken) user = authService.authenticateWithApiToken(apiToken);
  else if (username && password)
    user = await authService.authenticateWithPassword(username, password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const token = authService.createAccessToken(user);
  return res.json({ token, user });
}
