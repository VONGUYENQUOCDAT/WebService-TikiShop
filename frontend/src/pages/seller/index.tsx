import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { Shop } from "@/shared/api/types";
import { useAuthStore } from "@/store/authStore";
import { useToast } from "@/shared/ui/Toast";
import styles from "./SellerRegister.module.css";

export default function SellerRegister() {
  const token = useAuthStore((s) => s.token);
  const storeUser = useAuthStore((s) => s.user);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shop, setShop] = useState<Shop | null>(null);

  // Form values
  const [shopName, setShopName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [idCard, setIdCard] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function fetchShopStatus() {
      try {
        const res = await api.sellerMyShop();
        setShop(res);
        if (res) {
          setShopName(res.shopName);
          setTaxCode(res.taxCode || "");
          setIdCard(res.idCard || "");
          setBusinessAddress(res.businessAddress);
          setBankAccount(res.bankAccount || "");
        }
      } catch (err: any) {
        console.error("Lỗi khi tải thông tin shop:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchShopStatus();
  }, [token]);

  if (!token) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.authPrompt}>
          <h2>Chưa đăng nhập</h2>
          <p>Vui lòng đăng nhập bằng tài khoản của bạn để đăng ký bán hàng.</p>
          <Link to="/dang-nhap" className="btn btn-primary">
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: "48px 0", textAlign: "center" }}>
        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!shopName.trim() || shopName.trim().length < 2) {
      setFormError("Tên gian hàng tối thiểu phải có 2 ký tự");
      return;
    }
    if (!businessAddress.trim() || businessAddress.trim().length < 5) {
      setFormError("Địa chỉ kinh doanh tối thiểu phải có 5 ký tự");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.sellerRegister({
        shopName: shopName.trim(),
        taxCode: taxCode.trim() || undefined,
        idCard: idCard.trim() || undefined,
        businessAddress: businessAddress.trim(),
        bankAccount: bankAccount.trim() || undefined,
      });
      setShop(result);
      toast({
        title: "Đăng ký thành công",
        message: "Hồ sơ của bạn đã được gửi và đang chờ Admin xét duyệt.",
        type: "success",
      });
    } catch (err: any) {
      setFormError(err.message || "Đã xảy ra lỗi trong quá trình gửi hồ sơ.");
      toast({
        title: "Lỗi đăng ký",
        message: err.message || "Không thể gửi hồ sơ đăng ký.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // State 1: APPROVED or User role is SELLER
  if (storeUser?.role === "SELLER" || shop?.status === "APPROVED") {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.hero}>
          <h1>Kênh Người Bán Tiki</h1>
          <p>Chào mừng bạn đã trở thành nhà bán hàng trên hệ thống Tiki Shop. Hãy cùng nâng tầm trải nghiệm mua sắm của khách hàng!</p>
        </div>
        <div className={styles.card}>
          <div className={styles.successState}>
            <span className={styles.stateIcon}>🏪</span>
            <h2 className={styles.stateTitle}>Bạn Đã Là Nhà Bán Hàng</h2>
            <p className={styles.stateDesc}>
              Tài khoản của bạn đã được cấp quyền quản lý gian hàng độc lập. Bạn có thể bắt đầu đăng bán sản phẩm và quản lý doanh thu.
            </p>
            
            <div className={styles.shopDetailsList}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tên gian hàng:</span>
                <span className={styles.detailValue}>{shop?.shopName || "Gian hàng của bạn"}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Địa chỉ kinh doanh:</span>
                <span className={styles.detailValue}>{shop?.businessAddress}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Trạng thái:</span>
                <span className={styles.detailValue} style={{ color: "#166534", fontWeight: 700 }}>ĐÃ DUYỆT</span>
              </div>
            </div>
            
            <div>
              <Link to="/" className="btn btn-primary">
                Về trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: PENDING
  if (shop?.status === "PENDING") {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.hero}>
          <h1>Đăng Ký Bán Hàng Cùng Tiki</h1>
          <p>Mở rộng kinh doanh, tiếp cận hàng triệu khách hàng mỗi ngày với chi phí tối ưu nhất.</p>
        </div>
        <div className={styles.card}>
          <div className={styles.pendingState}>
            <span className={styles.stateIcon}>⏳</span>
            <h2 className={styles.stateTitle}>Hồ Sơ Đang Chờ Xét Duyệt</h2>
            <p className={styles.stateDesc}>
              Hệ thống đã ghi nhận hồ sơ đăng ký của bạn. Quá trình kiểm tra thông tin và phê duyệt thường mất từ 1 - 2 ngày làm việc.
            </p>
            
            <div className={styles.shopDetailsList}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tên gian hàng:</span>
                <span className={styles.detailValue}>{shop.shopName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Địa chỉ kinh doanh:</span>
                <span className={styles.detailValue}>{shop.businessAddress}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Mã số thuế / CCCD:</span>
                <span className={styles.detailValue}>{shop.taxCode || shop.idCard || "Chưa cung cấp"}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Trạng thái:</span>
                <span className={styles.detailValue} style={{ color: "#0b74de", fontWeight: 700 }}>ĐANG CHỜ DUYỆT</span>
              </div>
            </div>
            
            <div>
              <Link to="/" className="btn btn-secondary">
                Quay lại trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 3: NO SHOP or REJECTED (shows form)
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.hero}>
        <h1>Đăng Ký Bán Hàng Cùng Tiki</h1>
        <p>Hợp tác phát triển cùng Tiki Tropical Tech Island - Nền tảng thương mại điện tử uy tín hàng đầu.</p>
      </div>

      {shop?.status === "REJECTED" && (
        <div className={`${styles.alert} ${styles.alertDanger}`}>
          <span className={styles.alertIcon}>⚠️</span>
          <div>
            <div className={styles.alertTitle}>Hồ sơ của bạn bị từ chối phê duyệt</div>
            <div>
              <strong>Lý do từ chối:</strong> {shop.rejectReason || "Thông tin không chính xác hoặc không đầy đủ."}
            </div>
            <div style={{ marginTop: "8px" }}>
              Vui lòng điều chỉnh thông tin bên dưới và gửi lại hồ sơ xét duyệt mới.
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Thông Tin Gian Hàng Đăng Ký</h2>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Tên gian hàng hiển thị <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="Ví dụ: Tropical Tech Island Store"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Mã số thuế doanh nghiệp (nếu có)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="MST gồm 10 hoặc 13 số"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                disabled={submitting}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>Số CMND / CCCD đại diện</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Số CCCD 12 số"
                value={idCard}
                onChange={(e) => setIdCard(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Địa chỉ kinh doanh / Kho hàng <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              placeholder="Số nhà, tên đường, Phường/Xã, Quận/Huyện, Tỉnh/Thành phố"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Thông tin tài khoản ngân hàng (nhận thanh toán)</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Số tài khoản, Tên chủ thẻ, Tên ngân hàng, Chi nhánh"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              disabled={submitting}
            />
          </div>

          {formError && (
            <div className={`${styles.alert} ${styles.alertDanger}`} style={{ padding: "10px 14px", marginBottom: 0 }}>
              <span className={styles.alertIcon}>❌</span>
              <div>{formError}</div>
            </div>
          )}

          <div style={{ textAlign: "right" }}>
            <button type="submit" className={styles.btnSubmit} disabled={submitting}>
              {submitting ? "Đang gửi hồ sơ..." : "Gửi hồ sơ đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
