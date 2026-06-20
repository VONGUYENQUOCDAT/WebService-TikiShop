import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// GET /api/wishlist - Get all wishlisted products
router.get("/", async (req, res) => {
  try {
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.userId },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(wishlistItems.map((item) => item.product));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch wishlist" });
  }
});

// POST /api/wishlist - Add product to wishlist
router.post("/", async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    res.status(400).json({ error: "Vui lòng cung cấp productId" });
    return;
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ error: "Không tìm thấy sản phẩm" });
      return;
    }

    const item = await prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId: req.user!.userId,
          productId,
        },
      },
      update: {},
      create: {
        userId: req.user!.userId,
        productId,
      },
    });

    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add to wishlist" });
  }
});

// DELETE /api/wishlist/:productId - Remove product from wishlist
router.delete("/:productId", async (req, res) => {
  const { productId } = req.params;

  try {
    await prisma.wishlistItem.deleteMany({
      where: {
        userId: req.user!.userId,
        productId,
      },
    });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to remove from wishlist" });
  }
});

export default router;
