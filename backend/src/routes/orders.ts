import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

const checkoutSchema = z.object({
  address: z.string().min(5),
  phone: z.string().min(8),
  cartItemIds: z.array(z.string()).min(1).max(200).optional(),
  provinceId: z.string().optional(),
  provinceName: z.string().optional(),
  districtId: z.string().optional(),
  districtName: z.string().optional(),
  wardId: z.string().optional(),
  wardName: z.string().optional(),
  streetAddress: z.string().optional(),
  addressType: z.string().optional(),
  voucherCode: z.string().optional(),
});

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Lịch sử đơn hàng
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.get("/", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: { select: { id: true, name: true, slug: true, image: true } } } },
    },
  });
  res.json(orders);
});

/**
 * @openapi
 * /api/orders/checkout:
 *   post:
 *     tags: [Orders]
 *     summary: Đặt hàng từ giỏ hiện tại
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, phone]
 *             properties:
 *               address: { type: string, minLength: 5 }
 *               phone: { type: string, minLength: 8 }
 *     responses:
 *       201:
 *         description: Đặt hàng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 */
router.post("/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const { 
    address, 
    phone, 
    cartItemIds,
    provinceId,
    provinceName,
    districtId,
    districtName,
    wardId,
    wardName,
    streetAddress,
    addressType,
    voucherCode
  } = parsed.data;

  const allCart = await prisma.cartItem.findMany({
    where: { userId: req.user!.userId },
    include: { product: true },
  });
  if (allCart.length === 0) {
    res.status(400).json({ error: "Giỏ hàng trống" });
    return;
  }

  let cartItems = allCart;
  if (cartItemIds && cartItemIds.length > 0) {
    const uniqueIds = [...new Set(cartItemIds)];
    cartItems = uniqueIds
      .map((id) => allCart.find((c) => c.id === id))
      .filter((x): x is (typeof allCart)[number] => x != null);
    if (cartItems.length !== uniqueIds.length) {
      res.status(400).json({
        error: "Danh sách thanh toán không hợp lệ (thiếu mục hoặc không thuộc giỏ của bạn).",
      });
      return;
    }
  }

  let shippingFee = 0;
  if (provinceId) {
    const codeNum = parseInt(provinceId, 10);
    shippingFee = 30000; // Phí mặc định
    if (codeNum === 79 || codeNum === 1) {
      shippingFee = 15000;
    } else if ([48, 31, 75, 60].includes(codeNum)) {
      shippingFee = 25000;
    } else if (codeNum >= 80) {
      shippingFee = 40000;
    } else if (codeNum > 1 && codeNum < 30) {
      shippingFee = 35000;
    }

    const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const additionalFee = Math.max(0, (totalQty - 1) * 5000);
    shippingFee += additionalFee;
  }

  const subtotal = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  // Voucher validation and discount calculation
  let discount = 0;
  let finalVoucherCode: string | null = null;
  let voucherId: string | null = null;

  if (voucherCode && voucherCode.trim() !== "") {
    const uppercaseCode = voucherCode.trim().toUpperCase();
    if (uppercaseCode === "FREESHIP299") {
      if (subtotal < 299000) {
        res.status(400).json({ error: "Đơn hàng chưa đủ điều kiện áp dụng mã Freeship" });
        return;
      }
    }

    const voucher = await prisma.voucher.findUnique({
      where: { code: uppercaseCode },
    });

    if (!voucher) {
      res.status(400).json({ error: "Mã giảm giá không tồn tại" });
      return;
    }

    const now = new Date();
    const isExpired = now > new Date(voucher.end_date) || now < new Date(voucher.start_date);
    if (voucher.status !== "ACTIVE" || isExpired) {
      res.status(400).json({ error: "Mã giảm giá đã hết hạn" });
      return;
    }

    if (voucher.used_count >= voucher.usage_limit) {
      res.status(400).json({ error: "Mã giảm giá đã hết lượt sử dụng" });
      return;
    }

    if (subtotal < voucher.min_order_amount) {
      res.status(400).json({ error: "Đơn hàng chưa đạt giá trị tối thiểu" });
      return;
    }

    const usedCountForUser = await prisma.userVoucherHistory.count({
      where: {
        userId: req.user!.userId,
        voucherId: voucher.id,
      },
    });

    if (usedCountForUser >= voucher.per_user_limit) {
      res.status(400).json({ error: "Bạn đã hết lượt sử dụng mã này" });
      return;
    }

    if (uppercaseCode === "FREESHIP299" || voucher.is_system_default) {
      discount = Math.min(shippingFee, voucher.discount_value);
    } else {
      if (voucher.discount_type === "PERCENTAGE") {
        discount = Math.floor((subtotal * voucher.discount_value) / 100);
        if (voucher.max_discount_amount != null) {
          discount = Math.min(discount, voucher.max_discount_amount);
        }
      } else if (voucher.discount_type === "FIXED_AMOUNT") {
        discount = voucher.discount_value;
      }
    }

    discount = Math.min(discount, subtotal + shippingFee);
    finalVoucherCode = voucher.code;
    voucherId = voucher.id;
  }

  const total = subtotal + shippingFee - discount;

  try {
    const order = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra tồn kho theo lô (FEFO) và chuẩn bị các giao dịch trừ kho
      const deductions: Array<{
        productId: string;
        qtyFromThisBatch: number;
        batch: any;
      }> = [];

      let selectedBranchId: string | null = null;

      for (const item of cartItems) {
        let qtyNeeded = item.quantity;
        const now = new Date();
        const batches = await tx.inventoryBatch.findMany({
          where: {
            productId: item.productId,
            remainingQty: { gt: 0 },
            expiryDate: { gt: now },
          },
          orderBy: { expiryDate: "asc" }, // Sắp xếp theo hạn sử dụng tăng dần (FEFO)
        });

        const totalStock = batches.reduce((sum, b) => sum + b.remainingQty, 0);
        if (totalStock < qtyNeeded) {
          throw new Error(`Sản phẩm "${item.product.name}" đã hết hàng hoặc không đủ tồn kho (còn lại: ${totalStock}).`);
        }

        for (const batch of batches) {
          if (qtyNeeded <= 0) break;
          const qtyFromThisBatch = Math.min(batch.remainingQty, qtyNeeded);
          deductions.push({
            productId: item.productId,
            qtyFromThisBatch,
            batch,
          });
          qtyNeeded -= qtyFromThisBatch;
          if (!selectedBranchId) {
            selectedBranchId = batch.branchId;
          }
        }
      }

      // 2. Tạo đơn hàng
      const o = await tx.order.create({
        data: {
          userId: req.user!.userId,
          branchId: selectedBranchId,
          total,
          address,
          phone,
          status: "pending",
          provinceId,
          provinceName,
          districtId,
          districtName,
          wardId,
          wardName,
          streetAddress,
          addressType,
          shippingFee,
          discount,
          voucherCode: finalVoucherCode,
          items: {
            create: cartItems.map((ci) => ({
              productId: ci.productId,
              quantity: ci.quantity,
              price: ci.product.price,
            })),
          },
        },
      });

      // 2b. Tạo phiếu giao hàng (DeliveryOrder) mặc định cho đơn hàng mới
      await tx.deliveryOrder.create({
        data: {
          orderId: o.id,
          shipping_provider: "TikiFast",
          tracking_number: `TK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          shipping_fee: shippingFee,
          status: "PENDING",
          estimated_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 ngày sau
        },
      });

      // 3. Thực hiện trừ kho, cập nhật BranchProduct và ghi Ledger (SALE)
      for (const d of deductions) {
        // Giảm số lượng còn lại trong lô hàng
        await tx.inventoryBatch.update({
          where: { id: d.batch.id },
          data: { remainingQty: { decrement: d.qtyFromThisBatch } },
        });

        // Giảm số lượng tồn kho trên BranchProduct
        const bp = await tx.branchProduct.update({
          where: {
            branchId_productId: {
              branchId: d.batch.branchId,
              productId: d.productId,
            },
          },
          data: { stock: { decrement: d.qtyFromThisBatch } },
        });

        // Ghi sổ cái hoạt động xuất kho do bán hàng (SALE)
        await tx.inventoryLedger.create({
          data: {
            productId: d.productId,
            branchId: d.batch.branchId,
            batchId: d.batch.id,
            movementType: "SALE",
            qtyChange: -d.qtyFromThisBatch,
            balanceAfter: bp.stock,
            sourceDocId: o.id,
          },
        });
      }

      // 4. Xóa cartItems đã đặt hàng
      await tx.cartItem.deleteMany({
        where: { userId: req.user!.userId, id: { in: cartItems.map((c) => c.id) } },
      });

      // 5. Cập nhật voucher đã sử dụng
      if (voucherId && finalVoucherCode) {
        await tx.voucher.update({
          where: { id: voucherId },
          data: { used_count: { increment: 1 } },
        });

        await tx.userVoucherHistory.create({
          data: {
            userId: req.user!.userId,
            voucherId: voucherId,
          },
        });
      }

      return o;
    });

    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true } } },
    });
    res.status(201).json(full);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Đặt hàng thất bại do lỗi tồn kho." });
  }
});

/**
 * @openapi
 * /api/orders/{id}/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Khách hủy đơn (chỉ khi chờ xác nhận / đã xác nhận)
 */
router.post("/:id/cancel", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!order) {
    res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    return;
  }
  if (order.status === "cancelled") {
    res.status(400).json({ error: "Đơn hàng đã được hủy trước đó" });
    return;
  }
  if (order.status !== "pending" && order.status !== "confirmed") {
    res.status(400).json({
      error: "Không thể hủy đơn ở trạng thái này. Đơn đã chuyển sang giao hàng — vui lòng liên hệ hỗ trợ.",
    });
    return;
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "cancelled" },
    include: { items: { include: { product: true } } },
  });
  res.json(updated);
});

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Chi tiết đơn hàng
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
    include: {
      items: { include: { product: true } },
    },
  });
  if (!order) {
    res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    return;
  }
  res.json(order);
});

export default router;
