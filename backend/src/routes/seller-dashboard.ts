import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";
import { normalizeProductSlug } from "../lib/slug.js";
import { NotificationService } from "../services/notificationService.js";

const router = Router();
router.use(authRequired);

// Middleware to restrict access to approved sellers only
async function sellerRequired(req: any, res: any, next: any) {
  const userId = req.user!.userId;
  const shop = await prisma.shop.findUnique({
    where: { ownerId: userId },
  });
  if (!shop || shop.status !== "APPROVED") {
    res.status(403).json({ error: "Quyền truy cập bị từ chối: Gian hàng của bạn chưa được duyệt" });
    return;
  }
  req.sellerShop = shop;
  next();
}

router.use(sellerRequired);

// 1. GET /api/seller-dashboard/stats - Sales and product statistics
router.get("/stats", async (req: any, res) => {
  const shop = req.sellerShop;

  try {
    const productsCount = await prisma.product.count({
      where: { shopId: shop.id },
    });

    const orders = await prisma.order.findMany({
      where: {
        items: { some: { product: { shopId: shop.id } } },
      },
      include: {
        items: {
          where: { product: { shopId: shop.id } },
        },
      },
    });

    const totalOrdersCount = orders.length;

    // Sum revenue from delivered or completed orders
    const completedOrders = orders.filter(o => ["delivered", "completed"].includes(o.status.toLowerCase()));
    let totalRevenue = 0;
    completedOrders.forEach((o) => {
      o.items.forEach((item) => {
        totalRevenue += item.quantity * item.price;
      });
    });

    // Stock visibility summary
    const branchProducts = await prisma.branchProduct.findMany({
      where: { product: { shopId: shop.id } },
      select: { stock: true },
    });
    const totalStock = branchProducts.reduce((sum, bp) => sum + bp.stock, 0);

    res.json({
      shopName: shop.shopName,
      status: shop.status,
      productsCount,
      totalOrdersCount,
      totalRevenue,
      totalStock,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch stats" });
  }
});

// 2. PUT /api/seller-dashboard/shop-profile - Update shop details
const shopProfileSchema = z.object({
  shopName: z.string().min(2),
  businessAddress: z.string().min(5),
  taxCode: z.string().optional().nullable(),
  idCard: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
});

router.put("/shop-profile", async (req: any, res) => {
  const shop = req.sellerShop;
  const parsed = shopProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  try {
    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: parsed.data,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update profile" });
  }
});

// 3. GET /api/seller-dashboard/products - List seller's products
router.get("/products", async (req: any, res) => {
  const shop = req.sellerShop;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = { shopId: shop.id };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { brand: { contains: q } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch products" });
  }
});

// 4. POST /api/seller-dashboard/products - Create a product
const productSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().min(1).max(20000),
  price: z.coerce.number().int().min(0),
  listPrice: z.coerce.number().int().min(0).nullable().optional(),
  image: z.string().min(1).max(2000),
  brand: z.string().max(120).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  categoryId: z.string().min(1),
  badge: z.string().max(80).nullable().optional(),
});

router.post("/products", async (req: any, res) => {
  const shop = req.sellerShop;
  const body = { ...req.body };
  if (typeof body.slug === "string") body.slug = normalizeProductSlug(body.slug);
  
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  const { categoryId, slug } = parsed.data;

  try {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) {
      res.status(400).json({ error: "Danh mục không tồn tại" });
      return;
    }

    const clash = await prisma.product.findUnique({ where: { slug } });
    if (clash) {
      res.status(400).json({ error: "Đường dẫn sản phẩm (slug) đã được sử dụng" });
      return;
    }

    const created = await prisma.product.create({
      data: {
        ...parsed.data,
        shopId: shop.id,
      },
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create product" });
  }
});

// 5. PUT /api/seller-dashboard/products/:id - Update product
router.put("/products/:id", async (req: any, res) => {
  const shop = req.sellerShop;
  const { id } = req.params;
  const body = { ...req.body };
  if (typeof body.slug === "string") body.slug = normalizeProductSlug(body.slug);

  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  try {
    const existing = await prisma.product.findFirst({
      where: { id, shopId: shop.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Không tìm thấy sản phẩm hoặc bạn không có quyền sửa sản phẩm này" });
      return;
    }

    const { categoryId, slug } = parsed.data;

    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) {
      res.status(400).json({ error: "Danh mục không tồn tại" });
      return;
    }

    const clash = await prisma.product.findFirst({
      where: { slug, NOT: { id } },
    });
    if (clash) {
      res.status(400).json({ error: "Đường dẫn sản phẩm (slug) đã được sử dụng" });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: parsed.data,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update product" });
  }
});

// 6. DELETE /api/seller-dashboard/products/:id - Delete product
router.delete("/products/:id", async (req: any, res) => {
  const shop = req.sellerShop;
  const { id } = req.params;

  try {
    const existing = await prisma.product.findFirst({
      where: { id, shopId: shop.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Không tìm thấy sản phẩm hoặc bạn không có quyền xóa sản phẩm này" });
      return;
    }

    // Check if the product has been ordered
    const orderItemsCount = await prisma.orderItem.count({
      where: { productId: id },
    });
    if (orderItemsCount > 0) {
      res.status(400).json({ error: "Không thể xóa sản phẩm đã có khách đặt mua" });
      return;
    }

    await prisma.product.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete product" });
  }
});

// 7. GET /api/seller-dashboard/orders - List orders for seller
router.get("/orders", async (req: any, res) => {
  const shop = req.sellerShop;

  try {
    const orders = await prisma.order.findMany({
      where: {
        items: { some: { product: { shopId: shop.id } } },
      },
      include: {
        items: {
          where: { product: { shopId: shop.id } },
          include: { product: true },
        },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch orders" });
  }
});

// 8. PATCH /api/seller-dashboard/orders/:id/status - Update order status
const orderStatusSchema = z.object({
  status: z.enum(["confirmed", "processing", "shipped", "delivered", "cancelled"]),
});

router.patch("/orders/:id/status", async (req: any, res) => {
  const shop = req.sellerShop;
  const { id } = req.params;

  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  const { status } = parsed.data;

  try {
    // Verify order exists and contains items from this seller
    const order = await prisma.order.findFirst({
      where: {
        id,
        items: { some: { product: { shopId: shop.id } } },
      },
    });

    if (!order) {
      res.status(404).json({ error: "Không tìm thấy đơn hàng chứa sản phẩm của bạn" });
      return;
    }

    if (order.status === "cancelled") {
      res.status(400).json({ error: "Không thể thay đổi trạng thái của đơn hàng đã hủy" });
      return;
    }

    // Update order status
    const updated = await prisma.order.update({
      where: { id },
      data: { status },
    });

    // Sync delivery status if needed
    if (status === "shipped") {
      await prisma.deliveryOrder.updateMany({
        where: { orderId: id },
        data: { status: "SHIPPED" },
      });
    } else if (status === "delivered") {
      await prisma.deliveryOrder.updateMany({
        where: { orderId: id },
        data: { status: "DELIVERED", actual_delivery_date: new Date() },
      });
    }

    // Trigger notification to customer
    let notifyTitle = "Cập nhật đơn hàng";
    let notifyContent = `Đơn hàng #${order.id} đã chuyển sang trạng thái: ${status}`;
    if (status === "confirmed") {
      notifyTitle = "Đơn hàng được xác nhận";
      notifyContent = `Đơn hàng #${order.id} đã được xác nhận bởi gian hàng.`;
    } else if (status === "processing") {
      notifyTitle = "Đang đóng gói hàng";
      notifyContent = `Đơn hàng #${order.id} đang được chuẩn bị đóng gói.`;
    } else if (status === "shipped") {
      notifyTitle = "Đang giao hàng";
      notifyContent = `Đơn hàng #${order.id} đã được bàn giao cho đối tác vận chuyển.`;
    } else if (status === "delivered") {
      notifyTitle = "Giao hàng thành công";
      notifyContent = `Đơn hàng #${order.id} đã được giao thành công.`;
    } else if (status === "cancelled") {
      notifyTitle = "Đơn hàng đã hủy";
      notifyContent = `Đơn hàng #${order.id} của bạn đã bị hủy.`;
    }

    await NotificationService.createNotification(order.userId, notifyTitle, notifyContent);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update order status" });
  }
});

// 9. GET /api/seller-dashboard/stock - Stock visibility for seller
router.get("/stock", async (req: any, res) => {
  const shop = req.sellerShop;

  try {
    const stock = await prisma.branchProduct.findMany({
      where: {
        product: { shopId: shop.id },
      },
      include: {
        product: { select: { id: true, name: true, image: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { product: { name: "asc" } },
    });

    res.json(stock);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch stock levels" });
  }
});

export default router;
