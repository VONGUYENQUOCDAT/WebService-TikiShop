import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const router = Router();

const listQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(20),
  category: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "bestseller"]).default("bestseller"),
});

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Danh sách sản phẩm (phân trang, lọc, tìm kiếm)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: category
 *         description: Slug danh mục
 *       - in: query
 *         name: q
 *         description: Từ khóa tìm kiếm
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, price_asc, price_desc, bestseller]
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm
 *       400:
 *         description: Query không hợp lệ
 */
router.get("/", async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  const { page, limit, category, q, sort } = parsed.data;
  const skip = (page - 1) * limit;

  const where: {
    category?: { slug: string };
    OR?: Array<{ name: { contains: string } } | { description: { contains: string } }>;
  } = {};
  if (category) where.category = { slug: category };
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term } },
      { description: { contains: term } },
    ];
  }

  let orderBy: { createdAt?: "desc" } | { price?: "asc" | "desc" } | { sold?: "desc" } = {
    sold: "desc",
  };
  if (sort === "newest") orderBy = { createdAt: "desc" };
  else if (sort === "price_asc") orderBy = { price: "asc" };
  else if (sort === "price_desc") orderBy = { price: "desc" };
  else if (sort === "bestseller") orderBy = { sold: "desc" };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
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
 * /api/products/slug/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Chi tiết sản phẩm theo slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get("/slug/:slug", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { category: true },
  });
  if (!product) {
    res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    return;
  }
  res.json(product);
});

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Chi tiết sản phẩm theo id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 *       404:
 *         description: Không tìm thấy sản phẩm
 */
router.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { category: true },
  });
  if (!product) {
    res.status(404).json({ error: "Không tìm thấy sản phẩm" });
    return;
  }
  res.json(product);
});

export default router;
