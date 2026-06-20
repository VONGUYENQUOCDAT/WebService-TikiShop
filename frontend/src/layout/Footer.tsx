import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer id="footer" className={styles.footer}>
      <div className={styles.top}>
        <div className="container">
          <div className={styles.grid}>
            {/* Column 1: CATEGORIES */}
            <div className={styles.col}>
              <h3 className={styles.heading}>CATEGORIES</h3>
              <ul className={styles.links}>
                <li>
                  <a href="/tim-kiem?q=thời trang">Fashion & Apparel</a>
                </li>
                <li>
                  <a href="/danh-muc/dien-tu-dien-may">Tech Island Gadgets</a>
                </li>
                <li>
                  <a href="/tim-kiem?q=tai nghe">Audio & Accessories</a>
                </li>
                <li>
                  <a href="/tim-kiem?q=sách">Books & Stationery</a>
                </li>
                <li>
                  <a href="/tim-kiem?q=gia dụng">Home Appliances</a>
                </li>
                <li>
                  <a href="/tim-kiem?q=mỹ phẩm">Beauty & Personal Care</a>
                </li>
              </ul>
            </div>

            {/* Column 2: CUSTOMER SERVICE */}
            <div className={styles.col}>
              <h3 className={styles.heading}>CUSTOMER SERVICE</h3>
              <p className={styles.hotline}>
                Hotline: <a href="tel:19006035">1900 6035</a>
                <span className={styles.small}>(1000đ/phút, 8h-21h kể cả T7, CN)</span>
              </p>
              <ul className={styles.links}>
                <li>
                  <a href="#footer">Frequently Asked Questions</a>
                </li>
                <li>
                  <a href="#footer">Submit Support Ticket</a>
                </li>
                <li>
                  <a href="#footer">Ordering Guide</a>
                </li>
                <li>
                  <a href="#footer">Tropical Shipping Methods</a>
                </li>
                <li>
                  <a href="#footer">Return & Refund Policy</a>
                </li>
              </ul>
            </div>

            {/* Column 3: stylized wave-pattern newsletter signup form */}
            <div className={`${styles.col} ${styles.newsletterCol}`}>
              <h3 className={styles.heading}>NEWSLETTER</h3>
              <p className={styles.newsDesc}>
                Đăng ký ngay để nhận các thông tin ưu đãi nhiệt đới hấp dẫn nhất từ Tiki.
              </p>
              <form className={styles.subscribeForm} onSubmit={(e) => { e.preventDefault(); alert("Cảm ơn bạn đã đăng ký!"); }}>
                <div className={styles.inputContainer}>
                  <input
                    type="email"
                    placeholder="Nhập email của bạn..."
                    className={styles.newsInput}
                    required
                  />
                  <button type="submit" className={styles.newsBtn}>
                    Đăng ký
                  </button>
                </div>
              </form>
              <div className={styles.waveContainer}>
                <svg className={styles.waveLayer1} viewBox="0 0 120 28" preserveAspectRatio="none">
                  <use xlinkHref="#wave-path-root" x="0" y="0" fill="rgba(26, 148, 255, 0.12)" />
                </svg>
                <svg className={styles.waveLayer2} viewBox="0 0 120 28" preserveAspectRatio="none">
                  <use xlinkHref="#wave-path-root" x="-30" y="2" fill="rgba(26, 148, 255, 0.22)" />
                </svg>
                <svg className={styles.waveLayer3} viewBox="0 0 120 28" preserveAspectRatio="none">
                  <use xlinkHref="#wave-path-root" x="-70" y="4" fill="rgba(26, 148, 255, 0.45)" />
                </svg>
                <svg style={{ display: "none" }}>
                  <defs>
                    <path
                      id="wave-path-root"
                      d="M 0,10 C 30,10 30,15 60,15 90,15 90,10 120,10 150,10 150,15 180,15 210,15 210,10 240,10 v 28 h -240 z"
                    />
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <div className="container">
          <p className={styles.company}>
            Tiki Clone — Hòn Đảo Nhiệt Đới Công Nghệ. Giao diện được thiết kế hiện đại, sống động và
            đầy màu sắc lấy cảm hứng từ phong cách Tiki.
          </p>
          <p className={styles.copy}>
            © {new Date().getFullYear()} — Bản thiết kế Premium. API Docs:{" "}
            <a href="/api-docs" target="_blank" rel="noreferrer">
              /api-docs
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

