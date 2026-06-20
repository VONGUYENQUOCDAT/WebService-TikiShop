import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

export class InventoryService {
  /**
   * Processes a Goods Receipt, creates batches, writes ledgers, and updates branch stock.
   * Ensures no over-receiving beyond ordered quantities (Section 3).
   */
  static async receiveGoods(goodsReceiptId: string, receivedById: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Goods Receipt details
      const gr = await tx.goodsReceipt.findUnique({
        where: { id: goodsReceiptId },
        include: {
          purchaseOrder: {
            include: {
              items: true,
              goodsReceipts: {
                include: { items: true }
              }
            }
          },
          items: true,
          branch: true
        }
      });

      if (!gr) {
        throw new Error("Không tìm thấy phiếu nhận hàng (Goods Receipt).");
      }

      const po = gr.purchaseOrder;

      // 2. Validate Purchase Order status
      if (po.status !== "APPROVED" && po.status !== "RECEIVING") {
        throw new Error(`Đơn nhập hàng (PO) đang ở trạng thái ${po.status}. Chỉ được nhận hàng từ PO APPROVED hoặc RECEIVING.`);
      }

      // 3. Process each item in the Goods Receipt
      for (const grItem of gr.items) {
        const poItem = po.items.find(item => item.productId === grItem.productId);
        if (!poItem) {
          throw new Error(`Sản phẩm (ID: ${grItem.productId}) không nằm trong Đơn nhập hàng.`);
        }

        // Calculate previously received quantity for this product (excluding the current Goods Receipt)
        let previouslyReceived = 0;
        for (const otherGr of po.goodsReceipts) {
          if (otherGr.id !== gr.id) {
            const otherGrItem = otherGr.items.find(item => item.productId === grItem.productId);
            if (otherGrItem) {
              previouslyReceived += otherGrItem.qtyReceived;
            }
          }
        }

        // Section 3: ENFORCE Ordered limit (Total Received <= Ordered)
        const totalWithCurrent = previouslyReceived + grItem.qtyReceived;
        if (totalWithCurrent > poItem.quantityOrdered) {
          throw new Error(
            `Vượt quá số lượng đặt hàng! Sản phẩm ID: ${grItem.productId}. ` +
            `Đã đặt: ${poItem.quantityOrdered}, Đã nhận trước đó: ${previouslyReceived}, ` +
            `Yêu cầu nhận hiện tại: ${grItem.qtyReceived}.`
          );
        }

        // Section 4: Create Inventory Batch
        // Generate a unique batch number
        const batchNum = `BAT-${gr.grNumber}-${grItem.productId.substring(0, 4)}-${Date.now().toString().slice(-4)}`;
        
        // Default expiry date: 1 year from now if not specified.
        // We'll set manufacture date to today and expiry to 1 year from now.
        const mfgDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        const batch = await tx.inventoryBatch.create({
          data: {
            batchNumber: batchNum,
            goodsReceiptItemId: grItem.id,
            productId: grItem.productId,
            supplierId: po.supplierId,
            branchId: gr.branchId,
            mfgDate,
            expiryDate,
            initialQty: grItem.qtyReceived,
            remainingQty: grItem.qtyReceived
          }
        });

        // Section 5 & 9: Write to Inventory Ledger (Double Entry)
        const branchProduct = await tx.branchProduct.upsert({
          where: {
            branchId_productId: {
              branchId: gr.branchId,
              productId: grItem.productId
            }
          },
          update: {
            stock: { increment: grItem.qtyReceived }
          },
          create: {
            branchId: gr.branchId,
            productId: grItem.productId,
            stock: grItem.qtyReceived,
            minStock: 10
          }
        });

        await tx.product.update({
          where: { id: grItem.productId },
          data: { stock_quantity: { increment: grItem.qtyReceived } }
        });

        await tx.inventoryLedger.create({
          data: {
            productId: grItem.productId,
            branchId: gr.branchId,
            batchId: batch.id,
            movementType: "PURCHASE_RECEIPT",
            qtyChange: grItem.qtyReceived,
            balanceAfter: branchProduct.stock,
            sourceDocId: gr.id
          }
        });
      }

      // 4. Update PO status based on total receiving quantities
      // Check if all items on PO are fully received
      let allCompleted = true;
      const updatedReceipts = await tx.goodsReceipt.findMany({
        where: { purchaseOrderId: po.id },
        include: { items: true }
      });

      for (const poItem of po.items) {
        let totalReceived = 0;
        for (const receipt of updatedReceipts) {
          const item = receipt.items.find(i => i.productId === poItem.productId);
          if (item) {
            totalReceived += item.qtyReceived;
          }
        }
        if (totalReceived < poItem.quantityOrdered) {
          allCompleted = false;
          break;
        }
      }

      const newStatus = allCompleted ? "COMPLETED" : "RECEIVING";
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus }
      });

      return { success: true, newStatus };
    });
  }

  /**
   * Transfers inventory from a source branch to a destination branch using FEFO (First Expired First Out).
   */
  static async executeStockTransfer(stockTransferId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Transfer details
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: stockTransferId },
        include: {
          items: true
        }
      });

      if (!transfer) {
        throw new Error("Không tìm thấy phiếu luân chuyển (Stock Transfer).");
      }

      if (transfer.status !== "PENDING") {
        throw new Error(`Yêu cầu luân chuyển đang ở trạng thái ${transfer.status}, không thể thực hiện.`);
      }

      for (const item of transfer.items) {
        let qtyToAllocate = item.quantity;

        // Fetch active batches at source branch ordered by expiry date (FEFO)
        const sourceBatches = await tx.inventoryBatch.findMany({
          where: {
            productId: item.productId,
            branchId: transfer.srcBranchId,
            remainingQty: { gt: 0 }
          },
          orderBy: {
            expiryDate: "asc"
          }
        });

        const totalAvailable = sourceBatches.reduce((sum, b) => sum + b.remainingQty, 0);
        if (totalAvailable < qtyToAllocate) {
          throw new Error(
            `Không đủ hàng tại kho nguồn để luân chuyển! ` +
            `Sản phẩm ID: ${item.productId}. Yêu cầu: ${qtyToAllocate}, Có sẵn: ${totalAvailable}.`
          );
        }

        // Allocate using FEFO
        for (const batch of sourceBatches) {
          if (qtyToAllocate <= 0) break;

          const qtyFromThisBatch = Math.min(batch.remainingQty, qtyToAllocate);

          // Deduct from source batch
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: { remainingQty: { decrement: qtyFromThisBatch } }
          });

          // Deduct from source BranchProduct
          const srcBp = await tx.branchProduct.update({
            where: {
              branchId_productId: {
                branchId: transfer.srcBranchId,
                productId: item.productId
              }
            },
            data: { stock: { decrement: qtyFromThisBatch } }
          });

          // Create source ledger entry (STOCK_TRANSFER_OUT)
          await tx.inventoryLedger.create({
            data: {
              productId: item.productId,
              branchId: transfer.srcBranchId,
              batchId: batch.id,
              movementType: "STOCK_TRANSFER_OUT",
              qtyChange: -qtyFromThisBatch,
              balanceAfter: srcBp.stock,
              sourceDocId: transfer.id
            }
          });

          // Create/update batch at destination branch
          // Traceability requirement: link to original GR item, and keep same supplier, mfgDate, expiryDate
          const destBatchNum = `BAT-TR-${batch.batchNumber.substring(4)}`;
          
          let destBatch = await tx.inventoryBatch.findUnique({
            where: { batchNumber: destBatchNum }
          });

          if (!destBatch) {
            destBatch = await tx.inventoryBatch.create({
              data: {
                batchNumber: destBatchNum,
                goodsReceiptItemId: batch.goodsReceiptItemId,
                productId: item.productId,
                supplierId: batch.supplierId,
                branchId: transfer.destBranchId,
                mfgDate: batch.mfgDate,
                expiryDate: batch.expiryDate,
                initialQty: qtyFromThisBatch,
                remainingQty: qtyFromThisBatch
              }
            });
          } else {
            destBatch = await tx.inventoryBatch.update({
              where: { id: destBatch.id },
              data: {
                remainingQty: { increment: qtyFromThisBatch }
              }
            });
          }

          // Update destination BranchProduct
          const destBp = await tx.branchProduct.upsert({
            where: {
              branchId_productId: {
                branchId: transfer.destBranchId,
                productId: item.productId
              }
            },
            update: {
              stock: { increment: qtyFromThisBatch }
            },
            create: {
              branchId: transfer.destBranchId,
              productId: item.productId,
              stock: qtyFromThisBatch,
              minStock: 10
            }
          });

          // Create destination ledger entry (STOCK_TRANSFER_IN)
          await tx.inventoryLedger.create({
            data: {
              productId: item.productId,
              branchId: transfer.destBranchId,
              batchId: destBatch.id,
              movementType: "STOCK_TRANSFER_IN",
              qtyChange: qtyFromThisBatch,
              balanceAfter: destBp.stock,
              sourceDocId: transfer.id
            }
          });

          qtyToAllocate -= qtyFromThisBatch;
        }
      }

      // Mark transfer as RECEIVED (Completed)
      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: "RECEIVED" }
      });

      return { success: true };
    });
  }

  /**
   * Deletes a Goods Receipt, reversing all inventory increments.
   * Fails if any batch stock has been consumed or transferred.
   */
  static async deleteGoodsReceipt(goodsReceiptId: string) {
    return await prisma.$transaction(async (tx) => {
      const gr = await tx.goodsReceipt.findUnique({
        where: { id: goodsReceiptId },
        include: {
          items: true,
          purchaseOrder: true
        }
      });

      if (!gr) {
        throw new Error("Không tìm thấy phiếu nhận hàng (Goods Receipt).");
      }

      // Find all batches created by this GR
      const grItemIds = gr.items.map(item => item.id);
      const batches = await tx.inventoryBatch.findMany({
        where: {
          goodsReceiptItemId: { in: grItemIds }
        }
      });

      // Verify that no batch stock has been consumed or transferred
      for (const batch of batches) {
        if (batch.remainingQty !== batch.initialQty) {
          throw new Error(
            `Không thể xóa Phiếu nhận hàng! Lô hàng ${batch.batchNumber} ` +
            `của sản phẩm ID: ${batch.productId} đã bị bán hoặc điều chuyển.`
          );
        }
      }

      // Revert the stock level in BranchProduct
      for (const grItem of gr.items) {
        await tx.branchProduct.update({
          where: {
            branchId_productId: {
              branchId: gr.branchId,
              productId: grItem.productId
            }
          },
          data: {
            stock: { decrement: grItem.qtyReceived }
          }
        });

        await tx.product.update({
          where: { id: grItem.productId },
          data: { stock_quantity: { decrement: grItem.qtyReceived } }
        });
      }

      // Delete ledgers, batches, items, and the receipt itself
      await tx.inventoryLedger.deleteMany({
        where: { sourceDocId: gr.id }
      });

      await tx.inventoryBatch.deleteMany({
        where: { goodsReceiptItemId: { in: grItemIds } }
      });

      await tx.goodsReceiptItem.deleteMany({
        where: { goodsReceiptId: gr.id }
      });

      await tx.goodsReceipt.delete({
        where: { id: gr.id }
      });

      // Re-evaluate Purchase Order status
      const otherReceipts = await tx.goodsReceipt.findMany({
        where: { purchaseOrderId: gr.purchaseOrderId },
        include: { items: true }
      });

      let totalReceivedAcrossAll = 0;
      for (const r of otherReceipts) {
        totalReceivedAcrossAll += r.items.reduce((sum, item) => sum + item.qtyReceived, 0);
      }

      const poStatus = totalReceivedAcrossAll === 0 ? "APPROVED" : "RECEIVING";
      await tx.purchaseOrder.update({
        where: { id: gr.purchaseOrderId },
        data: { status: poStatus }
      });

      return { success: true };
    });
  }

  /**
   * Updates a Goods Receipt, reversing previous quantities and applying new ones.
   * Fails if any batch stock has been consumed.
   */
  static async updateGoodsReceipt(goodsReceiptId: string, updatedItems: { productId: string; qtyReceived: number; qtyDamaged: number }[]) {
    return await prisma.$transaction(async (tx) => {
      // 1. Load GR details
      const gr = await tx.goodsReceipt.findUnique({
        where: { id: goodsReceiptId },
        include: {
          items: true,
          purchaseOrder: {
            include: { items: true }
          }
        }
      });

      if (!gr) {
        throw new Error("Không tìm thấy phiếu nhận hàng (Goods Receipt).");
      }

      const po = gr.purchaseOrder;

      // 2. Validate current batches are untouched
      const grItemIds = gr.items.map(item => item.id);
      const batches = await tx.inventoryBatch.findMany({
        where: {
          goodsReceiptItemId: { in: grItemIds }
        }
      });

      for (const batch of batches) {
        if (batch.remainingQty !== batch.initialQty) {
          throw new Error(
            `Không thể sửa Phiếu nhận hàng! Lô hàng ${batch.batchNumber} ` +
            `của sản phẩm ID: ${batch.productId} đã bị tiêu dùng hoặc điều phối.`
          );
        }
      }

      // 3. Reverse stock levels for all previous items
      for (const grItem of gr.items) {
        await tx.branchProduct.update({
          where: {
            branchId_productId: {
              branchId: gr.branchId,
              productId: grItem.productId
            }
          },
          data: {
            stock: { decrement: grItem.qtyReceived }
          }
        });

        await tx.product.update({
          where: { id: grItem.productId },
          data: { stock_quantity: { decrement: grItem.qtyReceived } }
        });
      }

      // Delete previous ledgers and batches
      await tx.inventoryLedger.deleteMany({
        where: { sourceDocId: gr.id }
      });

      await tx.inventoryBatch.deleteMany({
        where: { goodsReceiptItemId: { in: grItemIds } }
      });

      await tx.goodsReceiptItem.deleteMany({
        where: { goodsReceiptId: gr.id }
      });

      // 4. Ingest new quantities and check PO limits
      for (const item of updatedItems) {
        const poItem = po.items.find(pi => pi.productId === item.productId);
        if (!poItem) {
          throw new Error(`Sản phẩm (ID: ${item.productId}) không nằm trong Đơn nhập hàng.`);
        }

        // Calculate other receipts
        const otherReceipts = await tx.goodsReceipt.findMany({
          where: {
            purchaseOrderId: po.id,
            NOT: { id: gr.id }
          },
          include: { items: true }
        });

        let previouslyReceived = 0;
        for (const otherGr of otherReceipts) {
          const otherGrItem = otherGr.items.find(i => i.productId === item.productId);
          if (otherGrItem) {
            previouslyReceived += otherGrItem.qtyReceived;
          }
        }

        if (previouslyReceived + item.qtyReceived > poItem.quantityOrdered) {
          throw new Error(
            `Vượt quá số lượng đặt hàng! Sản phẩm ID: ${item.productId}. ` +
            `Đã đặt: ${poItem.quantityOrdered}, Đã nhận trước đó: ${previouslyReceived}, ` +
            `Yêu cầu chỉnh sửa nhận: ${item.qtyReceived}.`
          );
        }

        // Create GoodsReceiptItem
        const newGrItem = await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: gr.id,
            productId: item.productId,
            qtyReceived: item.qtyReceived,
            qtyDamaged: item.qtyDamaged
          }
        });

        // Create Batch
        const batchNum = `BAT-${gr.grNumber}-${item.productId.substring(0, 4)}-${Date.now().toString().slice(-4)}`;
        const mfgDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        const newBatch = await tx.inventoryBatch.create({
          data: {
            batchNumber: batchNum,
            goodsReceiptItemId: newGrItem.id,
            productId: item.productId,
            supplierId: po.supplierId,
            branchId: gr.branchId,
            mfgDate,
            expiryDate,
            initialQty: item.qtyReceived,
            remainingQty: item.qtyReceived
          }
        });

        // Increment Branch Product stock
        const branchProduct = await tx.branchProduct.upsert({
          where: {
            branchId_productId: {
              branchId: gr.branchId,
              productId: item.productId
            }
          },
          update: {
            stock: { increment: item.qtyReceived }
          },
          create: {
            branchId: gr.branchId,
            productId: item.productId,
            stock: item.qtyReceived,
            minStock: 10
          }
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stock_quantity: { increment: item.qtyReceived } }
        });

        // Create Ledger Entry
        await tx.inventoryLedger.create({
          data: {
            productId: item.productId,
            branchId: gr.branchId,
            batchId: newBatch.id,
            movementType: "PURCHASE_RECEIPT",
            qtyChange: item.qtyReceived,
            balanceAfter: branchProduct.stock,
            sourceDocId: gr.id
          }
        });
      }

      // 5. Update PO status
      const finalReceipts = await tx.goodsReceipt.findMany({
        where: { purchaseOrderId: po.id },
        include: { items: true }
      });

      let allCompleted = true;
      for (const poItem of po.items) {
        let totalReceived = 0;
        for (const receipt of finalReceipts) {
          const matchingItem = receipt.items.find(i => i.productId === poItem.productId);
          if (matchingItem) {
            totalReceived += matchingItem.qtyReceived;
          }
        }
        if (totalReceived < poItem.quantityOrdered) {
          allCompleted = false;
          break;
        }
      }

      const newStatus = allCompleted ? "COMPLETED" : "RECEIVING";
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus }
      });

      return { success: true, newStatus };
    });
  }
}
