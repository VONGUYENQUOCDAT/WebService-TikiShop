import type { Product } from "@/shared/api/types";
import { Link } from "react-router-dom";
import { formatPrice } from "@/shared/lib/format";
import styles from "./OfficialBrandsSection.module.css";

interface OfficialBrandsSectionProps {
  products: Product[];
  loading: boolean;
}

interface BrandStore {
  id: string;
  name: string;
  logo: string;
  coverGradient: string;
  slogan: string;
  products: Product[];
}

export default function OfficialBrandsSection({ products, loading }: OfficialBrandsSectionProps) {
  // Group products by brand
  const appleProducts = products.filter((p) => p.brand?.toLowerCase() === "apple").slice(0, 2);
  const samsungProducts = products.filter((p) => p.brand?.toLowerCase() === "samsung").slice(0, 2);
  const xiaomiProducts = products.filter((p) => p.brand?.toLowerCase() === "xiaomi").slice(0, 2);

  // If no products match, fallback to general items so layout doesn't look empty
  const fallbackProducts = products.slice(0, 2);

  const stores: BrandStore[] = [
    {
      id: "apple",
      name: "Apple Authorized Reseller",
      logo: "🍏",
      coverGradient: "linear-gradient(135deg, #1f1f2e 0%, #111116 100%)",
      slogan: "Trải nghiệm đẳng cấp iOS chính hãng",
      products: appleProducts.length > 0 ? appleProducts : fallbackProducts,
    },
    {
      id: "samsung",
      name: "Samsung Active Flagship Store",
      logo: "🌌",
      coverGradient: "linear-gradient(135deg, #0f2b46 0%, #1a365d 50%, #2b6cb0 100%)",
      slogan: "Công nghệ tương lai trong tầm tay",
      products: samsungProducts.length > 0 ? samsungProducts : fallbackProducts,
    },
    {
      id: "xiaomi",
      name: "Xiaomi Official Store",
      logo: "🍊",
      coverGradient: "linear-gradient(135deg, #ff4e00 0%, #ec9f05 100%)",
      slogan: "Sáng tạo công nghệ cho mọi nhà",
      products: xiaomiProducts.length > 0 ? xiaomiProducts : fallbackProducts,
    },
  ];

  return (
    <section className={styles.wrapper}>
      <div className={`${styles.container} container`}>
        {/* Header Block */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.officialBadge}>CHÍNH HÃNG</span>
            <h2 className={styles.title}>Thương Hiệu Nổi Bật</h2>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.tagline}>100% Chính Hãng • Giao Nhanh 2H</span>
          </div>
        </div>

        {/* Brands Grid Layout */}
        <div className={styles.grid}>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={`brand-sk-${i}`} className={styles.brandCardSk}>
                  <div className={`${styles.coverSk} skeleton`} />
                  <div className={`${styles.logoSk} skeleton`} />
                  <div className={styles.prodRowSk}>
                    <div className="skeleton" style={{ width: "80px", height: "80px", borderRadius: "8px" }} />
                    <div className="skeleton" style={{ width: "80px", height: "80px", borderRadius: "8px" }} />
                  </div>
                </div>
              ))
            : stores.map((store) => (
                <div key={store.id} className={styles.brandCard}>
                  {/* Brand Cover Header */}
                  <div className={styles.cover} style={{ background: store.coverGradient }}>
                    <div className={styles.coverOverlay}>
                      <span className={styles.brandSlogan}>{store.slogan}</span>
                    </div>
                  </div>

                  {/* Brand Logo & Name */}
                  <div className={styles.brandMeta}>
                    <div className={styles.logoCircle}>
                      <span className={styles.logoIcon}>{store.logo}</span>
                    </div>
                    <div className={styles.nameContainer}>
                      <h4 className={styles.brandName}>{store.name}</h4>
                      <span className={styles.verifiedTag}>✓ Mall</span>
                    </div>
                  </div>

                  {/* Brand Featured Products (2-3 items) */}
                  <div className={styles.prodRow}>
                    {store.products.map((p) => {
                      const discount = p.listPrice && p.listPrice > p.price
                        ? Math.round((1 - p.price / p.listPrice) * 100)
                        : null;

                      return (
                        <Link to={`/p/${p.slug}`} key={p.id} className={styles.prodItem}>
                          <div className={styles.prodThumb}>
                            <img src={p.image} alt={p.name} className={styles.prodImg} />
                            {discount && <span className={styles.prodDiscount}>-{discount}%</span>}
                          </div>
                          <div className={styles.prodInfo}>
                            <p className={styles.prodTitle}>{p.name}</p>
                            <span className={styles.prodPrice}>{formatPrice(p.price)}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
        </div>

        {/* Center-aligned View More Pill Button */}
        <div className={styles.actionContainer}>
          <Link to="/tim-kiem?sort=bestseller" className={styles.viewMoreBtn}>
            Khám phá thêm Thương Hiệu
          </Link>
        </div>
      </div>
    </section>
  );
}
