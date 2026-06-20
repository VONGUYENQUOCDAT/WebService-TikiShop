import { prisma } from "./lib/prisma.js";

async function main() {
  const deliveryId = "cmqc2vn0f00014r7wnv3i5sxf";
  const status = "DELIVERED";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const doRow = await tx.deliveryOrder.findUnique({
        where: { id: deliveryId },
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
        where: { id: doRow.id },
        data: updateData,
      });

      if (status === "DELIVERED") {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "completed" },
        });

        if (orderBranchId) {
          for (const item of order.items) {
            const inv = await tx.branchProduct.findUnique({
              where: { branchId_productId: { branchId: orderBranchId, productId: item.productId } },
            });
            if (inv) {
              const newStock = Math.max(0, inv.stock - item.quantity);

              await tx.branchProduct.update({
                where: { id: inv.id },
                data: {
                  stock: newStock,
                },
              });
            }
          }
        }
      }

      return updated;
    });

    console.log("Success:", result);
  } catch (err: any) {
    console.error("Failed:", err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
