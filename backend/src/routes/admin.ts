import { Router } from "express";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalizeProductSlug } from "../lib/slug.js";
import { adminRequired, authRequired } from "../middleware/auth.js";

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

const router = Router();
router.use(authRequired);
router.use(adminRequired);

/** Chỉ đơn đã giao mới tính vào doanh thu / số lượng bán trong thống kê admin. */
const REVENUE_STATUS = "delivered" as const;

const paginationQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;

const ordersListQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().optional(),
});

const orderStatusBody = z.object({
  status: z.enum(ORDER_STATUSES),
});

const usersListQuery = paginationQuery.extend({
  q: z.string().optional(),
});

const userRoleBody = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

const adminUserCreateBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(200),
  phone: z.string().max(40).nullable().optional(),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
});

const adminUserPatchBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Cần ít nhất một trường cập nhật" });

const adminUserPasswordBody = z.object({
  password: z.string().min(6),
});

const productCreateBody = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch"),
  description: z.string().min(1).max(20000),
  price: z.coerce.number().int().min(0),
  listPrice: z.coerce.number().int().min(0).nullable().optional(),
  image: z.string().min(1).max(2000),
  rating: z.coerce.number().min(0).max(5).optional().default(4.5),
  reviewCount: z.coerce.number().int().min(0).optional().default(0),
  sold: z.coerce.number().int().min(0).optional().default(0),
  badge: z.string().max(80).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  categoryId: z.string().min(1),
});

const productsListQuery = paginationQuery.extend({
  q: z.string().optional(),
  categoryId: z.string().optional(),
});

const productPatchBody = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch")
      .optional(),
    description: z.string().min(1).max(20000).optional(),
    price: z.coerce.number().int().min(0).optional(),
    listPrice: z.coerce.number().int().min(0).nullable().optional(),
    image: z.string().min(1).max(2000).optional(),
    rating: z.coerce.number().min(0).max(5).optional(),
    reviewCount: z.coerce.number().int().min(0).optional(),
    sold: z.coerce.number().int().min(0).optional(),
    badge: z.string().max(80).nullable().optional(),
    brand: z.string().max(120).nullable().optional(),
    tags: z.string().max(500).nullable().optional(),
    categoryId: z.string().min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Cần ít nhất một trường cập nhật" });

const categoryCreateBody = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch"),
  icon: z.string().max(80).nullable().optional(),
});

const categoryPatchBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    slug: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch")
      .optional(),
    icon: z.string().max(80).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Cần ít nhất một trường cập nhật" });

/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Thống kê tổng quan (ADMIN)
 */
router.get("/stats", async (_req, res) => {
  const now = new Date();
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);
  const d7 = new Date(now);
  d7.setDate(d7.getDate() - 7);

  const [
    userCount,
    orderCount,
    productCount,
    categoryCount,
    revenueAgg,
    revenue30,
    newUsers7,
    statusGroups,
    topGroups,
    recentOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.product.count(),
    prisma.category.count(),
    prisma.order.aggregate({ where: { status: REVENUE_STATUS }, _sum: { total: true } }),
    prisma.order.aggregate({
      where: { status: REVENUE_STATUS, createdAt: { gte: d30 } },
      _sum: { total: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: REVENUE_STATUS } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
  ]);

  const productIds = topGroups.map((g) => g.productId);
  const topProductsMeta =
    productIds.length === 0
      ? []
      : await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, slug: true },
        });
  const metaById = new Map(topProductsMeta.map((p) => [p.id, p]));

  const ordersByStatus = statusGroups
    .map((g) => ({ status: g.status, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const topProducts = topGroups.map((g) => {
    const m = metaById.get(g.productId);
    return {
      productId: g.productId,
      name: m?.name ?? "(đã xóa?)",
      slug: m?.slug ?? "",
      quantitySold: g._sum.quantity ?? 0,
    };
  });

  res.json({
    users: userCount,
    orders: orderCount,
    products: productCount,
    categories: categoryCount,
    revenueTotal: revenueAgg._sum.total ?? 0,
    revenueLast30Days: revenue30._sum.total ?? 0,
    newUsersLast7Days: newUsers7,
    ordersByStatus,
    topProducts,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      userEmail: o.user.email,
      userName: o.user.name,
    })),
  });
});

/**
 * @openapi
 * /api/admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: Danh sách đơn hàng toàn hệ thống
 */
router.get("/orders", async (req, res) => {
  const parsed = ordersListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  const { page, limit, status, q } = parsed.data;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;
  const term = q?.trim();
  if (term) {
    where.OR = [
      { id: { contains: term } },
      { phone: { contains: term } },
      { address: { contains: term } },
      { user: { email: { contains: term } } },
      { user: { name: { contains: term } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, image: true } },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * @openapi
 * /api/admin/orders/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Chi tiết đơn hàng (ADMIN — mọi đơn)
 */
router.get("/orders/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, email: true, name: true, phone: true } },
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
 * /api/admin/orders/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Cập nhật trạng thái đơn hàng
 */
router.patch("/orders/:id", async (req, res) => {
  const parsed = orderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const { status } = parsed.data;
  try {
    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        user: { select: { id: true, email: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, image: true } },
          },
        },
      },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Không tìm thấy đơn hàng" });
  }
});

/**
 * @openapi
 * /api/admin/orders/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Xóa đơn hàng (kèm chi tiết dòng đơn)
 */
router.delete("/orders/:id", async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Không tìm thấy đơn hàng" });
  }
});

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Danh sách người dùng
 */
router.get("/users", async (req, res) => {
  const parsed = usersListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  const { page, limit, q } = parsed.data;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};
  const term = q?.trim();
  if (term) {
    where.OR = [
      { email: { contains: term } },
      { name: { contains: term } },
      { phone: { contains: term } },
      { id: { contains: term } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * @openapi
 * /api/admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Tạo người dùng (ADMIN)
 */
router.post("/users", async (req, res) => {
  const parsed = adminUserCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const { email, password, name, phone, role } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(400).json({ error: "Email đã được sử dụng" });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      name,
      phone: phone ?? null,
      role,
    },
    select: userPublicSelect,
  });
  res.status(201).json(user);
});

/**
 * @openapi
 * /api/admin/users/{id}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Đổi vai trò người dùng
 */
router.patch("/users/:id/role", async (req, res) => {
  const parsed = userRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const { role } = parsed.data;
  const targetId = req.params.id;
  if (targetId === req.user!.userId && role === "USER") {
    res.status(400).json({ error: "Không thể hạ cấp chính tài khoản đang đăng nhập" });
    return;
  }
  try {
    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Không tìm thấy người dùng" });
  }
});

/**
 * @openapi
 * /api/admin/users/{id}/password:
 *   patch:
 *     tags: [Admin]
 *     summary: Đặt lại mật khẩu người dùng
 */
router.patch("/users/:id/password", async (req, res) => {
  const parsed = adminUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const hash = await bcrypt.hash(parsed.data.password, 10);
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hash },
      select: userPublicSelect,
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Không tìm thấy người dùng" });
  }
});

/**
 * @openapi
 * /api/admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Cập nhật hồ sơ người dùng
 */
router.patch("/users/:id", async (req, res) => {
  const parsed = adminUserPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (data.email) {
    const clash = await prisma.user.findFirst({
      where: { email: data.email, NOT: { id: req.params.id } },
      select: { id: true },
    });
    if (clash) {
      res.status(400).json({ error: "Email đã được tài khoản khác sử dụng" });
      return;
    }
  }
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userPublicSelect,
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Không tìm thấy người dùng" });
  }
});

/**
 * @openapi
 * /api/admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Xóa người dùng (không có đơn hàng)
 */
router.delete("/users/:id", async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user!.userId) {
    res.status(400).json({ error: "Không thể xóa chính tài khoản đang đăng nhập" });
    return;
  }
  const orderCount = await prisma.order.count({ where: { userId: targetId } });
  if (orderCount > 0) {
    res.status(400).json({ error: "Không thể xóa: người dùng còn đơn hàng trong hệ thống" });
    return;
  }
  try {
    await prisma.user.delete({ where: { id: targetId } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Không tìm thấy người dùng" });
  }
});

/**
 * @openapi
 * /api/admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: Danh sách sản phẩm (quản trị)
 */
router.get("/products", async (req, res) => {
  const parsed = productsListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  const { page, limit, q, categoryId } = parsed.data;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {};
  if (categoryId) where.categoryId = categoryId;
  const term = q?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term } },
      { slug: { contains: term } },
      { description: { contains: term } },
      { brand: { contains: term } },
    ];
  }

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
});

/**
 * @openapi
 * /api/admin/products:
 *   post:
 *     tags: [Admin]
 *     summary: Tạo sản phẩm
 */
router.post("/products", async (req, res) => {
  const body = { ...(req.body as Record<string, unknown>) };
  if (typeof body.slug === "string") body.slug = normalizeProductSlug(body.slug);
  if (typeof body.description === "string" && body.description.trim() === "") {
    body.description = "Đang cập nhật mô tả.";
  }
  const parsed = productCreateBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const cat = await prisma.category.findUnique({ where: { id: d.categoryId } });
  if (!cat) {
    res.status(400).json({ error: "Danh mục không tồn tại" });
    return;
  }
  const slugClash = await prisma.product.findUnique({ where: { slug: d.slug } });
  if (slugClash) {
    res.status(400).json({ error: "Slug đã tồn tại" });
    return;
  }
  const created = await prisma.product.create({
    data: {
      name: d.name,
      slug: d.slug,
      description: d.description,
      price: d.price,
      listPrice: d.listPrice ?? null,
      image: d.image,
      rating: d.rating,
      reviewCount: d.reviewCount,
      sold: d.sold,
      badge: d.badge ?? null,
      brand: d.brand ?? null,
      tags: d.tags ?? null,
      categoryId: d.categoryId,
    },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  res.status(201).json(created);
});

/**
 * @openapi
 * /api/admin/products/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Cập nhật sản phẩm
 */
router.patch("/products/:id", async (req, res) => {
  const body = { ...(req.body as Record<string, unknown>) };
  if (typeof body.slug === "string") {
    const n = normalizeProductSlug(body.slug);
    if (n === "") delete body.slug;
    else body.slug = n;
  }
  const parsed = productPatchBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (data.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!cat) {
      res.status(400).json({ error: "Danh mục không tồn tại" });
      return;
    }
  }
  if (data.slug) {
    const clash = await prisma.product.findFirst({
      where: { slug: data.slug, NOT: { id: req.params.id } },
      select: { id: true },
    });
    if (clash) {
      res.status(400).json({ error: "Slug đã được sản phẩm khác sử dụng" });
      return;
    }
  }
  try {
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Không tìm thấy sản phẩm" });
  }
});

/**
 * @openapi
 * /api/admin/products/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Xóa sản phẩm (chỉ khi chưa có trong đơn hàng)
 */
router.delete("/products/:id", async (req, res) => {
  const orderLineCount = await prisma.orderItem.count({ where: { productId: req.params.id } });
  if (orderLineCount > 0) {
    res.status(400).json({
      error: "Không thể xóa: sản phẩm đã xuất hiện trong đơn hàng. Có thể chỉnh slug/tên hoặc ẩn bằng cách đổi danh mục nội bộ.",
    });
    return;
  }
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Không tìm thấy sản phẩm" });
  }
});

/**
 * @openapi
 * /api/admin/categories:
 *   get:
 *     tags: [Admin]
 *     summary: Danh sách danh mục
 */
router.get("/categories", async (_req, res) => {
  const items = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });
  res.json({
    items: items.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      productCount: c._count.products,
    })),
  });
});

/**
 * @openapi
 * /api/admin/categories:
 *   post:
 *     tags: [Admin]
 *     summary: Tạo danh mục
 */
router.post("/categories", async (req, res) => {
  const parsed = categoryCreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  try {
    const c = await prisma.category.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        icon: parsed.data.icon ?? null,
      },
    });
    res.status(201).json({ ...c, productCount: 0 });
  } catch {
    res.status(400).json({ error: "Slug hoặc dữ liệu trùng — không tạo được danh mục" });
  }
});

/**
 * @openapi
 * /api/admin/categories/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Cập nhật danh mục
 */
router.patch("/categories/:id", async (req, res) => {
  const parsed = categoryPatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (data.slug) {
    const clash = await prisma.category.findFirst({
      where: { slug: data.slug, NOT: { id: req.params.id } },
      select: { id: true },
    });
    if (clash) {
      res.status(400).json({ error: "Slug đã được danh mục khác sử dụng" });
      return;
    }
  }
  try {
    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data,
      include: { _count: { select: { products: true } } },
    });
    res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      icon: updated.icon,
      productCount: updated._count.products,
    });
  } catch {
    res.status(404).json({ error: "Không tìm thấy danh mục" });
  }
});

/**
 * @openapi
 * /api/admin/categories/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Xóa danh mục (chỉ khi không còn sản phẩm)
 */
router.delete("/categories/:id", async (req, res) => {
  const cnt = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (cnt > 0) {
    res.status(400).json({ error: `Không thể xóa: còn ${cnt} sản phẩm thuộc danh mục này` });
    return;
  }
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Không tìm thấy danh mục" });
  }
});

// Admin: List deliveries
const deliveriesListQuery = paginationQuery.extend({
  status: z.string().optional(),
  q: z.string().optional(),
});

router.get("/deliveries", async (req, res) => {
  const parsed = deliveriesListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  const { page, limit, status, q } = parsed.data;
  const skip = (page - 1) * limit;

  const where: Prisma.DeliveryOrderWhereInput = {};
  if (status) where.status = status;
  const term = q?.trim();
  if (term) {
    where.OR = [
      { orderId: { contains: term } },
      { tracking_number: { contains: term } },
      { shipping_provider: { contains: term } },
      { order: { user: { name: { contains: term } } } },
      { order: { user: { phone: { contains: term } } } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
      prisma.deliveryOrder.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch deliveries" });
  }
});

// Admin: Update delivery status
const deliveryStatusPatch = z.object({
  status: z.string(),
});

router.patch("/deliveries/:id/status", async (req, res) => {
  const { id } = req.params;
  const parsed = deliveryStatusPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const { status } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const doRow = await tx.deliveryOrder.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!doRow) {
        throw new Error("Không tìm thấy phiếu giao hàng");
      }

      const order = doRow.order;
      const orderBranchId = order.branchId;

      const updateData: any = { status };
      if (status === "DELIVERED") {
        updateData.actual_delivery_date = new Date();
      }

      const updated = await tx.deliveryOrder.update({
        where: { id },
        data: updateData,
      });

      if (status === "DELIVERED") {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "completed" },
        });
      }

      return updated;
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update delivery status" });
  }
});

// =====================================================
// ADMIN — SHOP MANAGEMENT (Multi-Vendor)
// =====================================================

/** GET /api/admin/shops — Danh sách gian hàng (phân trang, filter theo status) */
router.get("/shops", async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const status = req.query.status as string | undefined;
  const q = req.query.q as string | undefined;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { shopName: { contains: q } },
      { owner: { email: { contains: q } } },
      { owner: { name: { contains: q } } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { id: true, email: true, name: true, phone: true } } },
      }),
      prisma.shop.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch shops" });
  }
});

/** PATCH /api/admin/shops/:id/approve — Duyệt gian hàng */
router.patch("/shops/:id/approve", async (req, res) => {
  const shopId = req.params.id as string;

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      res.status(404).json({ error: "Không tìm thấy gian hàng" });
      return;
    }
    if (shop.status === "APPROVED") {
      res.status(400).json({ error: "Gian hàng đã được duyệt trước đó" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: { status: "APPROVED", rejectReason: null },
        include: { owner: { select: { id: true, email: true, name: true, phone: true } } },
      });

      await tx.user.update({
        where: { id: shop.ownerId },
        data: { role: "SELLER" },
      });

      return updatedShop;
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to approve shop" });
  }
});

/** PATCH /api/admin/shops/:id/reject — Từ chối gian hàng */
router.patch("/shops/:id/reject", async (req, res) => {
  const shopId = req.params.id as string;
  const { reason } = req.body as { reason?: string };

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      res.status(404).json({ error: "Không tìm thấy gian hàng" });
      return;
    }

    const updatedShop = await prisma.shop.update({
      where: { id: shopId },
      data: { status: "REJECTED", rejectReason: reason || null },
      include: { owner: { select: { id: true, email: true, name: true, phone: true } } },
    });

    res.json(updatedShop);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reject shop" });
  }
});

export default router;
