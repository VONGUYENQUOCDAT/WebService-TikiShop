import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ProcurementService } from "../services/procurementService.js";
import { InventoryService } from "../services/inventoryService.js";
import { POStatus } from "@prisma/client";

const router = Router();

// Zod validations
const supplierSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  contactName: z.string().optional().nullable(),
  phone: z.string().min(1),
  email: z.string().email(),
  address: z.string().min(1)
});

const poItemSchema = z.object({
  productId: z.string().optional(), // Nullable if creating a new product on-the-fly
  isNewProduct: z.boolean().optional().default(false),
  newProductData: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().min(1),
    price: z.coerce.number().int().min(0),
    image: z.string().min(1),
    categoryId: z.string().min(1),
    brand: z.string().optional().nullable(),
    tags: z.string().optional().nullable()
  }).optional(),
  quantityOrdered: z.coerce.number().int().min(1),
  pricePerUnit: z.coerce.number().int().min(0)
});

const poCreateSchema = z.object({
  supplierId: z.string().min(1),
  items: z.array(poItemSchema).min(1)
});

const grItemSchema = z.object({
  productId: z.string().min(1),
  qtyReceived: z.coerce.number().int().min(1),
  qtyDamaged: z.coerce.number().int().default(0)
});

const grCreateSchema = z.object({
  purchaseOrderId: z.string().min(1),
  branchId: z.string().min(1),
  receivedById: z.string().min(1),
  items: z.array(grItemSchema).min(1)
});

// --- Suppliers API ---
router.get("/suppliers", async (req, res) => {
  const list = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  res.json(list);
});

router.post("/suppliers", async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dữ liệu nhà cung cấp không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  try {
    const created = await prisma.supplier.create({ data: parsed.data });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: "Mã nhà cung cấp đã tồn tại." });
  }
});

router.put("/suppliers/:id", async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dữ liệu nhà cung cấp không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await prisma.supplier.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Cập nhật thất bại hoặc trùng mã nhà cung cấp." });
  }
});

router.delete("/suppliers/:id", async (req, res) => {
  try {
    const refCount = await prisma.purchaseOrder.count({
      where: { supplierId: req.params.id }
    });
    if (refCount > 0) {
      res.status(400).json({ error: "Không thể xóa Nhà cung cấp đã có lịch sử Đơn nhập hàng PO." });
      return;
    }

    await prisma.supplier.delete({
      where: { id: req.params.id }
    });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: "Không thể xóa nhà cung cấp." });
  }
});

// --- Purchase Orders API ---
router.get("/purchase-orders", async (req, res) => {
  const list = await prisma.purchaseOrder.findMany({
    include: {
      supplier: true,
      items: { include: { product: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(list);
});

router.get("/purchase-orders/:id", async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: {
      supplier: true,
      items: { include: { product: true } },
      goodsReceipts: {
        include: { items: { include: { product: true } } }
      }
    }
  });
  if (!po) {
    res.status(404).json({ error: "Không tìm thấy đơn mua hàng PO." });
    return;
  }
  res.json(po);
});

router.post("/purchase-orders", async (req, res) => {
  const parsed = poCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dữ liệu PO không hợp lệ", details: parsed.error.flatten() });
    return;
  }

  const { supplierId, items } = parsed.data;

  try {
    const createdPO = await prisma.$transaction(async (tx) => {
      const poItemsToCreate = [];

      for (const item of items) {
        let productId = item.productId;

        // Section 6: Quick Product Creation inside PO
        if (item.isNewProduct && item.newProductData) {
          const np = item.newProductData;
          // Generate unique SKU & Barcode (Section 7)
          const sku = `SKU-${np.slug.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
          const barcode = `893000${Math.floor(100000 + Math.random() * 900000)}`;

          // Check duplicate name or slug (Section 7)
          const nameDup = await tx.product.findFirst({
            where: {
              OR: [
                { name: { equals: np.name } },
                { slug: { equals: np.slug } }
              ]
            }
          });
          if (nameDup) {
            throw new Error(`Sản phẩm với tên hoặc slug "${np.name}" đã tồn tại trên hệ thống.`);
          }

          // Create Product
          const newProduct = await tx.product.create({
            data: {
              name: np.name,
              slug: np.slug,
              sku,
              barcode,
              description: np.description,
              price: np.price,
              image: np.image,
              categoryId: np.categoryId,
              brand: np.brand ?? null,
              tags: np.tags ?? null,
              stock_quantity: 0
            }
          });

          productId = newProduct.id;

          // Enforce: Initialize stock for all branches at exactly 0 (Section 6)
          const branches = await tx.branch.findMany();
          for (const br of branches) {
            await tx.branchProduct.create({
              data: {
                branchId: br.id,
                productId: newProduct.id,
                stock: 0,
                minStock: 10
              }
            });
          }
        }

        if (!productId) {
          throw new Error("Không có Product ID hoặc dữ liệu tạo sản phẩm mới.");
        }

        poItemsToCreate.push({
          productId,
          quantityOrdered: item.quantityOrdered,
          pricePerUnit: item.pricePerUnit
        });
      }

      // Create Purchase Order record in DRAFT status
      const count = await tx.purchaseOrder.count();
      const poNumber = `PO-2026-${(count + 1).toString().padStart(4, "0")}`;

      return await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          status: "DRAFT",
          items: {
            create: poItemsToCreate
          }
        },
        include: {
          items: true
        }
      });
    });

    res.status(201).json(createdPO);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Không thể tạo đơn hàng PO." });
  }
});

router.patch("/purchase-orders/:id/status", async (req, res) => {
  const statusBody = z.object({ status: z.nativeEnum(POStatus) });
  const parsed = statusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Trạng thái không hợp lệ.", details: parsed.error.flatten() });
    return;
  }

  try {
    const updated = await ProcurementService.transitionStatus(
      req.params.id,
      parsed.data.status,
      req.user?.userId || "admin-fallback"
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/purchase-orders/:id", async (req, res) => {
  try {
    await ProcurementService.deletePO(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/purchase-orders/:id", async (req, res) => {
  const parsed = poCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dữ liệu PO không hợp lệ", details: parsed.error.flatten() });
    return;
  }
  const { supplierId, items } = parsed.data;
  try {
    const updated = await ProcurementService.updatePO(req.params.id, supplierId, items);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Không thể cập nhật đơn mua hàng PO." });
  }
});

// --- Goods Receipts API ---
router.get("/goods-receipts", async (req, res) => {
  const receipts = await prisma.goodsReceipt.findMany({
    include: {
      purchaseOrder: true,
      branch: true,
      items: { include: { product: true } }
    },
    orderBy: { receivedDate: "desc" }
  });
  res.json(receipts);
});

router.post("/goods-receipts", async (req, res) => {
  const parsed = grCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dữ liệu nhập hàng không hợp lệ.", details: parsed.error.flatten() });
    return;
  }

  const { purchaseOrderId, branchId, receivedById, items } = parsed.data;

  try {
    const gr = await prisma.$transaction(async (tx) => {
      // Generate GR Number
      const count = await tx.goodsReceipt.count();
      const grNumber = `GR-2026-${(count + 1).toString().padStart(4, "0")}`;

      // Create Goods Receipt
      const receipt = await tx.goodsReceipt.create({
        data: {
          grNumber,
          purchaseOrderId,
          branchId,
          receivedById,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              qtyReceived: item.qtyReceived,
              qtyDamaged: item.qtyDamaged
            }))
          }
        }
      });

      return receipt;
    });

    // Run the receive service to ingest into inventory batches and ledgers
    await InventoryService.receiveGoods(gr.id, receivedById);

    // Return receipt details
    const grResult = await prisma.goodsReceipt.findUnique({
      where: { id: gr.id },
      include: { items: true }
    });

    res.status(201).json(grResult);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Thao tác nhập kho thất bại." });
  }
});

const grUpdateSchema = z.object({
  items: z.array(grItemSchema).min(1)
});

router.put("/goods-receipts/:id", async (req, res) => {
  const parsed = grUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dữ liệu cập nhật nhận hàng không hợp lệ.", details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await InventoryService.updateGoodsReceipt(req.params.id, parsed.data.items);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Không thể cập nhật phiếu nhận hàng." });
  }
});

router.delete("/goods-receipts/:id", async (req, res) => {
  try {
    await InventoryService.deleteGoodsReceipt(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Không thể xóa phiếu nhận hàng." });
  }
});

export default router;
