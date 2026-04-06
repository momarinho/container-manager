import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  createServer,
  deleteServer,
  listServers,
} from "../controllers/servers.controller";

const router = Router();

router.get("/", authMiddleware, listServers);
router.post("/", authMiddleware, createServer);
router.delete("/:id", authMiddleware, deleteServer);

export default router;
