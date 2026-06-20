import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

const registerSchema = z.object({
  shopName: z.string().min(2, "Tên gian hàng tối thiểu 2 ký tự"),
  taxCode: z.string().optional(),
  idCard: z.string().optional(),
  businessAddress: z.string().min(5, "Địa chỉ kinh doanh tối thiểu 5 ký tự"),
  bankAccount: z.string().optional(),
});

/**
 * @openapi
 * /api/seller/register:
 *   post:
 *     tags: [Seller]
 *     summary: Đăng ký mở gian hàng
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopName, businessAddress]
 *             properties:
 *               shopName: { type: string }
 *               taxCode: { type: string }
 *               idCard: { type: string }
 *               businessAddress: { type: string }
 *               bankAccount: { type: string }
 *     responses:
 *       201:
 *         description: Đăng ký gian hàng thành công, chờ duyệt
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc đã có gian hàng
 */
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.userId;

  // Kiểm tra user không phải ADMIN
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy tài khoản" });
    return;
  }
  if (user.role === "ADMIN") {
    res.status(400).json({ error: "Admin không cần đăng ký gian hàng" });
    return;
  }

  // Kiểm tra user đã có shop chưa
  const existing = await prisma.shop.findUnique({ where: { ownerId: userId } });
  if (existing) {
    if (existing.status === "APPROVED") {
      res.status(400).json({ error: "Bạn đã có gian hàng được duyệt" });
      return;
    }
    if (existing.status === "PENDING") {
      res.status(400).json({ error: "Bạn đã gửi hồ sơ, đang chờ duyệt" });
      return;
    }
    // Nếu REJECTED: Cho phép cập nhật lại thông tin để chờ duyệt lại
    if (existing.status === "REJECTED") {
      const { shopName, taxCode, idCard, businessAddress, bankAccount } = parsed.data;
      const updatedShop = await prisma.shop.update({
        where: { ownerId: userId },
        data: {
          shopName,
          taxCode: taxCode || null,
          idCard: idCard || null,
          businessAddress,
          bankAccount: bankAccount || null,
          status: "PENDING",
          rejectReason: null,
        },
        include: { owner: { select: { id: true, email: true, name: true } } },
      });
      res.status(200).json(updatedShop);
      return;
    }
  }

  const { shopName, taxCode, idCard, businessAddress, bankAccount } = parsed.data;

  const shop = await prisma.shop.create({
    data: {
      ownerId: userId,
      shopName,
      taxCode: taxCode || null,
      idCard: idCard || null,
      businessAddress,
      bankAccount: bankAccount || null,
      status: "PENDING",
    },
    include: { owner: { select: { id: true, email: true, name: true } } },
  });

  res.status(201).json(shop);
});

/**
 * @openapi
 * /api/seller/my-shop:
 *   get:
 *     tags: [Seller]
 *     summary: Lấy thông tin gian hàng của user hiện tại
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Thông tin gian hàng (hoặc null nếu chưa đăng ký)
 */
router.get("/my-shop", async (req, res) => {
  const userId = req.user!.userId;

  const shop = await prisma.shop.findUnique({
    where: { ownerId: userId },
    include: { owner: { select: { id: true, email: true, name: true } } },
  });

  res.json(shop); // null nếu chưa có
});

export default router;
