import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { Order } from "@/shared/api/types";
import { formatPrice } from "@/shared/lib/format";
import {
  orderCanCustomerCancel,
  orderStatusLabel,
  orderTimelineSteps,
} from "@/shared/lib/order-status";
import { useAuthStore } from "@/store/authStore";
import styles from "./OrderDetailPage.module.css";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    if (!token || !id) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);

    const fetchOrder = async () => {
      try {
        let ord = await api.order(id);
        
        // If order uses ONLINE payment and is not marked PAID, check status on PayOS
        if (ord.paymentMethod === "ONLINE" && ord.paymentStatus !== "PAID") {
          try {
            ord = await api.verifyPayos(id);
          } catch (e) {
            console.error("Lỗi đồng bộ PayOS:", e);
          }
        }
        
        setOrder(ord);
      } catch (e: any) {
        setOrder(null);
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [token, id]);

  const cancel = async () => {
    if (!order || !id) return;
    const ok = window.confirm("Bạn có chắc muốn hủy đơn hàng này? (Chỉ áp dụng khi đơn chưa giao.)");
    if (!ok) return;
    setCancelBusy(true);
    setErr(null);
    try {
      const updated = await api.cancelOrder(id);
      setOrder(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không hủy được đơn");
    } finally {
      setCancelBusy(false);
    }
  };

  if (!token) {
    return (
      <div className={`container ${styles.page}`}>
        <p>
          <Link to="/dang-nhap">Đăng nhập</Link> để xem chi tiết đơn hàng.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`container ${styles.page}`}>
        <p className={styles.muted}>Đang tải đơn hàng…</p>
      </div>
    );
  }

  if (err || !order) {
    return (
      <div className={`container ${styles.page}`}>
        <p className="form-alert" role="alert">
          {err || "Không tìm thấy đơn hàng."}
        </p>
        <p className={styles.back}>
          <Link to="/don-hang">← Danh sách đơn hàng</Link>
        </p>
      </div>
    );
  }

  const steps = orderTimelineSteps(order.status);
  const label = orderStatusLabel(order.status);

  return (
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span aria-hidden>›</span>
        <Link to="/don-hang">Đơn hàng của tôi</Link>
        <span aria-hidden>›</span>
        <span>#{order.id.slice(0, 8)}</span>
      </nav>
      <h1 className={styles.title}>Chi tiết đơn hàng</h1>

      {order.status === "cancelled" && (
        <div className={styles.cancelBanner} role="status">
          Đơn hàng đã hủy. Nếu bạn đã thanh toán trước (demo không áp dụng), tiền sẽ được hoàn theo chính sách.
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.meta}>Mã đơn: #{order.id.slice(0, 8)}</span>
          <span className={styles.statusBadge} data-st={order.status}>
            {label}
          </span>
          <span className={styles.meta}>{new Date(order.createdAt).toLocaleString("vi-VN")}</span>
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

        <p className={styles.total}>{formatPrice(order.total)}</p>
        <p className={styles.codNote}>
          <strong>Thanh toán:</strong>{" "}
          {order.paymentMethod === "ONLINE" ? (
            <span>
              Thanh toán trực tuyến (ONLINE) —{" "}
              {order.paymentStatus === "PAID" ? (
                <span style={{ color: "#00ab56", fontWeight: "bold" }}>Đã thanh toán</span>
              ) : (
                <span style={{ color: "#ff7a00", fontWeight: "bold" }}>Chưa thanh toán (Chờ giao dịch)</span>
              )}
            </span>
          ) : (
            <span>COD — thanh toán khi nhận hàng (demo)</span>
          )}
        </p>

        {order.paymentMethod === "ONLINE" && order.paymentStatus !== "PAID" && order.status !== "cancelled" && (
          <div style={{ margin: "16px 0", padding: "16px", backgroundColor: "#f0fdf4", border: "1px dashed #4ade80", borderRadius: "8px" }}>
            <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#166534" }}>
              Đơn hàng của bạn chưa được thanh toán trực tuyến. Vui lòng bấm nút bên dưới để thanh toán qua cổng PayOS.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                try {
                  const res = await api.getPayosLink(order.id);
                  if (res.checkoutUrl) {
                    window.location.href = res.checkoutUrl;
                  }
                } catch (e: any) {
                  alert(e.message || "Không lấy được link thanh toán PayOS");
                }
              }}
            >
              Thanh toán ngay qua PayOS
            </button>
          </div>
        )}
        <p>
          <strong>Điện thoại:</strong> {order.phone}
        </p>
        <p className={styles.addr}>
          <strong>Địa chỉ nhận hàng:</strong> {order.address}
        </p>

        {orderCanCustomerCancel(order.status) && (
          <div className={styles.cancelRow}>
            <button type="button" className={styles.btnCancel} disabled={cancelBusy} onClick={() => void cancel()}>
              {cancelBusy ? "Đang hủy…" : "Hủy đơn hàng"}
            </button>
            <span className={styles.cancelHint}>Chỉ hủy được khi đơn chưa chuyển sang giao hàng (giống Tiki).</span>
          </div>
        )}

        <h2 className={styles.sub}>Sản phẩm</h2>
        <ul className={styles.items}>
          {order.items.map((it) => (
            <li key={it.id} className={styles.line}>
              <Link to={`/p/${it.product.slug}`} className={styles.pname}>
                {it.product.name}
              </Link>
              <span>
                × {it.quantity} · {formatPrice(it.price)} / sp
              </span>
              <span className={styles.subtot}>{formatPrice(it.price * it.quantity)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.back}>
        <Link to="/don-hang">← Quay lại danh sách đơn hàng</Link>
      </p>
    </div>
  );
}
