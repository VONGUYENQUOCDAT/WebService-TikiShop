import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

const applySchema = z.object({
  code: z.string().min(1),
  order_amount: z.coerce.number().int().min(0),
  user_id: z.string().optional(),
});

/**
 * @openapi
 * /api/vouchers/apply:
 *   post:
 *     tags: [Vouchers]
 *     summary: Áp dụng thử mã giảm giá cho đơn hàng
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, order_amount]
 *             properties:
 *               code: { type: string }
 *               order_amount: { type: integer }
 *               user_id: { type: string }
 *     responses:
 *       200:
 *         description: Áp dụng voucher thành công
 *       400:
 *         description: Voucher không hợp lệ hoặc không đủ điều kiện
 */
router.post("/apply", async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  const { code, order_amount } = parsed.data;
  const userId = parsed.data.user_id || req.user!.userId;

  try {
    const uppercaseCode = code.toUpperCase();

    // 1. Tìm mã trong DB.
    const voucher = await prisma.voucher.findUnique({
      where: { code: uppercaseCode },
    });

    if (!voucher) {
      res.status(400).json({ error: "Mã giảm giá không tồn tại" });
      return;
    }

    // 2. Check trạng thái khác ACTIVE hoặc quá hạn end_date.
    const now = new Date();
    const isExpired = now > new Date(voucher.end_date) || now < new Date(voucher.start_date);
    if (voucher.status !== "ACTIVE" || isExpired) {
      res.status(400).json({ error: "Mã giảm giá đã hết hạn" });
      return;
    }

    // 3. Check used_count >= usage_limit.
    if (voucher.used_count >= voucher.usage_limit) {
      res.status(400).json({ error: "Mã giảm giá đã hết lượt sử dụng" });
      return;
    }

    // 4. Check order_amount < min_order_amount.
    if (order_amount < voucher.min_order_amount) {
      res.status(400).json({ error: "Đơn hàng chưa đạt giá trị tối thiểu" });
      return;
    }

    // 5. Check User_Voucher_History: Đếm số lần user_id đã dùng voucher_id.
    const usedCountForUser = await prisma.userVoucherHistory.count({
      where: {
        userId,
        voucherId: voucher.id,
      },
    });

    if (usedCountForUser >= voucher.per_user_limit) {
      res.status(400).json({ error: "Bạn đã hết lượt sử dụng mã này" });
      return;
    }

    // Tính toán số tiền được giảm
    let discount_amount = 0;
    if (voucher.discount_type === "PERCENTAGE") {
      discount_amount = Math.floor((order_amount * voucher.discount_value) / 100);
      if (voucher.max_discount_amount != null) {
        discount_amount = Math.min(discount_amount, voucher.max_discount_amount);
      }
    } else if (voucher.discount_type === "FIXED_AMOUNT") {
      discount_amount = voucher.discount_value;
    }

    // Đảm bảo số tiền giảm không vượt quá tổng đơn hàng
    discount_amount = Math.min(discount_amount, order_amount);

    const final_amount = order_amount - discount_amount;

    res.json({
      code: voucher.code,
      discount_type: voucher.discount_type,
      discount_value: voucher.discount_value,
      discount_amount,
      final_amount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Lỗi khi áp dụng mã giảm giá" });
  }
});

// Admin: List all vouchers (paginated, with search)
router.get("/admin/list", adminRequired, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = (req.query.search as string) || "";
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.code = { contains: search };
  }

  try {
    const [items, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.voucher.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch vouchers" });
  }
});

// Admin: Create voucher
const createVoucherSchema = z.object({
  code: z.string().min(1),
  discount_type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discount_value: z.number().min(1),
  max_discount_amount: z.number().nullable().optional(),
  min_order_amount: z.number().min(0).default(0),
  usage_limit: z.number().int().min(1).default(100),
  per_user_limit: z.number().int().min(1).default(1),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

router.post("/admin/create", adminRequired, async (req, res) => {
  const parsed = createVoucherSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  try {
    const uppercaseCode = parsed.data.code.toUpperCase();
    const existing = await prisma.voucher.findUnique({
      where: { code: uppercaseCode },
    });
    if (existing) {
      res.status(409).json({ error: "Mã giảm giá đã tồn tại" });
      return;
    }

    const created = await prisma.voucher.create({
      data: {
        ...parsed.data,
        code: uppercaseCode,
        start_date: new Date(parsed.data.start_date),
        end_date: new Date(parsed.data.end_date),
      },
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create voucher" });
  }
});

// Admin: Patch voucher status
router.patch("/admin/:id/status", adminRequired, async (req, res) => {
  const id = req.params.id as string;
  const statusSchema = z.object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
  });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  try {
    const updated = await prisma.voucher.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update voucher status" });
  }
});

export default router;
