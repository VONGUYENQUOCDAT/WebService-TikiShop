import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";
import { VoucherService } from "../services/voucherService.js";
import { NotificationService } from "../services/notificationService.js";
import { payos } from "../lib/payos.js";

const router = Router();
router.use(authRequired);

const checkoutSchema = z.object({
  address: z.string().min(5).optional(),
  phone: z.string().min(8).optional(),
  addressId: z.string().optional(),
  paymentMethod: z.enum(["COD", "ONLINE"]).default("COD").optional(),
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
    addressId,
    paymentMethod,
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

  // Retrieve user to fetch backup phone
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user!.userId }
  });

  let finalAddress = address;
  let finalPhone = phone;
  let finalProvinceId = provinceId;
  let finalProvinceName = provinceName;
  let finalDistrictId = districtId;
  let finalDistrictName = districtName;
  let finalWardId = wardId;
  let finalWardName = wardName;
  let finalStreetAddress = streetAddress;
  let finalAddressType = addressType;

  if (addressId) {
    const savedAddress = await prisma.address.findFirst({
      where: { id: addressId, userId: req.user!.userId }
    });
    if (!savedAddress) {
      res.status(400).json({ error: "Địa chỉ nhận hàng không hợp lệ" });
      return;
    }
    finalAddress = `${savedAddress.streetAddress}, ${savedAddress.wardName}, ${savedAddress.districtName}, ${savedAddress.provinceName}`;
    finalPhone = phone || currentUser?.phone || "";
    if (!finalPhone) {
      res.status(400).json({ error: "Vui lòng cung cấp số điện thoại liên hệ" });
      return;
    }
    finalProvinceId = savedAddress.provinceId;
    finalProvinceName = savedAddress.provinceName;
    finalDistrictId = savedAddress.districtId;
    finalDistrictName = savedAddress.districtName;
    finalWardId = savedAddress.wardId;
    finalWardName = savedAddress.wardName;
    finalStreetAddress = savedAddress.streetAddress;
    finalAddressType = savedAddress.addressType;
  } else {
    if (!finalAddress || finalAddress.trim().length < 5) {
      res.status(400).json({ error: "Địa chỉ giao hàng cần ít nhất 5 ký tự" });
      return;
    }
    if (!finalPhone || finalPhone.trim().length < 8) {
      res.status(400).json({ error: "Số điện thoại liên hệ cần ít nhất 8 ký tự" });
      return;
    }
    finalAddress = finalAddress.trim();
    finalPhone = finalPhone.trim();
  }

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

  // Validate stock limits before ordering
  for (const item of cartItems) {
    if (item.quantity > item.product.stock_quantity) {
      res.status(400).json({
        error: `Sản phẩm "${item.product.name}" không đủ hàng trong kho. Còn lại: ${item.product.stock_quantity} sản phẩm. Vui lòng giảm số lượng.`
      });
      return;
    }
  }

  let shippingFee = 0;
  if (finalProvinceId) {
    const codeNum = parseInt(finalProvinceId, 10);
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

  // Voucher validation and discount calculation via unified VoucherService
  let discount = 0;
  let finalVoucherCode: string | null = null;
  let voucherId: string | null = null;

  if (voucherCode && voucherCode.trim() !== "") {
    const vResult = await VoucherService.validateAndCalculateDiscount({
      code: voucherCode,
      orderAmount: subtotal,
      userId: req.user!.userId,
      shippingFee,
    });

    if (!vResult.isValid) {
      res.status(400).json({ error: vResult.error });
      return;
    }

    discount = vResult.discountAmount ?? 0;
    finalVoucherCode = vResult.voucher?.code ?? null;
    voucherId = vResult.voucher?.id ?? null;
  }

  const total = subtotal + shippingFee - discount;

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Find a branch that can fulfill the entire order (Strict Single Branch strategy)
      const branches = await tx.branch.findMany();
      let selectedBranchId: string | null = null;
      let deductions: Array<{
        productId: string;
        qtyFromThisBatch: number;
        batch: any;
      }> = [];

      for (const branch of branches) {
        let branchCanFulfillAll = true;
        const tempDeductions: typeof deductions = [];

        for (const item of cartItems) {
          let qtyNeeded = item.quantity;
          const now = new Date();
          const batches = await tx.inventoryBatch.findMany({
            where: {
              productId: item.productId,
              branchId: branch.id,
              remainingQty: { gt: 0 },
              expiryDate: { gt: now },
            },
            orderBy: { expiryDate: "asc" }, // FEFO
          });

          const totalStockInBranch = batches.reduce((sum, b) => sum + b.remainingQty, 0);
          if (totalStockInBranch < qtyNeeded) {
            branchCanFulfillAll = false;
            break;
          }

          for (const batch of batches) {
            if (qtyNeeded <= 0) break;
            const qtyFromThisBatch = Math.min(batch.remainingQty, qtyNeeded);
            tempDeductions.push({
              productId: item.productId,
              qtyFromThisBatch,
              batch,
            });
            qtyNeeded -= qtyFromThisBatch;
          }
        }

        if (branchCanFulfillAll) {
          selectedBranchId = branch.id;
          deductions = tempDeductions;
          break;
        }
      }

      if (!selectedBranchId) {
        throw new Error("Không có chi nhánh nào có đủ tồn kho cho toàn bộ đơn hàng của bạn. Vui lòng giảm bớt số lượng hoặc tách đơn hàng.");
      }

      // Generate unique payosOrderCode if method is ONLINE
      let payosOrderCode: number | null = null;
      if (paymentMethod === "ONLINE") {
        let code = Math.floor(Date.now() / 1000);
        while (await tx.order.findFirst({ where: { payosOrderCode: code } })) {
          code++;
        }
        payosOrderCode = code;
      }

      // Create the order
      const o = await tx.order.create({
        data: {
          userId: req.user!.userId,
          branchId: selectedBranchId,
          total,
          address: finalAddress!,
          phone: finalPhone!,
          status: "pending",
          provinceId: finalProvinceId,
          provinceName: finalProvinceName,
          districtId: finalDistrictId,
          districtName: finalDistrictName,
          wardId: finalWardId,
          wardName: finalWardName,
          streetAddress: finalStreetAddress,
          addressType: finalAddressType,
          shippingFee,
          discount,
          voucherCode: finalVoucherCode,
          paymentMethod: paymentMethod || "COD",
          paymentStatus: "PENDING",
          payosOrderCode,
          items: {
            create: cartItems.map((ci) => ({
              productId: ci.productId,
              quantity: ci.quantity,
              price: ci.product.price,
            })),
          },
        },
      });

      // Create DeliveryOrder
      await tx.deliveryOrder.create({
        data: {
          orderId: o.id,
          shipping_provider: "TikiFast",
          tracking_number: `TK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          shipping_fee: shippingFee,
          status: "PENDING",
          estimated_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
      });

      // Deduct stock, update BranchProduct, write ledgers
      for (const d of deductions) {
        await tx.inventoryBatch.update({
          where: { id: d.batch.id },
          data: { remainingQty: { decrement: d.qtyFromThisBatch } },
        });

        const bp = await tx.branchProduct.update({
          where: {
            branchId_productId: {
              branchId: d.batch.branchId,
              productId: d.productId,
            },
          },
          data: { stock: { decrement: d.qtyFromThisBatch } },
        });

        await tx.product.update({
          where: { id: d.productId },
          data: { stock_quantity: { decrement: d.qtyFromThisBatch } },
        });

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

      // Clear checked items from cart
      await tx.cartItem.deleteMany({
        where: { userId: req.user!.userId, id: { in: cartItems.map((c) => c.id) } },
      });

      // Increment voucher count
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

    let checkoutUrl: string | undefined = undefined;
    if (order.paymentMethod === "ONLINE" && order.payosOrderCode) {
      try {
        const paymentLink = await payos.paymentRequests.create({
          orderCode: order.payosOrderCode,
          amount: order.total,
          description: "Thanh toan don hang",
          returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/tai-khoan/don-hang/${order.id}?status=PAID`,
          cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/tai-khoan/don-hang/${order.id}?status=CANCELLED`,
        });
        checkoutUrl = paymentLink.checkoutUrl;
      } catch (e: any) {
        console.error("Lỗi tạo link thanh toán PayOS:", e);
      }
    }

    const full = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true } } },
    });
    // Create checkout notification
    await NotificationService.createNotification(
      order.userId,
      "Đặt hàng thành công",
      `Đơn hàng #${order.id} trị giá ${order.total.toLocaleString()}đ đã được đặt thành công.`
    );
    res.status(201).json({ ...full, checkoutUrl });
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

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Find all SALE ledgers for this order to roll back quantities
      const ledgers = await tx.inventoryLedger.findMany({
        where: {
          sourceDocId: order.id,
          movementType: "SALE",
        },
      });

      for (const ledger of ledgers) {
        const qtyReturned = Math.abs(ledger.qtyChange);

        // Revert batch remaining quantity
        await tx.inventoryBatch.update({
          where: { id: ledger.batchId },
          data: { remainingQty: { increment: qtyReturned } },
        });

        // Revert BranchProduct stock level
        const bp = await tx.branchProduct.update({
          where: {
            branchId_productId: {
              branchId: ledger.branchId,
              productId: ledger.productId,
            },
          },
          data: { stock: { increment: qtyReturned } },
        });

        await tx.product.update({
          where: { id: ledger.productId },
          data: { stock_quantity: { increment: qtyReturned } },
        });

        // Record adjustment log in ledger
        await tx.inventoryLedger.create({
          data: {
            productId: ledger.productId,
            branchId: ledger.branchId,
            batchId: ledger.batchId,
            movementType: "ADJUSTMENT",
            qtyChange: qtyReturned,
            balanceAfter: bp.stock,
            sourceDocId: order.id,
          },
        });
      }

      // Cancel delivery order if any
      await tx.deliveryOrder.updateMany({
        where: { orderId: order.id },
        data: { status: "CANCELLED" },
      });

      return await tx.order.update({
        where: { id: order.id },
        data: { status: "cancelled" },
        include: { items: { include: { product: true } } },
      });
    });

    // Create cancellation notification
    await NotificationService.createNotification(
      order.userId,
      "Đơn hàng đã hủy",
      `Đơn hàng #${order.id} của bạn đã bị hủy thành công.`
    );
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Hủy đơn hàng thất bại." });
  }
});

/**
 * @openapi
 * /api/orders/{id}/pay:
 *   post:
 *     tags: [Orders]
 *     summary: Thanh toán giả lập (Online Payment Simulator)
 */
router.post("/:id/pay", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!order) {
    res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    return;
  }
  if (order.paymentStatus === "PAID") {
    res.status(400).json({ error: "Đơn hàng đã được thanh toán trước đó" });
    return;
  }
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      paymentReference: `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "confirmed", // Auto‑confirm order on payment
    },
    include: { items: { include: { product: true } } },
  });
  // Create payment notification
  await NotificationService.createNotification(
    order.userId,
    "Thanh toán thành công",
    `Đơn hàng #${order.id} đã được thanh toán trực tuyến thành công.`
  );
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

/**
 * @openapi
 * /api/orders/{id}/verify-payos:
 *   post:
 *     tags: [Orders]
 *     summary: Xác thực giao dịch với PayOS và đồng bộ trạng thái
 */
router.post("/:id/verify-payos", async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!order) {
      res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      return;
    }

    if (order.paymentStatus === "PAID") {
      res.json(order);
      return;
    }

    if (order.paymentMethod === "ONLINE" && order.payosOrderCode) {
      const payosInfo = await payos.paymentRequests.get(order.payosOrderCode);
      if (payosInfo && payosInfo.status === "PAID") {
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "PAID",
            paymentReference: payosInfo.transactions?.[0]?.reference || `PAYOS-${payosInfo.id}`,
            status: "confirmed",
          },
          include: { items: { include: { product: true } } },
        });

        await NotificationService.createNotification(
          order.userId,
          "Thanh toán thành công",
          `Đơn hàng #${order.id} đã được thanh toán trực tuyến thành công qua PayOS.`
        );
        res.json(updated);
        return;
      }
    }

    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Xác thực thanh toán thất bại." });
  }
});

/**
 * @openapi
 * /api/orders/{id}/payos-link:
 *   get:
 *     tags: [Orders]
 *     summary: Lấy link thanh toán PayOS mới cho đơn hàng chưa thanh toán
 */
router.get("/:id/payos-link", async (req, res) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!order) {
      res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      return;
    }
    if (order.paymentStatus === "PAID") {
      res.status(400).json({ error: "Đơn hàng đã được thanh toán" });
      return;
    }
    if (order.paymentMethod !== "ONLINE") {
      res.status(400).json({ error: "Đơn hàng không chọn phương thức thanh toán trực tuyến" });
      return;
    }

    let code = order.payosOrderCode;
    if (!code) {
      code = Math.floor(Date.now() / 1000);
      while (await prisma.order.findFirst({ where: { payosOrderCode: code } })) {
        code++;
      }
      await prisma.order.update({
        where: { id: order.id },
        data: { payosOrderCode: code },
      });
    }

    const paymentLink = await payos.paymentRequests.create({
      orderCode: code,
      amount: order.total,
      description: "Thanh toan don hang",
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/tai-khoan/don-hang/${order.id}?status=PAID`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5174'}/tai-khoan/don-hang/${order.id}?status=CANCELLED`,
    });

    res.json({ checkoutUrl: paymentLink.checkoutUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Tạo link thanh toán thất bại." });
  }
});

export default router;
