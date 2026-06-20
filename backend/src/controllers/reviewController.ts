import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";
import { canUserReview } from "../services/reviewService.js";

const router = Router();

// Schema for creating a review
const createReviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  orderId: z.string().min(1),
});

/**
 * @openapi
 * /api/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Create a review for a product (customer only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReview'
 *     responses:
 *       201:
 *         description: Review created (awaiting admin approval)
 *       400:
 *         description: Validation / business rule error
 */
router.post("/", authRequired, async (req, res) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }
  const { productId, rating, comment, imageUrls, orderId } = parsed.data;
  const userId = req.user!.userId;

  try {
    // Verify the user bought the product in the specified order and order is COMPLETED
    const canReview = await canUserReview(productId, userId, orderId);
    if (!canReview) {
      res.status(400).json({ error: "User has not purchased this product in the given order or order not completed" });
      return;
    }

    // Ensure one review per order‑product per user
    const existing = await prisma.review.findFirst({
      where: { productId, userId, orderId },
    });
    if (existing) {
      res.status(409).json({ error: "Review already exists for this product in the given order" });
      return;
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId,
        orderId,
        rating,
        comment,
        imageUrls: JSON.stringify(imageUrls ?? []),
        status: "PENDING",
      },
    });
    res.status(201).json(review);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create review" });
  }
});

/**
 * @openapi
 * /api/products/{productId}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Get approved reviews for a product (public)
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated list of approved reviews
 */
router.get("/product/:productId", async (req, res) => {
  const { productId } = req.params;
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  const [reviews, total, ratingsGroup] = await Promise.all([
    prisma.review.findMany({
      where: { productId, status: "APPROVED" },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
      },
    }),
    prisma.review.count({ where: { productId, status: "APPROVED" } }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId, status: "APPROVED" },
      _count: { rating: true },
    }),
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratingsGroup.forEach((g: any) => {
    if (g.rating >= 1 && g.rating <= 5) {
      distribution[g.rating as 1 | 2 | 3 | 4 | 5] = g._count.rating;
    }
  });

  res.json({ reviews, total, page, pageSize, distribution });
});

/**
 * @openapi
 * /api/reviews/order/{orderId}:
 *   get:
 *     tags: [Reviews]
 *     summary: Get user's reviews for a specific order (customer only)
 *     security: [{ bearerAuth: [] }]
 */
router.get("/order/:orderId", authRequired, async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user!.userId;
  try {
    const reviews = await prisma.review.findMany({
      where: { orderId: orderId as string, userId: userId as string },
    });
    res.json(reviews);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch order reviews" });
  }
});

export default router;
