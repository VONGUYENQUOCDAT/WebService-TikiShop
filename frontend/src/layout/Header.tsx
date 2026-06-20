import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/lib/api-error";
import { isAdmin } from "@/shared/lib/roles";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import SearchBox from "./SearchBox";
import TikiLogo from "./TikiLogo";
import styles from "./Header.module.css";

const HOT_KEYS = ["iphone 15", "samsung a54", "laptop", "tai nghe", "nồi chiên không dầu"];

function IconCart({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 8V6a4 4 0 118 0v2M4 8h16l-1.2 9.6A2 2 0 0116.82 20H7.18a2 2 0 01-1.98-1.6L4 8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 20v-1a5 5 0 0110 0v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const { user, token, logout, setUser } = useAuthStore();
  const cartCount = useCartStore((s) => s.count);

  useEffect(() => {
    if (!token) return;
    api
      .me()
      .then((u) => setUser(u))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) logout();
      });
  }, [token, setUser, logout]);

  useEffect(() => {
    if (!token) {
      useCartStore.getState().setCount(0);
      return;
    }
    api
      .cart()
      .then((c) => useCartStore.getState().setCount(c.items.reduce((s, i) => s + i.quantity, 0)))
      .catch(() => useCartStore.getState().setCount(0));
  }, [token]);

  return (
    <header className={styles.header}>
      {/* Tầng 1: Top Banner (Khuyến mãi) */}
      <div className={styles.topBanner}>
        <div className={styles.headerContainer}>
          Freeship đơn từ 45k, giảm nhiều hơn cùng FREESHIP XTRA
        </div>
      </div>

      {/* Tầng 2: Main Header (Logo, Tìm kiếm, Actions & Location) */}
      <div className={styles.mainHeader}>
        <div className={styles.headerContainer}>
          <div className={styles.mainRow}>
            {/* Khối Trái: Logo & Slogan */}
            <div className={styles.logoCol}>
              <TikiLogo />
            </div>

            {/* Khối Giữa: Search Bar & Quick Links */}
            <div className={styles.searchCol}>
              <SearchBox />
              <div className={styles.quickLinks}>
                {HOT_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={styles.quickLinkBtn}
                    onClick={() => navigate(`/tim-kiem?q=${encodeURIComponent(k)}`)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Khối Phải: Nav Actions & Location */}
            <div className={styles.rightCol}>
              {/* Hàng trên: Các nút chức năng */}
              <div className={styles.actions}>
                <Link to="/" className={styles.actionItem} style={{ color: "#0b74de" }}>
                  <svg className={styles.actionIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Trang chủ</span>
                </Link>

                <div className={styles.actionItem}>
                  <svg className={styles.actionIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" fillOpacity="0.2">
                    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
                    <path d="M3 20h18" strokeWidth="3" />
                  </svg>
                  <span>Tiki VIP</span>
                </div>

                <div className={styles.actionItem}>
                  <IconUser className={styles.actionIcon} />
                  {user ? (
                    <div className={styles.accountText}>
                      <Link to="/tai-khoan" className={styles.accountName}>
                        {user.name}
                      </Link>
                      <button type="button" className={styles.logout} onClick={() => logout()}>
                        Thoát
                      </button>
                    </div>
                  ) : (
                    <div className={styles.accountText}>
                      <div className={styles.authLinks}>
                        <Link to="/dang-nhap" className={styles.loginBtn}>Đăng nhập</Link>
                        <span className={styles.authSep}>/</span>
                        <Link to="/dang-ky" className={styles.registerBtn}>Đăng ký</Link>
                      </div>
                    </div>
                  )}
                </div>

                <Link to="/gio-hang" className={`${styles.actionItem} ${styles.cart}`}>
                  <span className={styles.cartIconWrap}>
                    <IconCart />
                    {cartCount > 0 && (
                      <span className={styles.badge}>{cartCount > 99 ? "99+" : cartCount}</span>
                    )}
                  </span>
                  <span>Giỏ hàng</span>
                </Link>
              </div>

              {/* Hàng dưới: Location */}
              <div className={styles.location}>
                <IconMapPin className={styles.locationIcon} />
                <span className={styles.locationText}>
                  Giao đến: <u>Q. 1, P. Bến Nghé, Hồ Chí Minh</u>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tầng 3: Thanh Cam kết (Commitment Bar) */}
      <div className={styles.commitmentBar}>
        <div className={`${styles.headerContainer} ${styles.commitmentContainer}`}>
          <div className={styles.commitmentLeft}>
            <span className={styles.commitmentTitle}>Cam kết</span>
            <div className={styles.commitmentItems}>
              <div className={styles.commitmentItem}>
                <svg className={styles.checkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>100% hàng thật</span>
              </div>
              <div className={styles.commitmentItem}>
                <svg className={styles.checkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Freeship mọi đơn</span>
              </div>
              <div className={styles.commitmentItem}>
                <svg className={styles.checkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>30 ngày đổi trả</span>
              </div>
              <div className={styles.commitmentItem}>
                <svg className={styles.checkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Hoàn tiền 111% nếu hàng giả</span>
              </div>
            </div>
          </div>

          {/* Dev Utilities (Admin, API Docs) */}
          <div className={styles.devLinks}>
            {isAdmin(user) && (
              <Link to="/admin" className={styles.navAdmin}>
                Quản trị
              </Link>
            )}
            <a href="/api-docs" target="_blank" rel="noreferrer" className={styles.navMuted}>
              API Docs
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
