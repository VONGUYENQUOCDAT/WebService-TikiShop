import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { CartItem } from "@/shared/api/types";
import { formatPrice } from "@/shared/lib/format";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import styles from "./CheckoutPage.module.css";

type CheckoutLocationState = { cartItemIds?: string[] };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [phone, setPhone] = useState("");
  const [subtotal, setSubtotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  
  // Administrative address states
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
  
  // Shipping calculation state
  const [shippingFee, setShippingFee] = useState(0);

  // Voucher states
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [isManualVoucher, setIsManualVoucher] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [promoInput, setPromoInput] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{
    province?: string;
    district?: string;
    ward?: string;
    streetAddress?: string;
    phone?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);

  const checkoutFilterKey = useMemo(() => {
    const ids = (location.state as CheckoutLocationState | null)?.cartItemIds;
    if (!ids?.length) return "__ALL__";
    return [...ids].sort().join("\0");
  }, [location.state]);

  useEffect(() => {
    if (!token) {
      setCartLoading(false);
      return;
    }
    api
      .cart()
      .then((c) => {
        const stateIds =
          checkoutFilterKey === "__ALL__"
            ? undefined
            : (location.state as CheckoutLocationState | null)?.cartItemIds;
        const rows =
          stateIds && stateIds.length > 0 ? c.items.filter((i) => stateIds.includes(i.id)) : c.items;
        const nextSub = rows.reduce((s, i) => s + i.product.price * i.quantity, 0);
        setCartItems(rows);
        setSubtotal(nextSub);
        if (rows.length === 0) {
          navigate("/gio-hang", { replace: true });
        }
      })
      .catch(() => {
        setCartItems([]);
        setSubtotal(0);
      })
      .finally(() => setCartLoading(false));
  }, [token, navigate, checkoutFilterKey]);

  // Load provinces on mount
  useEffect(() => {
    fetch("https://provinces.open-api.vn/api/p/")
      .then((res) => res.json())
      .then((data) => setProvinces(data))
      .catch((err) => console.error("Lỗi tải danh mục tỉnh thành:", err));
  }, []);

  // Recalculate shipping whenever province or items change
  useEffect(() => {
    if (!selectedProvinceCode || cartItems.length === 0) {
      setShippingFee(0);
      return;
    }
    api.calculateShipping({
      provinceCode: selectedProvinceCode,
      items: cartItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    })
      .then((res) => setShippingFee(res.shippingFee))
      .catch((err) => console.error("Lỗi tính phí ship:", err));
  }, [selectedProvinceCode, cartItems]);

  // Automatic freeship voucher logic
  useEffect(() => {
    if (isManualVoucher) {
      return;
    }

    const condition_amount = 299000;
    if (subtotal >= condition_amount) {
      setVoucherCode("FREESHIP299");
      setVoucherDiscount(Math.min(shippingFee, 30000));
    } else {
      if (voucherCode === "FREESHIP299") {
        setVoucherCode("");
        setVoucherDiscount(0);
      }
    }
  }, [subtotal, shippingFee, isManualVoucher, voucherCode]);

  const handleApplyVoucher = async () => {
    if (!promoInput.trim()) return;
    setErr(null);
    setVoucherMessage(null);
    try {
      const res = await api.applyVoucher({
        code: promoInput.trim(),
        order_amount: subtotal,
      });
      
      if (res.code === "FREESHIP299") {
        setIsManualVoucher(false); // Managed by automatic shipping discount rules
        setVoucherCode("FREESHIP299");
        setVoucherDiscount(Math.min(shippingFee, 30000));
        setVoucherMessage({
          text: "🎉 Áp dụng mã FREESHIP299 thành công!",
          type: "success",
        });
      } else {
        setIsManualVoucher(true);
        setVoucherCode(res.code);
        setVoucherDiscount(res.discount_amount);
        setVoucherMessage({
          text: `🎉 Áp dụng mã ${res.code} thành công! Giảm ${formatPrice(res.discount_amount)}`,
          type: "success",
        });
      }
    } catch (e: any) {
      setVoucherMessage({
        text: e.message || "Mã giảm giá không hợp lệ hoặc không đủ điều kiện",
        type: "error",
      });
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherCode("");
    setVoucherDiscount(0);
    setVoucherMessage(null);
    setIsManualVoucher(false);
    setPromoInput("");
  };

  useEffect(() => {
    if (!token || !user?.phone) return;
    setPhone((cur) => (cur.trim() === "" ? user.phone! : cur));
  }, [token, user?.phone]);

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedProvinceCode(code);
    setSelectedDistrictCode("");
    setSelectedWardCode("");
    setDistricts([]);
    setWards([]);
    setFieldErrors((p) => ({ ...p, province: undefined }));

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
      console.error("Lỗi tải danh sách quận huyện:", err);
    }
  };

  const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedDistrictCode(code);
    setSelectedWardCode("");
    setWards([]);
    setFieldErrors((p) => ({ ...p, district: undefined }));

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
      console.error("Lỗi tải danh sách phường xã:", err);
    }
  };

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedWardCode(code);
    setFieldErrors((p) => ({ ...p, ward: undefined }));

    if (!code) {
      setSelectedWardName("");
      return;
    }

    const wd = wards.find((w) => String(w.code) === code);
    setSelectedWardName(wd ? wd.name : "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    
    // Perform custom cascading address form validation
    const fe: typeof fieldErrors = {};
    if (!selectedProvinceCode) fe.province = "Vui lòng chọn Tỉnh/Thành phố";
    if (!selectedDistrictCode) fe.district = "Vui lòng chọn Quận/Huyện";
    if (!selectedWardCode) fe.ward = "Vui lòng chọn Phường/Xã";
    if (!streetAddress.trim() || streetAddress.trim().length < 5) {
      fe.streetAddress = "Vui lòng nhập địa chỉ cụ thể (tối thiểu 5 ký tự)";
    }
    if (!phone.trim() || phone.trim().length < 8) {
      fe.phone = "Vui lòng nhập số điện thoại liên hệ hợp lệ";
    }

    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;

    setLoading(true);
    const fullAddressText = `${streetAddress.trim()}, ${selectedWardName}, ${selectedDistrictName}, ${selectedProvinceName}`;

    try {
      const order = await api.checkout({
        address: fullAddressText,
        phone: phone.trim(),
        cartItemIds: cartItems.map((i) => i.id),
        provinceId: selectedProvinceCode,
        provinceName: selectedProvinceName,
        districtId: selectedDistrictCode,
        districtName: selectedDistrictName,
        wardId: selectedWardCode,
        wardName: selectedWardName,
        streetAddress: streetAddress.trim(),
        addressType: addressType,
        voucherCode: voucherCode || undefined,
      });
      try {
        const c = await api.cart();
        useCartStore.getState().setCount(c.items.reduce((s, i) => s + i.quantity, 0));
      } catch {
        useCartStore.getState().setCount(0);
      }
      navigate(`/tai-khoan/don-hang/${order.id}`, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={`container ${styles.shell}`}>
        <p>
          <Link to="/dang-nhap">Đăng nhập</Link> để thanh toán.
        </p>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className={`container ${styles.shell}`}>
        <p>Đang tải giỏ hàng…</p>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <nav className={styles.breadcrumb} aria-label="Bước đặt hàng">
        <Link to="/gio-hang">Giỏ hàng</Link>
        <span className={styles.bcSep}>›</span>
        <span className={styles.bcCurrent}>Thanh toán &amp; đặt hàng</span>
      </nav>

      <h1 className={styles.title}>Thanh toán &amp; đặt hàng</h1>
      <p className={styles.lead}>
        Chỉ các sản phẩm bạn đã chọn ở giỏ hàng mới nằm trong đơn này; các món khác vẫn còn trong giỏ. Nhập địa chỉ giao hàng, chọn COD, đặt hàng — đơn ở trạng thái «Chờ xác nhận» cho đến khi shop xử lý.
      </p>

      <div className={styles.layout}>
        <section className={styles.formCard}>
          <h2 className={styles.sectionTitle}>Thông tin giao hàng</h2>
          <form noValidate className={styles.form} onSubmit={submit}>
            {/* 3 Dropdowns địa chỉ phụ thuộc */}
            <div className={styles.addressGrid}>
              <label>
                Tỉnh / Thành phố *
                <select
                  className={`input ${fieldErrors.province ? "input--invalid" : ""}`}
                  value={selectedProvinceCode}
                  onChange={handleProvinceChange}
                >
                  <option value="">-- Chọn Tỉnh/Thành --</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.province && (
                  <span className="field-error" role="alert">
                    {fieldErrors.province}
                  </span>
                )}
              </label>

              <label>
                Quận / Huyện *
                <select
                  className={`input ${fieldErrors.district ? "input--invalid" : ""}`}
                  value={selectedDistrictCode}
                  onChange={handleDistrictChange}
                  disabled={!selectedProvinceCode}
                >
                  <option value="">-- Chọn Quận/Huyện --</option>
                  {districts.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.district && (
                  <span className="field-error" role="alert">
                    {fieldErrors.district}
                  </span>
                )}
              </label>

              <label>
                Phường / Xã *
                <select
                  className={`input ${fieldErrors.ward ? "input--invalid" : ""}`}
                  value={selectedWardCode}
                  onChange={handleWardChange}
                  disabled={!selectedDistrictCode}
                >
                  <option value="">-- Chọn Phường/Xã --</option>
                  {wards.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.ward && (
                  <span className="field-error" role="alert">
                    {fieldErrors.ward}
                  </span>
                )}
              </label>
            </div>

            <label>
              Số nhà, tên đường *
              <textarea
                className={`input ${fieldErrors.streetAddress ? "input--invalid" : ""}`}
                rows={2}
                value={streetAddress}
                onChange={(e) => {
                  setStreetAddress(e.target.value);
                  setFieldErrors((p) => ({ ...p, streetAddress: undefined }));
                }}
                placeholder="VD: số 12 đường Hoàng Diệu..."
                aria-invalid={Boolean(fieldErrors.streetAddress)}
              />
              {fieldErrors.streetAddress && (
                <span className="field-error" role="alert">
                  {fieldErrors.streetAddress}
                </span>
              )}
            </label>

            <label>
              Loại địa chỉ
              <div className={styles.typeSelector}>
                <label className={styles.typeOption}>
                  <input
                    type="radio"
                    name="addressType"
                    checked={addressType === "HOME"}
                    onChange={() => setAddressType("HOME")}
                  />
                  <span>Nhà riêng</span>
                </label>
                <label className={styles.typeOption}>
                  <input
                    type="radio"
                    name="addressType"
                    checked={addressType === "OFFICE"}
                    onChange={() => setAddressType("OFFICE")}
                  />
                  <span>Cơ quan / Văn phòng</span>
                </label>
              </div>
            </label>

            <label>
              Số điện thoại liên hệ *
              <input
                className={`input ${fieldErrors.phone ? "input--invalid" : ""}`}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setFieldErrors((p) => ({ ...p, phone: undefined }));
                }}
                placeholder="VD: 0912345678"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone && (
                <span className="field-error" role="alert">
                  {fieldErrors.phone}
                </span>
              )}
            </label>

            <div className={styles.codBlock}>
              <h3 className={styles.codTitle}>Phương thức thanh toán</h3>
              <label className={styles.codChoice}>
                <input type="radio" name="pay" checked readOnly />
                <span>
                  <strong>Thanh toán tiền mặt khi nhận hàng (COD)</strong>
                  <span className={styles.codHint}>Bạn thanh toán bằng tiền mặt cho shipper khi nhận đơn — giống mặc định trên Tiki.</span>
                </span>
              </label>
            </div>

            {err && (
              <p className="form-alert" role="alert">
                {err}
              </p>
            )}
            <div className={styles.actions}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Đang đặt hàng…" : "Đặt hàng"}
              </button>
              <Link to="/gio-hang" className={styles.backLink}>
                ← Quay lại giỏ hàng
              </Link>
            </div>
          </form>
        </section>

        <section className={styles.summaryCard} aria-labelledby="checkout-summary-heading">
          <h2 id="checkout-summary-heading" className={styles.sectionTitle}>
            Đơn hàng ({cartItems.length} sản phẩm)
          </h2>
          <ul className={styles.lines}>
            {cartItems.map((row) => (
              <li key={row.id} className={styles.line}>
                <Link to={`/p/${row.product.slug}`} className={styles.thumb}>
                  <img src={row.product.image} alt="" width={72} height={72} loading="lazy" />
                </Link>
                <div className={styles.lineBody}>
                  <Link to={`/p/${row.product.slug}`} className={styles.pname}>
                    {row.product.name}
                  </Link>
                  <div className={styles.lineMeta}>
                    SL: {row.quantity} · {formatPrice(row.product.price)} / sản phẩm
                  </div>
                </div>
                <div className={styles.linePrice}>{formatPrice(row.product.price * row.quantity)}</div>
              </li>
            ))}
          </ul>

          <div className={styles.voucherSection}>
            {/* Success Alert Banner (green) */}
            {subtotal >= 299000 && voucherCode === "FREESHIP299" && (
              <div className={`${styles.alert} ${styles.alertSuccess}`}>
                <span className={styles.alertIcon}>🎉</span>
                <div className={styles.alertText}>
                  Tuyệt vời! Đơn hàng của bạn đã được tự động áp dụng mã <strong>FREESHIP</strong> cho đơn từ 299k!
                </div>
              </div>
            )}

            {/* Warning Alert Banner & Progress Bar (orange) */}
            {subtotal < 299000 && (
              <div className={`${styles.alert} ${styles.alertWarning}`}>
                <div className={styles.alertText}>
                  Mua thêm <strong>{formatPrice(299000 - subtotal)}</strong> để được <strong>TỰ ĐỘNG FREESHIP</strong> cho đơn hàng từ 299k!
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.min((subtotal / 299000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Manual Promo Entry Input Wrapper */}
            <div className={styles.promoBox}>
              <div className={styles.promoInputWrapper}>
                <input
                  type="text"
                  placeholder="Nhập mã giảm giá..."
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className={styles.promoInput}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleApplyVoucher}
                  className={styles.promoBtn}
                  disabled={loading || !promoInput.trim()}
                >
                  Áp dụng
                </button>
              </div>

              {/* Show currently applied coupon info */}
              {voucherCode && (
                <div className={styles.appliedVoucher}>
                  <span className={styles.appliedCode}>
                    Mã đang dùng: <strong>{voucherCode}</strong>
                    {voucherDiscount > 0 && ` (-${formatPrice(voucherDiscount)})`}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    className={styles.removeVoucherBtn}
                    title="Gỡ bỏ mã giảm giá"
                  >
                    Gỡ bỏ
                  </button>
                </div>
              )}

              {/* Feedback messages from manual apply attempts */}
              {voucherMessage && (
                <div
                  className={`${styles.voucherFeedback} ${
                    voucherMessage.type === "success" ? styles.feedbackSuccess : styles.feedbackError
                  }`}
                >
                  {voucherMessage.text}
                </div>
              )}
            </div>
          </div>

          <div className={styles.subtotalRow}>
            <span>Tạm tính</span>
            <strong>{formatPrice(subtotal)}</strong>
          </div>
          <div className={styles.subtotalRow}>
            <span>Phí vận chuyển</span>
            {shippingFee > 0 ? (
              <strong>{formatPrice(shippingFee)}</strong>
            ) : (
              <span className={styles.muted}>Miễn phí (chưa chọn tỉnh)</span>
            )}
          </div>
          {voucherDiscount > 0 && (
            <div className={`${styles.subtotalRow} ${styles.discountRow}`}>
              <span>Giảm giá voucher</span>
              <strong className={styles.discountText}>-{formatPrice(voucherDiscount)}</strong>
            </div>
          )}
          <div className={styles.totalRow}>
            <span>Tổng thanh toán</span>
            <strong>{formatPrice(Math.max(0, subtotal + shippingFee - voucherDiscount))}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}
