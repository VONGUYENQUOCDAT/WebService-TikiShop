import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

const createReturnSchema = z.object({
  order_id: z.string().min(1),
  reason: z.string().min(5, "Lý do trả hàng phải có ít nhất 5 ký tự"),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        return_quantity: z.coerce.number().int().min(1),
      })
    )
    .min(1, "Cần ít nhất 1 sản phẩm để trả"),
});

/**
 * @openapi
 * /api/returns:
 *   post:
 *     tags: [Returns]
 *     summary: Tạo yêu cầu trả hàng (Khách hàng)
 *     security: [{ bearerAuth: [] }]
 */
router.post("/", async (req, res) => {
  const parsed = createReturnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  const { order_id, reason, items } = parsed.data;
  const userId = req.user!.userId;

  try {
    // 1. Verify order exists, belongs to user and is delivered
    const order = await prisma.order.findUnique({
      where: { id: order_id },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      res.status(404).json({ error: "Không tìm thấy đơn hàng" });
      return;
    }

    if (order.userId !== userId) {
      res.status(403).json({ error: "Bạn không có quyền trả hàng đơn này" });
      return;
    }

    if (order.status !== "delivered" && order.status !== "completed") {
      res.status(400).json({
        error: "Chỉ có thể tạo yêu cầu trả hàng với đơn hàng đã giao thành công",
      });
      return;
    }

    // 2. Check for existing return request on this order
    const existingReturn = await prisma.returnRequest.findFirst({
      where: { orderId: order_id },
    });
    if (existingReturn) {
      res.status(409).json({
        error: "Đơn hàng này đã có yêu cầu trả hàng (ID: " + existingReturn.id + ")",
      });
      return;
    }

    // 3. Validate products and calculate refund_amount
    let refund_amount = 0;
    const validatedItems: { product_id: string; return_quantity: number; price: number }[] = [];

    for (const item of items) {
      const orderItem = order.items.find((oi) => oi.productId === item.product_id);
      if (!orderItem) {
        res.status(400).json({
          error: `Sản phẩm ID ${item.product_id} không có trong đơn hàng này`,
        });
        return;
      }
      if (item.return_quantity > orderItem.quantity) {
        res.status(400).json({
          error: `Số lượng trả (${item.return_quantity}) vượt quá số lượng đã mua (${orderItem.quantity}) của sản phẩm ${orderItem.product.name}`,
        });
        return;
      }
      refund_amount += orderItem.price * item.return_quantity;
      validatedItems.push({ product_id: item.product_id, return_quantity: item.return_quantity, price: orderItem.price });
    }

    // 4. Create ReturnRequest + ReturnItems in transaction
    const returnRequest = await prisma.$transaction(async (tx) => {
      const rr = await tx.returnRequest.create({
        data: {
          orderId: order_id,
          userId,
          reason,
          refund_amount,
          items: {
            create: validatedItems.map((vi) => ({
              productId: vi.product_id,
              return_quantity: vi.return_quantity,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, image: true, sku: true } } } },
          order: { select: { id: true, total: true, createdAt: true } },
        },
      });
      return rr;
    });

    res.status(201).json(returnRequest);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Không thể tạo yêu cầu trả hàng" });
  }
});

/**
 * @openapi
 * /api/returns:
 *   get:
 *     tags: [Returns]
 *     summary: Lấy danh sách yêu cầu trả hàng của user hiện tại
 */
router.get("/", async (req, res) => {
  const userId = req.user!.userId;
  try {
    const requests = await prisma.returnRequest.findMany({
      where: { userId },
      include: {
        order: { select: { id: true, total: true, createdAt: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, image: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Lỗi khi lấy danh sách yêu cầu trả hàng" });
  }
});

// Admin: Get all return requests (paginated, filtered by status)
router.get("/admin/list", adminRequired, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 15;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) {
    where.status = status;
  }

  try {
    const [items, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { id: true, total: true, createdAt: true } },
          user: { select: { id: true, name: true, email: true } },
          items: true,
        },
      }),
      prisma.returnRequest.count({ where }),
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
    res.status(500).json({ error: err.message || "Failed to fetch return requests" });
  }
});

// Admin: Get details of a single return request
router.get("/admin/:id", adminRequired, async (req, res) => {
  const id = req.params.id as string;
  try {
    const request = await prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, total: true, createdAt: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: { include: { product: true } },
      },
    });
    if (!request) {
      res.status(404).json({ error: "Return request not found" });
      return;
    }
    res.json(request);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch return request details" });
  }
});

// Admin: Approve a return request
router.post("/admin/:id/approve", adminRequired, async (req, res) => {
  const id = req.params.id as string;
  try {
    const updated = await prisma.returnRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to approve return request" });
  }
});

// Admin: Reject a return request
router.post("/admin/:id/reject", adminRequired, async (req, res) => {
  const id = req.params.id as string;
  try {
    const updated = await prisma.returnRequest.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reject return request" });
  }
});

// Admin: Confirm receiving items (receive return request) and update stock
router.post("/admin/:id/receive", adminRequired, async (req, res) => {
  const id = req.params.id as string;
  const { items } = req.body; // array of { product_id, return_quantity, condition }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.returnRequest.findUnique({
        where: { id },
        include: { order: true },
      });
      if (!request) {
        throw new Error("Không tìm thấy yêu cầu trả hàng");
      }

      // Update condition on return items and increment physical stock
      for (const item of items) {
        const returnItem = await tx.returnItem.findFirst({
          where: { returnRequestId: id, productId: item.product_id as string },
        });

        if (returnItem) {
          await tx.returnItem.update({
            where: { id: returnItem.id },
            data: { condition: item.condition },
          });
        }

        if (item.condition === "INTACT" && request.order.branchId) {
          const branchProduct = await tx.branchProduct.findUnique({
            where: {
              branchId_productId: {
                branchId: request.order.branchId,
                productId: item.product_id as string,
              },
            },
          });

          if (branchProduct) {
            await tx.branchProduct.update({
              where: { id: branchProduct.id },
              data: { stock: { increment: item.return_quantity } },
            });
          }
        }
      }

      // Mark return request as COMPLETED
      const updated = await tx.returnRequest.update({
        where: { id },
        data: { status: "COMPLETED" },
      });

      return updated;
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to receive returned items" });
  }
});

export default router;
