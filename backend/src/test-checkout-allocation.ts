import { prisma } from "./lib/prisma.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM TRA ĐỊNH VỊ CHI NHÁNH VÀ PHÂN BỔ TỒN KHO ===");

  // 1. Kiểm tra danh sách Chi nhánh
  const branches = await prisma.branch.findMany();
  console.log(`Số lượng chi nhánh trong hệ thống: ${branches.length}`);
  for (const b of branches) {
    console.log(`- Chi nhánh: ${b.name} (ID: ${b.id})`);
  }

  if (branches.length === 0) {
    console.error("Lỗi: Không tìm thấy chi nhánh nào trong CSDL! Hãy chạy seed trước.");
    return;
  }

  // 2. Tìm một sản phẩm có hàng để kiểm tra
  const product = await prisma.product.findFirst({
    include: {
      batches: true,
    }
  });

  if (!product) {
    console.error("Lỗi: Không tìm thấy sản phẩm nào trong CSDL!");
    return;
  }

  console.log(`\nSản phẩm kiểm tra: ${product.name} (ID: ${product.id})`);
  console.log(`Giá bán: ${product.price}đ`);
  
  // 3. Hiển thị chi tiết các lô hàng hiện tại
  console.log("Các lô hàng hiện tại:");
  const now = new Date();
  const allBatches = await prisma.inventoryBatch.findMany({
    where: { productId: product.id }
  });
  
  for (const batch of allBatches) {
    const isExpired = new Date(batch.expiryDate) <= now;
    console.log(`- Lô ID: ${batch.id} | Chi nhánh ID: ${batch.branchId} | Số lượng còn lại: ${batch.remainingQty} | Hạn dùng: ${new Date(batch.expiryDate).toLocaleDateString()} ${isExpired ? "(Hết hạn!)" : "(Còn hạn)"}`);
  }

  // 4. Giả lập một tiến trình kiểm tra chi nhánh có thể đáp ứng
  console.log("\nGiả lập kiểm tra chi nhánh đủ điều kiện đáp ứng đơn hàng:");
  const qtyNeeded = 2;
  console.log(`Số lượng yêu cầu mua: ${qtyNeeded}`);

  let selectedBranchId: string | null = null;
  let deductions: Array<{
    productId: string;
    qtyFromThisBatch: number;
    batchId: string;
  }> = [];

  for (const branch of branches) {
    let branchCanFulfillAll = true;
    const tempDeductions: typeof deductions = [];
    let qtyNeededRemaining = qtyNeeded;

    // Tìm các lô còn hạn, còn hàng của sản phẩm này tại chi nhánh đang xét
    const batches = await prisma.inventoryBatch.findMany({
      where: {
        productId: product.id,
        branchId: branch.id,
        remainingQty: { gt: 0 },
        expiryDate: { gt: now },
      },
      orderBy: { expiryDate: "asc" }, // FEFO
    });

    const totalStockInBranch = batches.reduce((sum, b) => sum + b.remainingQty, 0);
    console.log(`-> Xét chi nhánh [${branch.name}]: tổng tồn kho còn hạn = ${totalStockInBranch}`);

    if (totalStockInBranch < qtyNeededRemaining) {
      branchCanFulfillAll = false;
      console.log(`   [KẾT QUẢ]: Chi nhánh ${branch.name} KHÔNG đủ hàng.`);
      continue;
    }

    for (const batch of batches) {
      if (qtyNeededRemaining <= 0) break;
      const qtyFromThisBatch = Math.min(batch.remainingQty, qtyNeededRemaining);
      tempDeductions.push({
        productId: product.id,
        qtyFromThisBatch,
        batchId: batch.id,
      });
      qtyNeededRemaining -= qtyFromThisBatch;
    }

    if (branchCanFulfillAll && qtyNeededRemaining === 0) {
      selectedBranchId = branch.id;
      deductions = tempDeductions;
      console.log(`   [KẾT QUẢ]: Chi nhánh ${branch.name} ĐỦ ĐIỀU KIỆN! Sẽ chọn chi nhánh này.`);
      break;
    }
  }

  if (selectedBranchId) {
    console.log(`\nPhân bổ tồn kho thành công!`);
    console.log(`Chi nhánh được chọn: ${selectedBranchId}`);
    console.log("Chi tiết phân bổ lô hàng:");
    for (const d of deductions) {
      console.log(`- Lấy ${d.qtyFromThisBatch} sản phẩm từ Lô ID: ${d.batchId}`);
    }
  } else {
    console.log(`\nKhông có chi nhánh nào đáp ứng đủ toàn bộ số lượng yêu cầu.`);
  }

  console.log("\n=== HOÀN THÀNH KIỂM TRA ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
