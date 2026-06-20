import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

const calculateSchema = z.object({
  provinceCode: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().min(1),
    })
  ).min(1),
});

/**
 * @openapi
 * /api/checkout/calculate-shipping:
 *   post:
 *     tags: [Checkout]
 *     summary: Tính phí vận chuyển dựa trên mã tỉnh và giỏ hàng
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provinceCode, items]
 *             properties:
 *               provinceCode: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: string }
 *                     quantity: { type: integer }
 *     responses:
 *       200:
 *         description: Tính phí vận chuyển thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post("/calculate-shipping", async (req, res) => {
  const parsed = calculateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  const { provinceCode, items } = parsed.data;

  const codeNum = parseInt(provinceCode, 10);
  let shippingFee = 30000; // Phí ship mặc định

  if (codeNum === 79 || codeNum === 1) {
    shippingFee = 15000; // TP.HCM hoặc Hà Nội
  } else if ([48, 31, 75, 60].includes(codeNum)) {
    shippingFee = 25000; // Đà Nẵng, Hải Phòng, Cần Thơ, Đồng Nai
  } else if (codeNum >= 80) {
    shippingFee = 40000; // Khu vực vùng sâu vùng xa / miền Nam biên giới
  } else if (codeNum > 1 && codeNum < 30) {
    shippingFee = 35000; // Tỉnh xa phía Bắc
  }

  // Cộng thêm phụ phí số lượng mặt hàng: 5000đ cho mỗi sản phẩm từ sản phẩm thứ 2
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const additionalFee = Math.max(0, (totalQty - 1) * 5000);

  shippingFee += additionalFee;

  res.json({
    shippingFee,
  });
});

export default router;
