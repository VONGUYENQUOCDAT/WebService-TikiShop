import type { Product } from "@/shared/api/types";
import ProductCard from "@/widgets/ProductCard";
import styles from "./TopDealsSection.module.css";

interface TopDealsSectionProps {
  products: Product[];
  loading: boolean;
}

export default function TopDealsSection({ products, loading }: TopDealsSectionProps) {
  // Select products that have a high discount percentage or price below 2,000,000 VND
  const dealItems = products
    .filter((p) => p.price < 5000000 || (p.listPrice && p.listPrice > p.price))
    .slice(2, 7); // select a distinct subset from Flash Sale to avoid total duplication

  if (!loading && dealItems.length === 0) {
    return null;
  }

  return (
    <section className={styles.wrapper}>
      <div className={`${styles.container} container`}>
        {/* Header Block */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.dealBadge}>SIÊU RẺ</span>
            <h2 className={styles.title}>Top Deal - Siêu Rẻ Mỗi Ngày</h2>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.tagline}>Cam kết rẻ hơn • Hoàn tiền 111%</span>
          </div>
        </div>

        {/* Products Grid */}
        <div className={styles.grid}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={`deal-sk-${i}`} className={styles.cardSkeleton}>
                  <div className={`${styles.cardSkeletonThumb} skeleton`} />
                  <div className={`${styles.cardSkeletonLine} skeleton`} style={{ width: "80%" }} />
                  <div className={`${styles.cardSkeletonLine} skeleton`} style={{ width: "40%" }} />
                </div>
              ))
            : dealItems.map((p) => {
                // Ensure a nice badge for the Top Deal block if not present
                const updatedProduct = {
                  ...p,
                  badge: p.badge || "DEAL HOT",
                };
                
                return (
                  <div key={p.id} className={styles.cardWrapper}>
                    <ProductCard product={updatedProduct} />
                    {/* Floating tropical style extra discount tag on card corners */}
                    <span className={styles.dealSticker}>FREESHIP XTRA</span>
                  </div>
                );
              })}
        </div>

        {/* Center-aligned View More Pill Button */}
        <div className={styles.actionContainer}>
          <a href="/tim-kiem?sort=price_asc" className={styles.viewMoreBtn}>
            Xem thêm Deal Siêu Rẻ
          </a>
        </div>
      </div>
    </section>
  );
}
