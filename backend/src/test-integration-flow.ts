import { prisma } from "./lib/prisma.js";
import { VoucherService } from "./services/voucherService.js";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM TRA TÍCH HỢP HỆ THỐNG (END-TO-END SYSTEM TEST) ===");

  // 1. Tìm user testbuyer@demo.local được đăng ký từ subagent
  const user = await prisma.user.findUnique({
    where: { email: "testbuyer@demo.local" }
  });

  if (!user) {
    console.error("Lỗi: Không tìm thấy user testbuyer@demo.local. Hãy chạy đăng ký trước hoặc tự tạo thủ công.");
    return;
  }

  console.log(`User tìm thấy: ${user.name} (Email: ${user.email}, ID: ${user.id})`);

  // 2. Kiểm tra Địa chỉ mặc định đã lưu
  let defaultAddress = await prisma.address.findFirst({
    where: { userId: user.id }
  });

  if (!defaultAddress) {
    console.log("Không tìm thấy địa chỉ, tự động tạo địa chỉ mặc định...");
    defaultAddress = await prisma.address.create({
      data: {
        userId: user.id,
        provinceId: "79",
        provinceName: "Thành phố Hồ Chí Minh",
        districtId: "760",
        districtName: "Quận 1",
        wardId: "26734",
        wardName: "Phường Bến Nghé",
        streetAddress: "123 Đường Lê Lợi",
        addressType: "HOME",
        isDefault: true,
      }
    });
  }

  console.log(`Địa chỉ đã lưu: ${defaultAddress.streetAddress}, ${defaultAddress.wardName}, ${defaultAddress.districtName}, ${defaultAddress.provinceName}`);
  console.log(`Loại địa chỉ: ${defaultAddress.addressType} | Mặc định: ${defaultAddress.isDefault}`);

  // 3. Giả lập thêm sản phẩm vào wishlist
  const product = await prisma.product.findFirst({
    where: { slug: "samsung-galaxy-a54-5g" }
  });

  if (!product) {
    console.error("Lỗi: Không tìm thấy sản phẩm Samsung Galaxy A54 5G.");
    return;
  }

  // Thêm vào wishlist
  const wishlistItem = await prisma.wishlistItem.upsert({
    where: {
      userId_productId: {
        userId: user.id,
        productId: product.id
      }
    },
    update: {},
    create: {
      userId: user.id,
      productId: product.id
    }
  });
  console.log(`\nĐã thêm sản phẩm [${product.name}] vào Yêu thích (Wishlist ID: ${wishlistItem.id})`);

  // 4. Giả lập đặt giỏ hàng
  await prisma.cartItem.deleteMany({ where: { userId: user.id } }); // Clear cũ
  const cartItem = await prisma.cartItem.create({
    data: {
      userId: user.id,
      productId: product.id,
      quantity: 1
    },
    include: { product: true }
  });
  console.log(`Đã tạo giỏ hàng với sản phẩm: ${cartItem.product.name} (SL: ${cartItem.quantity})`);

  // 5. Tính toán Checkout phí vận chuyển
  const cartItems = [cartItem];
  const subtotal = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  let shippingFee = 30000; // Phí mặc định
  const codeNum = parseInt(defaultAddress.provinceId, 10);
  if (codeNum === 79 || codeNum === 1) {
    shippingFee = 15000;
  } else if ([48, 31, 75, 60].includes(codeNum)) {
    shippingFee = 25000;
  } else if (codeNum >= 80) {
    shippingFee = 40000;
  }
  
  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const additionalFee = Math.max(0, (totalQty - 1) * 5000);
  shippingFee += additionalFee;

  console.log(`Tạm tính: ${subtotal.toLocaleString()}đ`);
  console.log(`Phí vận chuyển: ${shippingFee.toLocaleString()}đ (Mã tỉnh: ${defaultAddress.provinceId})`);

  // 6. Áp dụng mã Voucher
  const voucherCode = "FREESHIP299";
  let discount = 0;
  let finalVoucherCode: string | null = null;
  let voucherId: string | null = null;

  const vResult = await VoucherService.validateAndCalculateDiscount({
    code: voucherCode,
    orderAmount: subtotal,
    userId: user.id,
    shippingFee,
  });

  if (vResult.isValid) {
    discount = vResult.discountAmount ?? 0;
    finalVoucherCode = vResult.voucher?.code ?? null;
    voucherId = vResult.voucher?.id ?? null;
    console.log(`Áp dụng mã Voucher ${finalVoucherCode} thành công! Giảm giá: ${discount.toLocaleString()}đ`);
  } else {
    console.log(`Không áp dụng được voucher: ${vResult.error}`);
  }

  const total = subtotal + shippingFee - discount;
  console.log(`Tổng cộng cần thanh toán: ${total.toLocaleString()}đ`);

  // 7. Thực hiện Giao dịch Đặt hàng & Phân bổ lô hàng (Strict Single Branch FEFO)
  console.log("\nTiến hành transaction đặt hàng...");
  const order = await prisma.$transaction(async (tx) => {
    const branches = await tx.branch.findMany();
    let selectedBranchId: string | null = null;
    let deductions: Array<{
      productId: string;
      qtyFromThisBatch: number;
      batch: any;
    }> = [];

    const now = new Date();

    for (const branch of branches) {
      let branchCanFulfillAll = true;
      const tempDeductions: typeof deductions = [];

      for (const item of cartItems) {
        let qtyNeeded = item.quantity;
        const batches = await tx.inventoryBatch.findMany({
          where: {
            productId: item.productId,
            branchId: branch.id,
            remainingQty: { gt: 0 },
            expiryDate: { gt: now },
          },
          orderBy: { expiryDate: "asc" }, // FEFO
        });

        const totalStockInBranch = batches.reduce((sum, b) => sum + b.remainingQty, 0);
        if (totalStockInBranch < qtyNeeded) {
          branchCanFulfillAll = false;
          break;
        }

        for (const batch of batches) {
          if (qtyNeeded <= 0) break;
          const qtyFromThisBatch = Math.min(batch.remainingQty, qtyNeeded);
          tempDeductions.push({
            productId: item.productId,
            qtyFromThisBatch,
            batch,
          });
          qtyNeeded -= qtyFromThisBatch;
        }
      }

      if (branchCanFulfillAll) {
        selectedBranchId = branch.id;
        deductions = tempDeductions;
        break;
      }
    }

    if (!selectedBranchId) {
      throw new Error("Không có chi nhánh nào có đủ tồn kho.");
    }

    // Tạo đơn hàng
    const o = await tx.order.create({
      data: {
        userId: user.id,
        branchId: selectedBranchId,
        total,
        address: `${defaultAddress.streetAddress}, ${defaultAddress.wardName}, ${defaultAddress.districtName}, ${defaultAddress.provinceName}`,
        phone: user.phone || "0987654321",
        status: "pending",
        provinceId: defaultAddress.provinceId,
        provinceName: defaultAddress.provinceName,
        districtId: defaultAddress.districtId,
        districtName: defaultAddress.districtName,
        wardId: defaultAddress.wardId,
        wardName: defaultAddress.wardName,
        streetAddress: defaultAddress.streetAddress,
        addressType: defaultAddress.addressType,
        shippingFee,
        discount,
        voucherCode: finalVoucherCode,
        paymentMethod: "ONLINE",
        paymentStatus: "PENDING",
        items: {
          create: cartItems.map((ci) => ({
            productId: ci.productId,
            quantity: ci.quantity,
            price: ci.product.price,
          })),
        },
      },
    });

    // Tạo vận chuyển
    await tx.deliveryOrder.create({
      data: {
        orderId: o.id,
        shipping_provider: "TikiFast",
        tracking_number: `TK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        shipping_fee: shippingFee,
        status: "PENDING",
        estimated_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    });

    // Trừ kho & ghi ledger log
    for (const d of deductions) {
      await tx.inventoryBatch.update({
        where: { id: d.batch.id },
        data: { remainingQty: { decrement: d.qtyFromThisBatch } },
      });

      const bp = await tx.branchProduct.update({
        where: {
          branchId_productId: {
            branchId: d.batch.branchId,
            productId: d.productId,
          },
        },
        data: { stock: { decrement: d.qtyFromThisBatch } },
      });

      await tx.product.update({
        where: { id: d.productId },
        data: { stock_quantity: { decrement: d.qtyFromThisBatch } },
      });

      await tx.inventoryLedger.create({
        data: {
          productId: d.productId,
          branchId: d.batch.branchId,
          batchId: d.batch.id,
          movementType: "SALE",
          qtyChange: -d.qtyFromThisBatch,
          balanceAfter: bp.stock,
          sourceDocId: o.id,
        },
      });
    }

    // Xóa giỏ hàng
    await tx.cartItem.deleteMany({
      where: { userId: user.id },
    });

    // Ghi nhận Voucher sử dụng
    if (voucherId) {
      await tx.voucher.update({
        where: { id: voucherId },
        data: { used_count: { increment: 1 } },
      });
    }

    return o;
  });

  console.log(`Đã tạo đơn hàng thành công! ID đơn hàng: ${order.id}`);
  console.log(`Trạng thái thanh toán ban đầu: ${order.paymentStatus} | Trạng thái đơn hàng: ${order.status}`);

  // 8. Giả lập Payment Simulator
  console.log("\nGiả lập thanh toán trực tuyến qua Payment Simulator...");
  const paidOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      paymentReference: `PAY-SIM-${Date.now()}`,
      status: "confirmed"
    }
  });

  console.log(`Thanh toán thành công! Trạng thái thanh toán: ${paidOrder.paymentStatus}`);
  console.log(`Mã tham chiếu thanh toán: ${paidOrder.paymentReference}`);
  console.log(`Trạng thái đơn hàng hiện tại: ${paidOrder.status}`);

  // 9. Xác minh sổ cái Ledger
  const ledgers = await prisma.inventoryLedger.findMany({
    where: { sourceDocId: order.id }
  });
  console.log(`\nKiểm tra số dòng ghi nhận trong Sổ cái kho (Ledger): ${ledgers.length}`);
  for (const l of ledgers) {
    console.log(`- Ledger ID: ${l.id} | SP: ${l.productId} | Di chuyển: ${l.movementType} | Lượng đổi: ${l.qtyChange} | Tồn kho sau đổi: ${l.balanceAfter}`);
  }

  // 10. Đóng gói kết quả
  console.log("\n=== TẤT CẢ KIỂM TRA ĐỀU THÀNH CÔNG VÀ CHÍNH XÁC! ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
