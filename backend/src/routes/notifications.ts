import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// GET /api/notifications - Get all user notifications
router.get("/", async (req, res) => {
  try {
    const list = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch("/read-all", async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to mark all as read" });
  }
});

// PATCH /api/notifications/:id/read - Mark single as read
router.patch("/:id/read", async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user!.userId },
    });
    if (!existing) {
      res.status(404).json({ error: "Không tìm thấy thông báo" });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to mark notification as read" });
  }
});

export default router;
