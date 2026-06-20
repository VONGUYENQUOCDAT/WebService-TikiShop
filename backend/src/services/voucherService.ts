import { prisma } from "../lib/prisma.js";

export class VoucherService {
  static async validateAndCalculateDiscount(params: {
    code: string;
    orderAmount: number;
    userId: string;
    shippingFee?: number;
  }) {
    const uppercaseCode = params.code.trim().toUpperCase();
    const now = new Date();

    const voucher = await prisma.voucher.findUnique({
      where: { code: uppercaseCode },
    });

    if (!voucher) {
      return { isValid: false, error: "Mã giảm giá không tồn tại" };
    }

    const isExpired = now > new Date(voucher.end_date) || now < new Date(voucher.start_date);
    if (voucher.status !== "ACTIVE" || isExpired) {
      return { isValid: false, error: "Mã giảm giá đã hết hạn" };
    }

    if (voucher.used_count >= voucher.usage_limit) {
      return { isValid: false, error: "Mã giảm giá đã hết lượt sử dụng" };
    }

    if (params.orderAmount < voucher.min_order_amount) {
      return { isValid: false, error: "Đơn hàng chưa đạt giá trị tối thiểu" };
    }

    const usedCountForUser = await prisma.userVoucherHistory.count({
      where: {
        userId: params.userId,
        voucherId: voucher.id,
      },
    });

    if (usedCountForUser >= voucher.per_user_limit) {
      return { isValid: false, error: "Bạn đã hết lượt sử dụng mã này" };
    }

    let discountAmount = 0;
    const shipping = params.shippingFee ?? 0;

    if (uppercaseCode === "FREESHIP299" || voucher.is_system_default) {
      discountAmount = Math.min(shipping, voucher.discount_value);
    } else {
      if (voucher.discount_type === "PERCENTAGE") {
        discountAmount = Math.floor((params.orderAmount * voucher.discount_value) / 100);
        if (voucher.max_discount_amount != null) {
          discountAmount = Math.min(discountAmount, voucher.max_discount_amount);
        }
      } else if (voucher.discount_type === "FIXED_AMOUNT") {
        discountAmount = voucher.discount_value;
      }
    }

    discountAmount = Math.min(discountAmount, params.orderAmount + shipping);

    return {
      isValid: true,
      discountAmount,
      voucher,
    };
  }
}
