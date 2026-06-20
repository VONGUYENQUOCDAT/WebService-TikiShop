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
      <SellerDashboard shop={shop!} />
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

/* =========================================================
   SELLER DASHBOARD & SUB-TABS COMPONENTS
   ========================================================= */
import { formatPrice } from "@/shared/lib/format";
import { orderStatusLabel } from "@/shared/lib/order-status";

interface SellerDashboardProps {
  shop: Shop;
}

function SellerDashboard({ shop: initialShop }: SellerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "orders" | "stock" | "settings">("overview");
  const [shop, setShop] = useState(initialShop);

  const TABS = [
    { value: "overview", label: "📊 Tổng quan", component: <SellerOverviewTab /> },
    { value: "products", label: "📦 Sản phẩm", component: <SellerProductsTab /> },
    { value: "orders", label: "📋 Đơn hàng", component: <SellerOrdersTab /> },
    { value: "stock", label: "🏢 Tồn kho", component: <SellerStockTab /> },
    { value: "settings", label: "⚙️ Thiết lập", component: <SellerSettingsTab shop={shop} onShopUpdate={setShop} /> },
  ] as const;

  return (
    <div className={`container ${styles.page}`} style={{ maxWidth: 1200 }}>
      <div className={styles.hero} style={{ padding: "24px 32px", marginBottom: 20 }}>
        <h1>🏪 Kênh Người Bán: {shop.shopName}</h1>
        <p>Hệ thống Quản lý Bán hàng của bạn trên Tiki Tropical Tech Island</p>
      </div>

      <div className={styles.dashboardLayout}>
        <aside className={styles.sidebar}>
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`${styles.tabBtn} ${activeTab === t.value ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </aside>

        <main className={styles.dashboardContent} style={{ flex: 1 }}>
          {TABS.find((t) => t.value === activeTab)?.component}
        </main>
      </div>
    </div>
  );
}

function SellerOverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sellerStats()
      .then(setStats)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>;

  return (
    <div>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Doanh thu tích lũy</span>
          <span className={styles.statVal} style={{ color: "var(--tiki-orange)" }}>
            {stats ? (stats.totalRevenue ? stats.totalRevenue.toLocaleString() + "đ" : "0đ") : "0đ"}
          </span>
          <span className={styles.statDesc}>Từ các đơn đã giao thành công</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Tổng đơn hàng</span>
          <span className={styles.statVal}>{stats?.totalOrdersCount || 0}</span>
          <span className={styles.statDesc}>Đơn hàng chứa sản phẩm của shop</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Sản phẩm đang bán</span>
          <span className={styles.statVal}>{stats?.productsCount || 0}</span>
          <span className={styles.statDesc}>Các sản phẩm hiển thị trên sàn</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Tổng tồn kho</span>
          <span className={styles.statVal}>{stats?.totalStock || 0}</span>
          <span className={styles.statDesc}>Số lượng sản phẩm tại các chi nhánh</span>
        </div>
      </div>
    </div>
  );
}

function SellerProductsTab() {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [image, setImage] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [badge, setBadge] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.sellerProducts(),
      api.categories()
    ])
      .then(([prodData, catData]) => {
        setProducts((prodData as any).items || prodData);
        setCategories(catData);
      })
      .catch((err) => toast({ type: "error", message: err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingProduct(null);
    setName("");
    setSlug("");
    setDescription("");
    setPrice("");
    setListPrice("");
    setImage("");
    setBrand("");
    setCategoryId(categories[0]?.id || "");
    setBadge("");
    setShowModal(true);
  };

  const openEdit = (p: any) => {
    setEditingProduct(p);
    setName(p.name);
    setSlug(p.slug);
    setDescription(p.description);
    setPrice(String(p.price));
    setListPrice(p.listPrice ? String(p.listPrice) : "");
    setImage(p.image);
    setBrand(p.brand || "");
    setCategoryId(p.categoryId);
    setBadge(p.badge || "");
    setShowModal(true);
  };

  const deleteProd = async (id: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
    try {
      await api.sellerDeleteProduct(id);
      toast({ type: "success", message: "Đã xóa sản phẩm thành công." });
      loadData();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Không thể xóa sản phẩm." });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !price || !image || !categoryId) {
      toast({ type: "error", message: "Vui lòng điền đầy đủ các thông tin bắt buộc (*)." });
      return;
    }

    setSaving(true);
    const body = {
      name,
      slug,
      description,
      price: Number(price),
      listPrice: listPrice ? Number(listPrice) : null,
      image,
      brand: brand || null,
      categoryId,
      badge: badge || null
    };

    try {
      if (editingProduct) {
        await api.sellerUpdateProduct(editingProduct.id, body);
        toast({ type: "success", message: "Đã cập nhật sản phẩm thành công." });
      } else {
        await api.sellerCreateProduct(body);
        toast({ type: "success", message: "Đã thêm sản phẩm thành công." });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Lỗi lưu sản phẩm." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Quản lý Sản phẩm</h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          ➕ Thêm sản phẩm mới
        </button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Hình</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Giá bán</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 20 }}>
                  Bạn chưa có sản phẩm nào
                </td>
              </tr>
            ) : (
              products.map((p: any) => (
                <tr key={p.id}>
                  <td><img src={p.image} alt={p.name} className={styles.pImg} /></td>
                  <td>
                    <Link to={`/p/${p.slug}`} target="_blank" style={{ fontWeight: 600, color: "var(--tiki-blue)" }}>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.category?.name || "N/A"}</td>
                  <td><strong>{p.price.toLocaleString()}đ</strong></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="btn btn-outline btn-xs" onClick={() => openEdit(p)}>Sửa</button>
                      <button type="button" className="btn btn-outline btn-xs btn-danger" onClick={() => deleteProd(p.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialogContent}>
            <h3>{editingProduct ? "Chỉnh sửa sản phẩm" : "Đăng bán sản phẩm mới"}</h3>
            <form onSubmit={handleSubmit} className={styles.form} style={{ marginTop: 14 }}>
              <label>
                Tên sản phẩm *
                <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Đường dẫn Slug (URL) *
                <input type="text" className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="vd: tropical-tech-phone" required />
              </label>
              <label>
                Mô tả sản phẩm *
                <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
              </label>
              <div className={styles.formRow}>
                <label>
                  Giá bán *
                  <input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </label>
                <label>
                  Giá gốc niêm yết (nếu có)
                  <input type="number" className="input" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
                </label>
              </div>
              <label>
                Đường dẫn hình ảnh sản phẩm (Image URL) *
                <input type="text" className="input" value={image} onChange={(e) => setImage(e.target.value)} required />
              </label>
              <div className={styles.formRow}>
                <label>
                  Thương hiệu
                  <input type="text" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
                </label>
                <label>
                  Danh mục sản phẩm *
                  <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Nhãn thu hút (Badge - vd: Rẻ hơn hoàn tiền)
                <input type="text" className="input" value={badge} onChange={(e) => setBadge(e.target.value)} />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu sản phẩm"}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowModal(false)} disabled={saving}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SellerOrdersTab() {
  const toast = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = () => {
    setLoading(true);
    api.sellerOrders()
      .then(setOrders)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (orderId: string, nextStatus: string) => {
    try {
      await api.sellerUpdateOrderStatus(orderId, nextStatus);
      toast({ type: "success", message: `Đã chuyển đơn hàng sang trạng thái: ${orderStatusLabel(nextStatus)}` });
      loadOrders();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Lỗi cập nhật trạng thái đơn hàng." });
    }
  };

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>;

  return (
    <div>
      <h3>Đơn hàng cần xử lý</h3>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Ngày đặt</th>
              <th>Khách hàng</th>
              <th>Sản phẩm</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Xử lý</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 20 }}>
                  Chưa có đơn hàng nào
                </td>
              </tr>
            ) : (
              orders.map((o: any) => {
                const shopItemsTotal = o.items.reduce((sum: number, it: any) => sum + it.price * it.quantity, 0);
                return (
                  <tr key={o.id}>
                    <td><span style={{ fontWeight: 700 }}>#{o.id.slice(0, 8)}</span></td>
                    <td>{new Date(o.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td>
                      <strong>{o.user?.name}</strong><br/>
                      <span style={{ fontSize: 11, color: "#666" }}>SĐT: {o.phone}</span>
                    </td>
                    <td>
                      {o.items.map((it: any) => (
                        <div key={it.id} style={{ fontSize: 12, marginBottom: 4 }}>
                          · {it.product?.name} (x{it.quantity})
                        </div>
                      ))}
                    </td>
                    <td><strong style={{ color: "var(--tiki-orange)" }}>{formatPrice(shopItemsTotal)}</strong></td>
                    <td>
                      <span className={styles.stateBadge} style={{
                        background: o.status === "cancelled" ? "#fee2e2" : o.status === "delivered" ? "#dcfce7" : "#fef3c7",
                        color: o.status === "cancelled" ? "#b91c1c" : o.status === "delivered" ? "#166534" : "#b45309",
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 99
                      }}>
                        {orderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td>
                      {o.status === "pending" && (
                        <button type="button" className="btn btn-primary btn-xs" onClick={() => updateStatus(o.id, "confirmed")}>
                          ✓ Xác nhận đơn
                        </button>
                      )}
                      {o.status === "confirmed" && (
                        <button type="button" className="btn btn-primary btn-xs" onClick={() => updateStatus(o.id, "processing")}>
                          📦 Đóng gói hàng
                        </button>
                      )}
                      {o.status === "processing" && (
                        <button type="button" className="btn btn-primary btn-xs" onClick={() => updateStatus(o.id, "shipped")}>
                          🚚 Giao cho vận chuyển
                        </button>
                      )}
                      {o.status === "shipped" && (
                        <button type="button" className="btn btn-primary btn-xs" onClick={() => updateStatus(o.id, "delivered")}>
                          🏠 Giao hàng thành công
                        </button>
                      )}
                      {["delivered", "cancelled", "completed"].includes(o.status) && (
                        <span style={{ fontSize: 11, color: "#666" }}>Không có thao tác</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SellerStockTab() {
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sellerStock()
      .then(setStock)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, textAlign: "center" }}><div className="spinner" /></div>;

  return (
    <div>
      <h3>Quản lý tồn kho tại các Chi nhánh</h3>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Hình</th>
              <th>Sản phẩm</th>
              <th>Chi nhánh</th>
              <th>Tồn kho</th>
            </tr>
          </thead>
          <tbody>
            {stock.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 20 }}>
                  Không có thông tin tồn kho
                </td>
              </tr>
            ) : (
              stock.map((item: any) => (
                <tr key={item.id}>
                  <td><img src={item.product?.image} alt="" className={styles.pImg} /></td>
                  <td><strong>{item.product?.name}</strong><br/><span style={{ fontSize: 10, color: "#666" }}>SKU: {item.product?.sku || "N/A"}</span></td>
                  <td>{item.branch?.name}</td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: item.stock <= item.minStock ? "red" : "inherit"
                    }}>
                      {item.stock}
                    </span>{" "}
                    {item.stock <= item.minStock && (
                      <span style={{ fontSize: 10, color: "red", marginLeft: 6 }}>
                        ⚠️ Dưới định mức ({item.minStock})
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SellerSettingsTabProps {
  shop: Shop;
  onShopUpdate: (shop: Shop) => void;
}

function SellerSettingsTab({ shop, onShopUpdate }: SellerSettingsTabProps) {
  const toast = useToast();
  const [shopName, setShopName] = useState(shop.shopName);
  const [businessAddress, setBusinessAddress] = useState(shop.businessAddress);
  const [taxCode, setTaxCode] = useState(shop.taxCode || "");
  const [idCard, setIdCard] = useState(shop.idCard || "");
  const [bankAccount, setBankAccount] = useState(shop.bankAccount || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !businessAddress.trim()) {
      toast({ type: "error", message: "Vui lòng nhập tên shop và địa chỉ kinh doanh." });
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateSellerProfile({
        shopName: shopName.trim(),
        businessAddress: businessAddress.trim(),
        taxCode: taxCode.trim() || null,
        idCard: idCard.trim() || null,
        bankAccount: bankAccount.trim() || null
      });
      onShopUpdate(res);
      toast({ type: "success", message: "Đã cập nhật thông tin gian hàng thành công!" });
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Lỗi cập nhật." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle} style={{ border: "none", padding: 0 }}>Thiết lập thông tin gian hàng</h3>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Tên gian hàng *</label>
          <input type="text" className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Địa chỉ kinh doanh / Kho hàng *</label>
          <input type="text" className="input" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} required />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Mã số thuế</label>
            <input type="text" className="input" value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>CMND / CCCD đại diện</label>
            <input type="text" className="input" value={idCard} onChange={(e) => setIdCard(e.target.value)} />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Tài khoản ngân hàng</label>
          <input type="text" className="input" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </form>
    </div>
  );
}
