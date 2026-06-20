import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

const addressSchema = z.object({
  provinceId: z.string().min(1, "Vui lòng chọn Tỉnh/Thành phố"),
  provinceName: z.string().min(1, "Vui lòng chọn Tỉnh/Thành phố"),
  districtId: z.string().min(1, "Vui lòng chọn Quận/Huyện"),
  districtName: z.string().min(1, "Vui lòng chọn Quận/Huyện"),
  wardId: z.string().min(1, "Vui lòng chọn Phường/Xã"),
  wardName: z.string().min(1, "Vui lòng chọn Phường/Xã"),
  streetAddress: z.string().min(5, "Địa chỉ cụ thể tối thiểu phải có 5 ký tự"),
  addressType: z.enum(["HOME", "OFFICE"]).default("HOME"),
  isDefault: z.boolean().default(false),
});

// GET /api/user/addresses - List all saved addresses
router.get("/", async (req, res) => {
  try {
    const list = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch addresses" });
  }
});

// POST /api/user/addresses - Create new address
router.post("/", async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.userId;
  const count = await prisma.address.count({ where: { userId } });
  let { isDefault } = parsed.data;

  // If first address, force it as default
  if (count === 0) {
    isDefault = true;
  }

  try {
    const newAddress = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        // Reset all other default flags
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return await tx.address.create({
        data: {
          ...parsed.data,
          isDefault,
          userId,
        },
      });
    });

    res.status(201).json(newAddress);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create address" });
  }
});

// PUT /api/user/addresses/:id - Update existing address
router.put("/:id", async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation", details: parsed.error.flatten() });
    return;
  }

  const { id } = req.params;
  const userId = req.user!.userId;

  const existing = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy địa chỉ" });
    return;
  }

  const { isDefault } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId, NOT: { id } },
          data: { isDefault: false },
        });
      }

      return await tx.address.update({
        where: { id },
        data: parsed.data,
      });
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update address" });
  }
});

// PATCH /api/user/addresses/:id/default - Set default address
router.patch("/:id/default", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const existing = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy địa chỉ" });
    return;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      return await tx.address.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to set default address" });
  }
});

// DELETE /api/user/addresses/:id - Delete address
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.userId;

  const existing = await prisma.address.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy địa chỉ" });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id },
      });

      // If deleted address was default, make the next latest address default
      if (existing.isDefault) {
        const nextDefault = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        if (nextDefault) {
          await tx.address.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }
    });

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete address" });
  }
});

export default router;
