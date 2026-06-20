import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { Order, User } from "@/shared/api/types";
import { formatPrice } from "@/shared/lib/format";
import {
  orderCanCustomerCancel,
  orderStatusLabel,
  orderTimelineSteps,
  ORDER_STATUS_OPTIONS,
} from "@/shared/lib/order-status";
import { isAdmin, roleLabel } from "@/shared/lib/roles";
import { validateAccountFields } from "@/shared/lib/validators";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useToast, ConfirmModal } from "@/shared/ui";
import styles from "./AccountPage.module.css";

/* ===== Tab types ===== */
type Tab = "profile" | "addresses" | "notifications" | "wishlist" | "orders" | "order-detail" | "settings";

/* ===== Sidebar navigation items ===== */
const NAV_ITEMS: { tab: Tab; icon: string; label: string }[] = [
  { tab: "profile", icon: "👤", label: "Thông tin cá nhân" },
  { tab: "addresses", icon: "📍", label: "Sổ địa chỉ" },
  { tab: "notifications", icon: "🔔", label: "Thông báo" },
  { tab: "wishlist", icon: "❤️", label: "Yêu thích" },
  { tab: "orders", icon: "📦", label: "Đơn hàng của tôi" },
  { tab: "settings", icon: "⚙️", label: "Cài đặt" },
];

/* ===== Main Account Dashboard ===== */
export default function AccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: orderIdParam } = useParams<{ id?: string }>();
  const token = useAuthStore((s) => s.token);
  const storeUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // Determine active tab from URL
  const getTabFromPath = (): Tab => {
    const path = location.pathname;
    if (orderIdParam && path.includes("/don-hang/")) return "order-detail";
    if (path.includes("/don-hang")) return "orders";
    if (path.includes("/cai-dat")) return "settings";
    if (path.includes("/dia-chi")) return "addresses";
    if (path.includes("/thong-bao")) return "notifications";
    if (path.includes("/yeu-thich")) return "wishlist";
    return "profile";
  };

  const [activeTab, setActiveTab] = useState<Tab>(getTabFromPath);

  useEffect(() => {
    setActiveTab(getTabFromPath());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, orderIdParam]);

  const switchTab = (tab: Tab) => {
    switch (tab) {
      case "orders":
        navigate("/tai-khoan/don-hang");
        break;
      case "settings":
        navigate("/tai-khoan/cai-dat");
        break;
      case "addresses":
        navigate("/tai-khoan/dia-chi");
        break;
      case "notifications":
        navigate("/tai-khoan/thong-bao");
        break;
      case "wishlist":
        navigate("/tai-khoan/yeu-thich");
        break;
      default:
        navigate("/tai-khoan");
    }
  };

  if (!token) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.authPrompt}>
          <h2>Chưa đăng nhập</h2>
          <p>Vui lòng đăng nhập để xem tài khoản của bạn.</p>
          <Link to="/dang-nhap" className="btn btn-primary">
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.dashboard}>
        {/* --- Sidebar --- */}
        <aside className={styles.sidebar}>
          {storeUser && (
            <div className={styles.profileCard}>
              <div className={styles.avatar}>
                {storeUser.name.charAt(0)}
              </div>
              <div className={styles.profileName}>{storeUser.name}</div>
              <div className={styles.profileEmail}>{storeUser.email}</div>
              <span className={`${styles.roleBadge} ${isAdmin(storeUser) ? styles.roleAdmin : styles.roleUser}`}>
                {roleLabel(storeUser.role)}
              </span>
            </div>
          )}
          <ul className={styles.navMenu}>
            {NAV_ITEMS.map((item) => (
              <li key={item.tab} className={styles.navItem}>
                <button
                  type="button"
                  className={`${styles.navLink} ${activeTab === item.tab || (item.tab === "orders" && activeTab === "order-detail") ? styles.navLinkActive : ""}`}
                  onClick={() => switchTab(item.tab)}
                >
                  <span className={styles.navIcon} aria-hidden>{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
            {storeUser?.role === "USER" && (
              <li className={styles.navItem}>
                <Link to="/ban-hang" className={styles.navLink}>
                  <span className={styles.navIcon} aria-hidden>🏪</span>
                  Trở thành Nhà bán hàng
                </Link>
              </li>
            )}
            {storeUser?.role === "SELLER" && (
              <li className={styles.navItem}>
                <Link to="/ban-hang" className={styles.navLink}>
                  <span className={styles.navIcon} aria-hidden>🏪</span>
                  Kênh Người bán
                </Link>
              </li>
            )}
            {isAdmin(storeUser) && (
              <>
                <li><div className={styles.navDivider} /></li>
                <li className={styles.navItem}>
                  <Link to="/admin" className={styles.navLink}>
                    <span className={styles.navIcon} aria-hidden>🔧</span>
                    Bảng quản trị
                  </Link>
                </li>
              </>
            )}
            <li><div className={styles.navDivider} /></li>
            <li className={styles.navItem}>
              <button
                type="button"
                className={`${styles.navLink} ${styles.logoutBtn}`}
                onClick={() => { logout(); navigate("/"); }}
              >
                <span className={styles.navIcon} aria-hidden>🚪</span>
                Đăng xuất
              </button>
            </li>
          </ul>
        </aside>

        {/* --- Content area --- */}
        <main className={styles.content}>
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "addresses" && <AddressesTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "wishlist" && <WishlistTab />}
          {activeTab === "orders" && <OrdersTab onViewDetail={(id) => navigate(`/tai-khoan/don-hang/${id}`)} />}
          {activeTab === "order-detail" && orderIdParam && (
            <OrderDetailTab orderId={orderIdParam} onBack={() => navigate("/tai-khoan/don-hang")} />
          )}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   PROFILE TAB
   ========================================================= */
function ProfileTab() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const storeUser = useAuthStore((s) => s.user);
  const toast = useToast();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.me()
      .then((u: User) => { setName(u.name); setPhone(u.phone || ""); })
      .catch(() => {
        if (storeUser) { setName(storeUser.name); setPhone(storeUser.phone || ""); }
      });
  }, [token, storeUser]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const fe = validateAccountFields(name, phone);
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;

    setSaving(true);
    try {
      const u = await api.updateProfile({ name: name.trim(), phone: phone.trim() || null });
      setAuth(token, u);
      toast({ type: "success", message: "Đã lưu thông tin tài khoản." });
    } catch (e) {
      toast({ type: "error", message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.contentPanel}>
      <h2 className={styles.contentTitle}>Thông tin cá nhân</h2>

      {/* Read-only info */}
      {storeUser && (
        <div style={{ marginBottom: 20 }}>
          <div className={styles.profileInfoRow}>
            <span className={styles.profileInfoLabel}>Email</span>
            <span className={styles.profileInfoValue}>{storeUser.email}</span>
          </div>
          <div className={styles.profileInfoRow}>
            <span className={styles.profileInfoLabel}>Ngày tham gia</span>
            <span className={styles.profileInfoValue}>{new Date(storeUser.createdAt).toLocaleDateString("vi-VN")}</span>
          </div>
        </div>
      )}

      {/* Editable form */}
      <form noValidate className={styles.profileForm} onSubmit={submit}>
        <label>
          Họ tên
          <input
            className={`input ${fieldErrors.name ? "input--invalid" : ""}`}
            value={name}
            onChange={(e) => { setName(e.target.value); setFieldErrors((p) => ({ ...p, name: undefined })); }}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name && <span className="field-error" role="alert">{fieldErrors.name}</span>}
        </label>
        <label>
          Số điện thoại
          <input
            className={`input ${fieldErrors.phone ? "input--invalid" : ""}`}
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setFieldErrors((p) => ({ ...p, phone: undefined })); }}
            placeholder="Để trống nếu không muốn cập nhật"
            inputMode="tel"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone && <span className="field-error" role="alert">{fieldErrors.phone}</span>}
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </form>
    </div>
  );
}

/* =========================================================
   ORDERS TAB
   ========================================================= */
function OrdersTab({ onViewDetail }: { onViewDetail: (id: string) => void }) {
  const token = useAuthStore((s) => s.token);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.orders()
      .then(setOrders)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const FILTERS = [
    { value: "all", label: "Tất cả" },
    ...ORDER_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  return (
    <div className={styles.contentPanel}>
      <h2 className={styles.contentTitle}>Đơn hàng của tôi</h2>

      {/* Filter tabs */}
      <div className={styles.orderFilters}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`${styles.filterBtn} ${filter === f.value ? styles.filterBtnActive : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            {f.value !== "all" && (
              <> ({orders.filter((o) => o.status === f.value).length})</>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: "center" }}>
          <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Đang tải đơn hàng…</p>
        </div>
      )}

      {err && <p className="form-alert" role="alert">{err}</p>}

      {!loading && !err && filtered.length === 0 && (
        <div className="empty-state" style={{ padding: "32px 16px" }}>
          <h3>{filter === "all" ? "Chưa có đơn hàng" : "Không có đơn hàng"}</h3>
          <p>{filter === "all" ? "Hãy mua sắm và đặt hàng đầu tiên nhé!" : `Không có đơn hàng ở trạng thái "${FILTERS.find((f) => f.value === filter)?.label}".`}</p>
          {filter === "all" && (
            <Link to="/" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
              Mua sắm ngay
            </Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <ul className={styles.ordersList}>
          {filtered.map((o) => (
            <li key={o.id} className={styles.orderCard} onClick={() => onViewDetail(o.id)}>
              <div className={styles.orderHead}>
                <span className={styles.orderId}>#{o.id.slice(0, 8)}</span>
                <span className={styles.statusBadge} data-st={o.status}>
                  {orderStatusLabel(o.status)}
                </span>
                <span className={styles.orderDate}>{new Date(o.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
              <div className={styles.orderBody}>
                <span className={styles.orderTotal}>{formatPrice(o.total)}</span>
                <span>· {o.phone}</span>
              </div>
              <div className={styles.orderItems}>
                {o.items.slice(0, 3).map((it) => it.product.name).join(", ")}
                {o.items.length > 3 && ` +${o.items.length - 3} sản phẩm`}
              </div>
              <span className={styles.orderViewLink}>Xem chi tiết →</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =========================================================
   ORDER DETAIL TAB
   ========================================================= */
function OrderDetailTab({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Reviews and returns states
  const [reviews, setReviews] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [activeReviewProduct, setActiveReviewProduct] = useState<any | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!token || !orderId) return;
    setLoading(true);
    setErr(null);
    Promise.all([
      api.order(orderId),
      api.getOrderReviews(orderId).catch(() => []),
      api.getReturns().catch(() => []),
    ])
      .then(([orderData, reviewsData, returnsData]) => {
        setOrder(orderData);
        setReviews(reviewsData);
        setReturns(returnsData);
      })
      .catch((e: Error) => {
        setOrder(null);
        setErr(e.message);
      })
      .finally(() => setLoading(false));
  }, [token, orderId, refreshTrigger]);

  const doCancel = async () => {
    if (!order) return;
    setCancelConfirm(false);
    setCancelBusy(true);
    try {
      const updated = await api.cancelOrder(orderId);
      setOrder(updated);
      toast({ type: "success", message: "Đã hủy đơn hàng." });
    } catch (e) {
      toast({ type: "error", message: (e as Error).message });
    } finally {
      setCancelBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.contentPanel} style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Đang tải chi tiết đơn hàng…</p>
      </div>
    );
  }

  if (err || !order) {
    return (
      <div className={styles.contentPanel}>
        <button type="button" className={styles.backBtn} onClick={onBack}>← Quay lại đơn hàng</button>
        <p className="form-alert" role="alert">{err || "Không tìm thấy đơn hàng."}</p>
      </div>
    );
  }

  const steps = orderTimelineSteps(order.status);
  const orderReturn = returns.find((r) => r.orderId === order.id);

  const getReturnStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING": return "Chờ duyệt";
      case "APPROVED": return "Đã duyệt (Chờ nhận hàng)";
      case "REJECTED": return "Từ chối";
      case "COMPLETED": return "Hoàn thành";
      default: return status;
    }
  };

  return (
    <div className={styles.contentPanel}>
      <button type="button" className={styles.backBtn} onClick={onBack}>← Quay lại đơn hàng</button>
      <h2 className={styles.contentTitle}>Chi tiết đơn hàng</h2>

      {order.status === "cancelled" && (
        <div className={styles.cancelBanner} role="status">
          Đơn hàng đã hủy. Nếu bạn đã thanh toán trước, tiền sẽ được hoàn theo chính sách.
        </div>
      )}

      <div className={styles.detailHead}>
        <span className={styles.orderId}>Mã đơn: #{order.id.slice(0, 8)}</span>
        <span className={styles.statusBadge} data-st={order.status}>
          {orderStatusLabel(order.status)}
        </span>
        <span className={styles.detailMeta}>{new Date(order.createdAt).toLocaleString("vi-VN")}</span>
      </div>

      {order.status !== "cancelled" && (
        <ol className={styles.timeline} aria-label="Tiến trình giao hàng">
          {steps.map((s) => (
            <li key={s.code} className={styles.tlItem} data-state={s.state}>
              <span className={styles.tlDot} aria-hidden />
              <div>
                <div className={styles.tlTitle}>{s.label}</div>
                <div className={styles.tlHint}>{s.hint}</div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.detailTotal}>{formatPrice(order.total)}</div>
      <p className={styles.detailInfo}>
        <strong>Thanh toán:</strong>{" "}
        {order.paymentMethod === "ONLINE" ? "Thanh toán trực tuyến (ONLINE)" : "Thanh toán tiền mặt khi nhận hàng (COD)"}{" "}
        <span style={{
          fontWeight: 700,
          color: order.paymentStatus === "PAID" ? "#16a34a" : "#d97706",
          fontSize: 12,
          marginLeft: 6
        }}>
          ({order.paymentStatus === "PAID" ? "Đã thanh toán" : "Chờ thanh toán"})
        </span>
      </p>
      <p className={styles.detailInfo}><strong>Điện thoại:</strong> {order.phone}</p>
      <p className={styles.detailInfo}><strong>Địa chỉ:</strong> {order.address}</p>

      {order.paymentMethod === "ONLINE" && order.paymentStatus === "PENDING" && order.status !== "cancelled" && (
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fef3c7",
          padding: 16,
          borderRadius: 8,
          marginTop: 12,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}>
          <div style={{ color: "#b45309", fontWeight: 700, fontSize: 14 }}>
            💳 Đơn hàng đang chờ thanh toán trực tuyến
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            Bạn đã chọn phương thức thanh toán ONLINE. Vui lòng bấm vào nút dưới đây để giả lập thanh toán đơn hàng.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={async () => {
              try {
                const updatedOrder = await api.payOrder(order.id);
                setOrder(updatedOrder);
                toast({ type: "success", message: "Thanh toán trực tuyến giả lập thành công!" });
                setRefreshTrigger((prev) => prev + 1);
              } catch (e: any) {
                toast({ type: "error", message: e.message });
              }
            }}
          >
            💳 Giả lập thanh toán ngay
          </button>
        </div>
      )}

      {orderCanCustomerCancel(order.status) && (
        <div className={styles.cancelRow}>
          <button type="button" className={styles.btnCancel} disabled={cancelBusy} onClick={() => setCancelConfirm(true)}>
            {cancelBusy ? "Đang hủy…" : "Hủy đơn hàng"}
          </button>
          <span className={styles.cancelHint}>Chỉ hủy được khi đơn chưa chuyển sang giao hàng.</span>
        </div>
      )}

      {/* Return Request Row / Status Banner */}
      {orderReturn && (
        <div className={styles.returnBanner} role="status">
          <div className={styles.returnBannerTitle}>
            📦 Yêu cầu trả hàng: <span className={styles.returnStatusBadge} data-status={orderReturn.status}>{getReturnStatusLabel(orderReturn.status)}</span>
          </div>
          <div className={styles.returnBannerBody}>
            <p><strong>Lý do:</strong> {orderReturn.reason}</p>
            <p><strong>Số tiền hoàn lại dự kiến:</strong> {formatPrice(orderReturn.refund_amount)}</p>
            {orderReturn.items && orderReturn.items.length > 0 && (
              <div className={styles.returnItemsBrief}>
                <strong>Sản phẩm trả:</strong>{" "}
                {orderReturn.items.map((ri: any) => `${ri.product?.name || ri.productId} (SL: ${ri.return_quantity})`).join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {!orderReturn && (order.status === "delivered" || order.status === "completed") && (
        <div className={styles.returnRow}>
          <button type="button" className={styles.btnReturn} onClick={() => setShowReturnModal(true)}>
            🔄 Yêu cầu Trả hàng / Hoàn tiền
          </button>
          <span className={styles.returnHint}>Hỗ trợ trả hàng hoàn tiền nếu sản phẩm bị lỗi hoặc sai mô tả.</span>
        </div>
      )}

      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "20px 0 8px" }}>Sản phẩm</h3>
      <ul className={styles.detailItems}>
        {order.items.map((it) => {
          const isReviewed = reviews.some((r) => r.productId === it.product.id);
          return (
            <li key={it.id} className={styles.detailLine}>
              <div className={styles.detailLineTop}>
                <Link to={`/p/${it.product.slug}`} className={styles.detailPname}>
                  {it.product.name}
                </Link>
                <span className={styles.detailSubtot}>{formatPrice(it.price * it.quantity)}</span>
              </div>
              <div className={styles.detailLineBottom}>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  × {it.quantity} · {formatPrice(it.price)} / sp
                </span>
                {(order.status === "delivered" || order.status === "completed") && (
                  <div>
                    {isReviewed ? (
                      <span className={styles.reviewedBadge}>✓ Đã đánh giá</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnReview}
                        onClick={() => setActiveReviewProduct(it.product)}
                      >
                        ★ Viết đánh giá
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmModal
        open={cancelConfirm}
        title="Hủy đơn hàng?"
        message={`Bạn có chắc muốn hủy đơn hàng #${order.id.slice(0, 8)}? Hành động này không thể hoàn tác.`}
        confirmLabel="Hủy đơn"
        danger
        onConfirm={doCancel}
        onCancel={() => setCancelConfirm(false)}
      />

      <ReviewModal
        open={activeReviewProduct !== null}
        product={activeReviewProduct}
        orderId={order.id}
        onClose={() => setActiveReviewProduct(null)}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />

      <ReturnModal
        open={showReturnModal}
        order={order}
        onClose={() => setShowReturnModal(false)}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}

/* =========================================================
   REVIEW MODAL COMPONENT
   ========================================================= */
interface ReviewModalProps {
  open: boolean;
  product: any | null;
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewModal({ open, product, orderId, onClose, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setRating(5);
      setComment("");
      setError(null);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createReview({
        productId: product.id,
        rating,
        comment: comment.trim() || undefined,
        orderId,
      });
      toast({ type: "success", message: "Gửi đánh giá thành công! Đang chờ duyệt." });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Gửi đánh giá thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.reviewModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Đánh giá sản phẩm</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.productBrief}>
            <img src={product.image} alt={product.name} className={styles.productImg} />
            <div className={styles.productInfo}>
              <div className={styles.productName}>{product.name}</div>
            </div>
          </div>

          <div className={styles.ratingSection}>
            <div className={styles.ratingTitle}>Đánh giá của bạn về sản phẩm này:</div>
            <div className={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`${styles.star} ${(hoverRating ?? rating) >= star ? styles.starActive : ""}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  role="button"
                  aria-label={`${star} sao`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className={styles.ratingLabel}>
              {rating === 1 && "Rất tệ"}
              {rating === 2 && "Tệ"}
              {rating === 3 && "Bình thường"}
              {rating === 4 && "Tốt"}
              {rating === 5 && "Cực kỳ hài lòng"}
            </span>
          </div>

          <div className={styles.commentSection}>
            <label htmlFor="review-comment" className={styles.commentTitle}>Ý kiến của bạn về sản phẩm:</label>
            <textarea
              id="review-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Sản phẩm dùng tốt không, đóng gói có cẩn thận không, giao hàng nhanh không..."
              maxLength={1000}
              className={`input ${styles.textarea}`}
            />
            <span className={styles.charCount}>{comment.length}/1000 ký tự</span>
          </div>

          {error && <div className="form-alert" style={{ marginTop: 8 }} role="alert">{error}</div>}

          <div className={styles.modalActions}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>Hủy</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* =========================================================
   RETURN MODAL COMPONENT
   ========================================================= */
interface ReturnModalProps {
  open: boolean;
  order: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ReturnModal({ open, order, onClose, onSuccess }: ReturnModalProps) {
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; quantity: number }>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open && order) {
      const initial: Record<string, { selected: boolean; quantity: number }> = {};
      order.items.forEach((it: any) => {
        initial[it.product.id] = { selected: false, quantity: 1 };
      });
      setSelectedItems(initial);
      setReason("");
      setError(null);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, order]);

  if (!open || !order) return null;

  const toggleSelect = (productId: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        selected: !prev[productId].selected,
      },
    }));
  };

  const changeQty = (productId: string, delta: number, maxQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[productId];
      const newQty = Math.max(1, Math.min(maxQty, current.quantity + delta));
      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: newQty,
        },
      };
    });
  };

  const handleCheckboxChange = (productId: string, checked: boolean) => {
    setSelectedItems((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        selected: checked,
      },
    }));
  };

  const anySelected = Object.values(selectedItems).some((item) => item.selected);
  const selectedCount = Object.values(selectedItems).filter((item) => item.selected).length;

  const refundTotal = order.items.reduce((sum: number, it: any) => {
    const state = selectedItems[it.product.id];
    if (state && state.selected) {
      return sum + it.price * state.quantity;
    }
    return sum;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anySelected) {
      setError("Vui lòng chọn ít nhất 1 sản phẩm để trả.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Lý do trả hàng phải có ít nhất 5 ký tự.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const itemsToSend = order.items
      .filter((it: any) => selectedItems[it.product.id]?.selected)
      .map((it: any) => ({
        product_id: it.product.id,
        return_quantity: selectedItems[it.product.id].quantity,
      }));

    try {
      await api.createReturn({
        order_id: order.id,
        reason: reason.trim(),
        items: itemsToSend,
      });
      toast({ type: "success", message: "Gửi yêu cầu đổi trả thành công!" });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Gửi yêu cầu đổi trả thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.returnModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Yêu cầu Trả hàng / Hoàn tiền</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.modalHint}>
            Chọn sản phẩm bạn muốn trả lại. Bạn chỉ có thể trả tối đa số lượng sản phẩm đã đặt mua.
          </div>

          <div className={styles.itemsList}>
            {order.items.map((it: any) => {
              const state = selectedItems[it.product.id] || { selected: false, quantity: 1 };
              return (
                <div key={it.id} className={`${styles.itemRow} ${state.selected ? styles.itemRowActive : ""}`} onClick={() => toggleSelect(it.product.id)}>
                  <div className={styles.checkboxContainer} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      id={`check-${it.product.id}`}
                      checked={state.selected}
                      onChange={(e) => handleCheckboxChange(it.product.id, e.target.checked)}
                      className={styles.checkbox}
                    />
                  </div>
                  <img src={it.product.image} alt={it.product.name} className={styles.itemImg} />
                  <div className={styles.itemMeta}>
                    <div className={styles.itemName}>{it.product.name}</div>
                    <div className={styles.itemPrice}>Đơn giá: {formatPrice(it.price)}</div>
                    <div className={styles.itemMaxQty}>Mua tối đa: {it.quantity}</div>
                  </div>
                  {state.selected && (
                    <div className={styles.qtyControl} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => changeQty(it.product.id, -1, it.quantity)}
                        disabled={state.quantity <= 1}
                        className={styles.qtyBtn}
                      >
                        −
                      </button>
                      <span className={styles.qtyVal}>{state.quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQty(it.product.id, 1, it.quantity)}
                        disabled={state.quantity >= it.quantity}
                        className={styles.qtyBtn}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={styles.reasonSection}>
            <label htmlFor="return-reason" className={styles.reasonTitle}>Lý do trả hàng (tối thiểu 5 ký tự):</label>
            <textarea
              id="return-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mô tả chi tiết lý do (ví dụ: Giao sai sản phẩm, sản phẩm bị bể vỡ khi nhận...)"
              className={`input ${styles.textarea}`}
              required
            />
          </div>

          {error && <div className="form-alert" style={{ marginTop: 8 }} role="alert">{error}</div>}

          <div className={styles.refundSummary}>
            <div className={styles.refundRow}>
              <span>Số lượng sản phẩm trả:</span>
              <strong>{selectedCount} mặt hàng</strong>
            </div>
            <div className={styles.refundRow}>
              <span>Tổng tiền hoàn lại dự kiến:</span>
              <strong className={styles.refundTotal}>{formatPrice(refundTotal)}</strong>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={submitting}>Hủy</button>
            <button type="submit" className="btn btn-primary btn-danger btn-sm" disabled={submitting || !anySelected}>
              {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* =========================================================
   SETTINGS TAB
   ========================================================= */
function SettingsTab() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className={styles.contentPanel}>
      <h2 className={styles.contentTitle}>Cài đặt</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <Link to="/gioi-thieu" className="btn btn-outline btn-sm" style={{ justifyContent: "flex-start" }}>
          📖 Giới thiệu
        </Link>
        <a href="/api-docs" target="_blank" rel="noreferrer" className="btn btn-outline btn-sm" style={{ justifyContent: "flex-start" }}>
          📡 API Documentation
        </a>
        <hr className="divider" />
        <button
          type="button"
          className="btn btn-danger btn-sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() => {
            logout();
            toast({ type: "info", message: "Đã đăng xuất." });
            navigate("/");
          }}
        >
          🚪 Đăng xuất
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   ADDRESSES TAB
   ========================================================= */
type Address = import("@/shared/api/types").Address;

function AddressesTab() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Address form states
  const [provinces, setProvinces] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");
  const [selectedWardCode, setSelectedWardCode] = useState("");

  const [selectedProvinceName, setSelectedProvinceName] = useState("");
  const [selectedDistrictName, setSelectedDistrictName] = useState("");
  const [selectedWardName, setSelectedWardName] = useState("");

  const [streetAddress, setStreetAddress] = useState("");
  const [addressType, setAddressType] = useState<"HOME" | "OFFICE">("HOME");
  const [isDefault, setIsDefault] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchAddresses = () => {
    setLoading(true);
    api.addresses()
      .then(setAddresses)
      .catch((e: Error) => toast({ type: "error", message: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Load provinces on form open
  useEffect(() => {
    if (showForm) {
      fetch("https://provinces.open-api.vn/api/p/")
        .then((res) => res.json())
        .then(setProvinces)
        .catch((err) => console.error("Lỗi tải danh mục tỉnh thành:", err));
    }
  }, [showForm]);

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedProvinceCode(code);
    setSelectedDistrictCode("");
    setSelectedWardCode("");
    setDistricts([]);
    setWards([]);
    if (!code) {
      setSelectedProvinceName("");
      setSelectedDistrictName("");
      setSelectedWardName("");
      return;
    }
    const prov = provinces.find((p) => String(p.code) === code);
    setSelectedProvinceName(prov ? prov.name : "");
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`);
      const data = await res.json();
      setDistricts(data.districts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedDistrictCode(code);
    setSelectedWardCode("");
    setWards([]);
    if (!code) {
      setSelectedDistrictName("");
      setSelectedWardName("");
      return;
    }
    const dist = districts.find((d) => String(d.code) === code);
    setSelectedDistrictName(dist ? dist.name : "");
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`);
      const data = await res.json();
      setWards(data.wards || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedWardCode(code);
    if (!code) {
      setSelectedWardName("");
      return;
    }
    const wd = wards.find((w) => String(w.code) === code);
    setSelectedWardName(wd ? wd.name : "");
  };

  const openAddForm = () => {
    setEditingAddress(null);
    setSelectedProvinceCode("");
    setSelectedDistrictCode("");
    setSelectedWardCode("");
    setSelectedProvinceName("");
    setSelectedDistrictName("");
    setSelectedWardName("");
    setStreetAddress("");
    setAddressType("HOME");
    setIsDefault(false);
    setFieldErrors({});
    setShowForm(true);
  };

  const openEditForm = async (addr: Address) => {
    setEditingAddress(addr);
    setSelectedProvinceCode(addr.provinceId);
    setSelectedProvinceName(addr.provinceName);
    setStreetAddress(addr.streetAddress);
    setAddressType(addr.addressType);
    setIsDefault(addr.isDefault);
    setFieldErrors({});
    setShowForm(true);

    try {
      const resDist = await fetch(`https://provinces.open-api.vn/api/p/${addr.provinceId}?depth=2`);
      const dataDist = await resDist.json();
      setDistricts(dataDist.districts || []);
      setSelectedDistrictCode(addr.districtId);
      setSelectedDistrictName(addr.districtName);

      const resWard = await fetch(`https://provinces.open-api.vn/api/d/${addr.districtId}?depth=2`);
      const dataWard = await resWard.json();
      setWards(dataWard.wards || []);
      setSelectedWardCode(addr.wardId);
      setSelectedWardName(addr.wardName);
    } catch (err) {
      console.error("Lỗi khi load chi tiết địa chỉ sửa:", err);
    }
  };

  const deleteAddress = async (id: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa địa chỉ này?")) return;
    try {
      await api.deleteAddress(id);
      toast({ type: "success", message: "Đã xóa địa chỉ thành công." });
      fetchAddresses();
    } catch (e: any) {
      toast({ type: "error", message: e.message });
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      await api.setDefaultAddress(id);
      toast({ type: "success", message: "Đã thiết lập địa chỉ mặc định." });
      fetchAddresses();
    } catch (e: any) {
      toast({ type: "error", message: e.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: any = {};
    if (!selectedProvinceCode) fe.province = "Vui lòng chọn Tỉnh/Thành";
    if (!selectedDistrictCode) fe.district = "Vui lòng chọn Quận/Huyện";
    if (!selectedWardCode) fe.ward = "Vui lòng chọn Phường/Xã";
    if (!streetAddress.trim() || streetAddress.trim().length < 5) {
      fe.streetAddress = "Vui lòng nhập địa chỉ cụ thể (tối thiểu 5 ký tự)";
    }
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;

    setSaving(true);
    const body = {
      provinceId: selectedProvinceCode,
      provinceName: selectedProvinceName,
      districtId: selectedDistrictCode,
      districtName: selectedDistrictName,
      wardId: selectedWardCode,
      wardName: selectedWardName,
      streetAddress: streetAddress.trim(),
      addressType,
      isDefault,
    };

    try {
      if (editingAddress) {
        await api.updateAddress(editingAddress.id, body);
        toast({ type: "success", message: "Cập nhật địa chỉ thành công!" });
      } else {
        await api.createAddress(body);
        toast({ type: "success", message: "Thêm địa chỉ thành công!" });
      }
      setShowForm(false);
      fetchAddresses();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Lỗi lưu địa chỉ." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.contentPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 className={styles.contentTitle} style={{ margin: 0, border: "none", padding: 0 }}>Sổ địa chỉ</h2>
        {!showForm && (
          <button type="button" className="btn btn-primary btn-sm" onClick={openAddForm}>
            ➕ Thêm địa chỉ mới
          </button>
        )}
      </div>

      {showForm && (
        <form className={styles.addressForm} onSubmit={handleSubmit}>
          <h3>{editingAddress ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}</h3>
          <div className={styles.addressGrid}>
            <label>
              Tỉnh / Thành phố *
              <select className="input" value={selectedProvinceCode} onChange={handleProvinceChange}>
                <option value="">-- Chọn Tỉnh/Thành --</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
              {fieldErrors.province && <span className="field-error">{fieldErrors.province}</span>}
            </label>

            <label>
              Quận / Huyện *
              <select className="input" value={selectedDistrictCode} onChange={handleDistrictChange} disabled={!selectedProvinceCode}>
                <option value="">-- Chọn Quận/Huyện --</option>
                {districts.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
              {fieldErrors.district && <span className="field-error">{fieldErrors.district}</span>}
            </label>

            <label>
              Phường / Xã *
              <select className="input" value={selectedWardCode} onChange={handleWardChange} disabled={!selectedDistrictCode}>
                <option value="">-- Chọn Phường/Xã --</option>
                {wards.map((w) => (
                  <option key={w.code} value={w.code}>{w.name}</option>
                ))}
              </select>
              {fieldErrors.ward && <span className="field-error">{fieldErrors.ward}</span>}
            </label>
          </div>

          <label>
            Số nhà, tên đường *
            <textarea
              className="input"
              rows={2}
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="VD: số 12 đường Hoàng Diệu..."
            />
            {fieldErrors.streetAddress && <span className="field-error">{fieldErrors.streetAddress}</span>}
          </label>

          <label>
            Loại địa chỉ
            <div className={styles.typeSelector} style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="radio" name="formAddressType" checked={addressType === "HOME"} onChange={() => setAddressType("HOME")} />
                Nhà riêng
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="radio" name="formAddressType" checked={addressType === "OFFICE"} onChange={() => setAddressType("OFFICE")} />
                Văn phòng / Cơ quan
              </label>
            </div>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} disabled={editingAddress?.isDefault} />
            Đặt làm địa chỉ mặc định
          </label>

          <div className={styles.addressActionRow} style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu địa chỉ"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowForm(false)} disabled={saving}>
              Hủy
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>
      ) : addresses.length === 0 ? (
        <div className="empty-state" style={{ padding: 24 }}>
          <p>Bạn chưa lưu địa chỉ giao hàng nào.</p>
        </div>
      ) : (
        <div className={styles.addressList}>
          {addresses.map((addr) => (
            <div key={addr.id} className={`${styles.addressCard} ${addr.isDefault ? styles.addressCardDefault : ""}`}>
              <div className={styles.addressInfo}>
                <div className={styles.addressBadgeRow}>
                  <span className={styles.addressTypeBadge}>{addr.addressType === "HOME" ? "Nhà riêng" : "Văn phòng"}</span>
                  {addr.isDefault && <span className={styles.defaultBadge}>Mặc định</span>}
                </div>
                <div className={styles.addressStreet}>{addr.streetAddress}</div>
                <div className={styles.addressDetailText}>
                  {addr.wardName}, {addr.districtName}, {addr.provinceName}
                </div>
              </div>
              <div className={styles.addressActions}>
                <div className={styles.addressActionRow}>
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => openEditForm(addr)}>Sửa</button>
                  <button type="button" className="btn btn-outline btn-xs btn-danger" onClick={() => deleteAddress(addr.id)} disabled={addr.isDefault}>Xóa</button>
                </div>
                {!addr.isDefault && (
                  <button type="button" className="btn btn-link btn-xs" onClick={() => setAsDefault(addr.id)}>
                    Đặt làm mặc định
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   NOTIFICATIONS TAB
   ========================================================= */
type Notification = import("@/shared/api/types").Notification;

function NotificationsTab() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    setLoading(true);
    api.notifications()
      .then(setNotifications)
      .catch((e: Error) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (e: any) {
      toast({ type: "error", message: e.message });
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast({ type: "success", message: "Đã đánh dấu tất cả là đã đọc." });
    } catch (e: any) {
      toast({ type: "error", message: e.message });
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className={styles.contentPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 className={styles.contentTitle} style={{ margin: 0, border: "none", padding: 0 }}>
          Thông báo {unreadCount > 0 && `(${unreadCount})`}
        </h2>
        {unreadCount > 0 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>
            ✓ Đọc tất cả
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>
      ) : notifications.length === 0 ? (
        <div className="empty-state" style={{ padding: 24 }}>
          <p>Bạn không có thông báo nào.</p>
        </div>
      ) : (
        <div className={styles.notifFeed}>
          {notifications.map((n) => (
            <div key={n.id} className={`${styles.notifCard} ${!n.isRead ? styles.notifUnread : ""}`}>
              <span className={styles.notifIcon} aria-hidden>📢</span>
              <div className={styles.notifBody}>
                <div className={styles.notifTitle}>{n.title}</div>
                <div className={styles.notifContentText}>{n.content}</div>
                <div className={styles.notifTime}>
                  {new Date(n.createdAt).toLocaleString("vi-VN")}
                </div>
              </div>
              {!n.isRead && (
                <button type="button" className={styles.notifMarkReadBtn} onClick={() => markRead(n.id)}>
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   WISHLIST TAB
   ========================================================= */
type Product = import("@/shared/api/types").Product;

function WishlistTab() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = () => {
    setLoading(true);
    api.wishlist()
      .then(setWishlistItems)
      .catch((e: Error) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) fetchWishlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const removeWishlist = async (productId: string) => {
    try {
      await api.removeWishlist(productId);
      setWishlistItems((prev) => prev.filter((p) => p.id !== productId));
      toast({ type: "success", message: "Đã xóa sản phẩm khỏi danh sách yêu thích." });
    } catch (e: any) {
      toast({ type: "error", message: e.message });
    }
  };

  const addToCart = async (productId: string) => {
    try {
      await api.addCart(productId, 1);
      toast({ type: "success", message: "Đã thêm sản phẩm vào giỏ hàng!" });
      // Update cart count
      const c = await api.cart();
      useCartStore.getState().setCount(c.items.reduce((s, i) => s + i.quantity, 0));
    } catch (e: any) {
      toast({ type: "error", message: e.message });
    }
  };

  return (
    <div className={styles.contentPanel}>
      <h2 className={styles.contentTitle}>Sản phẩm yêu thích</h2>

      {loading ? (
        <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>
      ) : wishlistItems.length === 0 ? (
        <div className="empty-state" style={{ padding: 24 }}>
          <p>Danh sách yêu thích trống.</p>
          <Link to="/" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className={styles.wishlistGrid}>
          {wishlistItems.map((p) => (
            <div key={p.id} className={styles.wishlistCard}>
              <Link to={`/p/${p.slug}`} className={styles.wishlistImgLink}>
                <img src={p.image} alt={p.name} className={styles.wishlistImg} />
              </Link>
              <div className={styles.wishlistContent}>
                <Link to={`/p/${p.slug}`} className={styles.wishlistName}>
                  {p.name}
                </Link>
                <div className={styles.wishlistPriceRow}>
                  <span className={styles.wishlistPrice}>{formatPrice(p.price)}</span>
                </div>
              </div>
              <div className={styles.wishlistActions}>
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  style={{ flex: 1, padding: "4px 8px", fontSize: 11 }}
                  onClick={() => addToCart(p.id)}
                >
                  🛒 Thêm giỏ
                </button>
                <button
                  type="button"
                  className={styles.wishlistRemoveBtn}
                  onClick={() => removeWishlist(p.id)}
                  title="Xóa yêu thích"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
