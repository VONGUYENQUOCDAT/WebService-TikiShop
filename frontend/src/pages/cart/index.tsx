import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { CartItem } from "@/shared/api/types";
import { formatPrice } from "@/shared/lib/format";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useToast, ConfirmModal } from "@/shared/ui";
import ImageWithFallback from "@/shared/ui/ImageWithFallback";
import styles from "./CartPage.module.css";

export default function CartPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clearConfirm, setClearConfirm] = useState(false);

  const load = () => {
    if (!token) return;
    api
      .cart()
      .then((c) => {
        setItems(c.items);
        useCartStore.getState().setCount(c.items.reduce((s, i) => s + i.quantity, 0));
        setSelectedIds((prev) => {
          // Keep previously selected items that still exist
          const existingIds = new Set(c.items.map((i) => i.id));
          if (prev.size === 0) return existingIds; // first load: select all
          const kept = new Set([...prev].filter((id) => existingIds.has(id)));
          return kept.size > 0 ? kept : existingIds;
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectedLines = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );
  const selectedSubtotal = useMemo(
    () => selectedLines.reduce((s, i) => s + i.product.price * i.quantity, 0),
    [selectedLines],
  );
  const allSelected = items.length > 0 && selectedLines.length === items.length;
  const noneSelected = selectedLines.length === 0;
  const hasInsufficientStock = useMemo(
    () => selectedLines.some((line) => line.product.stock_quantity === 0 || line.quantity > line.product.stock_quantity),
    [selectedLines]
  );

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(items.map((i) => i.id)));
    else setSelectedIds(new Set());
  };

  const goCheckout = () => {
    const ids = selectedLines.map((i) => i.id);
    if (ids.length === 0) return;
    navigate("/thanh-toan", { state: { cartItemIds: ids } });
  };

  const updateQty = async (id: string, quantity: number) => {
    if (quantity < 1 || quantity > 99) return;
    setActionLoading(id);
    try {
      await api.patchCart(id, quantity);
      load();
    } catch (e) {
      toast({ type: "error", message: (e as Error).message });
    } finally {
      setActionLoading(null);
    }
  };

  const remove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.removeCart(id);
      toast({ type: "success", message: "Đã xóa sản phẩm khỏi giỏ hàng." });
      load();
    } catch (e) {
      toast({ type: "error", message: (e as Error).message });
    } finally {
      setActionLoading(null);
    }
  };

  const clearAll = async () => {
    setClearConfirm(false);
    try {
      await api.clearCart();
      setItems([]);
      useCartStore.getState().setCount(0);
      toast({ type: "success", message: "Đã xóa toàn bộ giỏ hàng." });
    } catch (e) {
      toast({ type: "error", message: (e as Error).message });
    }
  };

  if (!token) {
    return (
      <div className={`container ${styles.shell}`}>
        <div className="empty-state">
          <h2>Chưa đăng nhập</h2>
          <p>Vui lòng đăng nhập để xem giỏ hàng của bạn.</p>
          <Link to="/dang-nhap" className="btn btn-primary" style={{ marginTop: 16 }}>
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`container ${styles.shell}`}>
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <div className="spinner spinner-lg" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "var(--muted)" }}>Đang tải giỏ hàng…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>
        Giỏ hàng
        {items.length > 0 && <span className={styles.titleCount}>({items.length})</span>}
      </h1>

      {items.length === 0 ? (
        <div className="empty-state">
          <h3>Giỏ hàng trống</h3>
          <p>Hãy thêm sản phẩm bạn muốn mua vào giỏ nhé!</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.mainCol}>
            <div className={styles.toolbar}>
              <label className={styles.selectAll}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelectAll(e.target.checked)}
                  aria-label="Chọn tất cả sản phẩm để mua"
                />
                <span>Chọn tất cả ({items.length})</span>
              </label>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setClearConfirm(true)}
              >
                Xóa tất cả
              </button>
            </div>
            <ul className={styles.list}>
              {items.map((row) => (
                <li key={row.id} className={`${styles.row} ${actionLoading === row.id ? styles.rowLoading : ""}`}>
                  <label className={styles.selectCell}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`Chọn ${row.product.name}`}
                    />
                  </label>
                  <Link to={`/p/${row.product.slug}`} className={styles.thumb}>
                    <ImageWithFallback src={row.product.image} alt="" width={96} height={96} />
                  </Link>
                  <div className={styles.detail}>
                    <Link to={`/p/${row.product.slug}`} className={styles.name}>
                      {row.product.name}
                    </Link>
                    <div className={styles.price}>{formatPrice(row.product.price)}</div>
                    {row.product.stock_quantity === 0 ? (
                      <div className={styles.outOfStockLabel} style={{ color: "#ef4444", fontSize: "0.82rem", fontWeight: 700, marginTop: 4 }}>
                        Out of stock / Hết hàng
                      </div>
                    ) : row.quantity > row.product.stock_quantity ? (
                      <div className={styles.insufficientStockLabel} style={{ color: "#f59e0b", fontSize: "0.82rem", fontWeight: 600, marginTop: 4 }}>
                        ⚠️ Exceeds stock (Only {row.product.stock_quantity} left)
                      </div>
                    ) : null}
                    <div className={styles.qty}>
                      <button
                        type="button"
                        onClick={() => updateQty(row.id, Math.max(1, row.quantity - 1))}
                        disabled={row.quantity <= 1 || actionLoading === row.id || row.product.stock_quantity === 0}
                      >
                        −
                      </button>
                      <span>{row.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(row.id, Math.min(Math.min(99, row.product.stock_quantity), row.quantity + 1))}
                        disabled={row.quantity >= row.product.stock_quantity || actionLoading === row.id}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => remove(row.id)}
                        disabled={actionLoading === row.id}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  <div className={styles.lineTotal}>
                    {formatPrice(row.product.price * row.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <aside className={styles.summary}>
            <div className={styles.summaryCard}>
              <h3 className={styles.summaryTitle}>Tóm tắt đơn hàng</h3>
              <div className={styles.summaryRow}>
                <span>Tạm tính ({selectedLines.length} sản phẩm)</span>
                <strong>{formatPrice(selectedSubtotal)}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Phí vận chuyển</span>
                <span className={styles.freeLabel}>Miễn phí</span>
              </div>
              <hr className="divider" />
              <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                <span>Tổng thanh toán</span>
                <strong className={styles.totalPrice}>{formatPrice(selectedSubtotal)}</strong>
              </div>
              {noneSelected && (
                <p className={styles.warn} role="status">
                  Hãy chọn ít nhất một sản phẩm để tiếp tục.
                </p>
              )}
              {hasInsufficientStock && (
                <p className={styles.warn} role="status" style={{ color: "#ef4444" }}>
                  Một số sản phẩm đã chọn không đủ hàng. Vui lòng giảm số lượng.
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={goCheckout}
                disabled={noneSelected || hasInsufficientStock}
                style={{ width: "100%", marginTop: 8 }}
              >
                Mua hàng ({selectedLines.length})
              </button>
              <Link to="/" className={styles.continue}>
                ← Tiếp tục mua sắm
              </Link>
            </div>
          </aside>
        </div>
      )}

      <ConfirmModal
        open={clearConfirm}
        title="Xóa toàn bộ giỏ hàng?"
        message="Tất cả sản phẩm trong giỏ hàng sẽ bị xóa. Bạn có chắc chắn không?"
        confirmLabel="Xóa tất cả"
        danger
        onConfirm={clearAll}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  );
}
