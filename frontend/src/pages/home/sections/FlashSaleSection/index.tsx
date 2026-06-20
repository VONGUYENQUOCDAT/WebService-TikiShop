import { useState, useEffect } from "react";
import type { Product } from "@/shared/api/types";
import { formatPrice } from "@/shared/lib/format";
import { Link } from "react-router-dom";
import styles from "./FlashSaleSection.module.css";

// 3D Flip Digit Component for premium ticking effect
function FlipDigit({ val }: { val: string }) {
  const [displayVal, setDisplayVal] = useState(val);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    if (val !== displayVal) {
      setFlip(true);
      const timeout = setTimeout(() => {
        setDisplayVal(val);
        setFlip(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [val, displayVal]);

  return (
    <span className={`${styles.flipDigit} ${flip ? styles.flip : ""}`}>
      {displayVal}
    </span>
  );
}

interface FlashSaleSectionProps {
  products: Product[];
  loading: boolean;
}

export default function FlashSaleSection({ products, loading }: FlashSaleSectionProps) {
  const [time, setTime] = useState({ hours: 2, minutes: 14, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prev) => {
        let { hours, minutes, seconds } = prev;
        if (seconds > 0) {
          seconds--;
        } else {
          seconds = 59;
          if (minutes > 0) {
            minutes--;
          } else {
            minutes = 59;
            if (hours > 0) {
              hours--;
            } else {
              // Reset countdown once finished
              hours = 3;
              minutes = 0;
              seconds = 0;
            }
          }
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter products that have discounts (listPrice > price)
  const flashSaleItems = products
    .filter((p) => p.listPrice && p.listPrice > p.price)
    .slice(0, 5);

  const formatNum = (num: number) => String(num).padStart(2, "0");
  const hStr = formatNum(time.hours);
  const mStr = formatNum(time.minutes);
  const sStr = formatNum(time.seconds);

  if (!loading && flashSaleItems.length === 0) {
    return null; // Don't show if no discount products are loaded
  }

  return (
    <section className={styles.wrapper}>
      <div className={`${styles.container} container`}>
        {/* Flash Sale Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.flashIcon}>⚡</span>
            <h2 className={styles.title}>GIỜ VÀNG GIÁ SỐC</h2>
            
            <div className={styles.timerContainer}>
              <span className={styles.timerText}>Kết thúc sau:</span>
              <div className={styles.timer}>
                <div className={styles.timeGroup}>
                  <FlipDigit val={hStr[0]} />
                  <FlipDigit val={hStr[1]} />
                </div>
                <span className={styles.colon}>:</span>
                <div className={styles.timeGroup}>
                  <FlipDigit val={mStr[0]} />
                  <FlipDigit val={mStr[1]} />
                </div>
                <span className={styles.colon}>:</span>
                <div className={styles.timeGroup}>
                  <FlipDigit val={sStr[0]} />
                  <FlipDigit val={sStr[1]} />
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.headerRight}>
            <span className={styles.subtext}>Đồng giá từ 99k • Fresship Xtra</span>
          </div>
        </div>

        {/* Products Grid */}
        <div className={styles.grid}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={`fs-sk-${i}`} className={styles.cardSkeleton}>
                  <div className={`${styles.cardSkeletonThumb} skeleton`} />
                  <div className={`${styles.cardSkeletonLine} skeleton`} style={{ width: "80%" }} />
                  <div className={`${styles.cardSkeletonLine} skeleton`} style={{ width: "50%" }} />
                </div>
              ))
            : flashSaleItems.map((p) => {
                const discountPercent = p.listPrice
                  ? Math.round((1 - p.price / p.listPrice) * 100)
                  : 15;
                // Generate a simulated sold quantity and progress bar width
                const soldQty = (p.sold % 30) + 5;
                const progressWidth = Math.min(100, Math.max(20, (soldQty / 35) * 100));
                
                return (
                  <Link to={`/p/${p.slug}`} key={p.id} className={styles.card}>
                    <div className={styles.cardThumb}>
                      <span className={styles.discountBadge}>-{discountPercent}%</span>
                      <img src={p.image} alt={p.name} className={styles.cardImg} />
                    </div>
                    <div className={styles.cardBody}>
                      <h4 className={styles.cardTitle}>{p.name}</h4>
                      
                      <div className={styles.priceRow}>
                        <span className={styles.price}>{formatPrice(p.price)}</span>
                        {p.listPrice && (
                          <span className={styles.oldPrice}>{formatPrice(p.listPrice)}</span>
                        )}
                      </div>

                      {/* Flash sale progress bar */}
                      <div className={styles.progressContainer}>
                        <div 
                          className={styles.progressBar} 
                          style={{ width: `${progressWidth}%` }}
                        />
                        <span className={styles.progressText}>
                          {progressWidth > 80 ? "🔥 SẮP CHÁY HÀNG" : `Đã bán ${soldQty}`}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>

        {/* View More Centered Button */}
        <div className={styles.actionContainer}>
          <Link to="/tim-kiem?sort=bestseller" className={styles.viewMoreBtn}>
            Xem tất cả Flash Sale
          </Link>
        </div>
      </div>
    </section>
  );
}
