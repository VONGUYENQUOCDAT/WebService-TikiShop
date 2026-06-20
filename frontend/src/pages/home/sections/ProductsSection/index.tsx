import { useState, useEffect } from "react";
import type { Product } from "@/shared/api/types";
import { Reveal, SectionTitle, StaggerContainer, StaggerItem } from "@/shared/ui";
import ProductCard from "@/widgets/ProductCard";
import ProductCardSkeleton from "@/widgets/ProductCardSkeleton";
import styles from "./ProductsSection.module.css";

function FlameSmoke() {
  return (
    <div className={styles.smokeContainer}>
      <div className={styles.smokeParticle} style={{ "--delay": "0s", "--left": "25%" } as React.CSSProperties} />
      <div className={styles.smokeParticle} style={{ "--delay": "0.4s", "--left": "50%" } as React.CSSProperties} />
      <div className={styles.smokeParticle} style={{ "--delay": "0.8s", "--left": "75%" } as React.CSSProperties} />
    </div>
  );
}

function FlipDigit({ val }: { val: string }) {
  const [displayVal, setDisplayVal] = useState(val);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    if (val !== displayVal) {
      setFlip(true);
      const timeout = setTimeout(() => {
        setDisplayVal(val);
        setFlip(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [val, displayVal]);

  return (
    <span className={`${styles.flipDigit} ${flip ? styles.flip : ""}`}>
      {displayVal}
    </span>
  );
}

function LiveAuctionCard() {
  const [time, setTime] = useState({ hours: 1, minutes: 42, seconds: 15 });

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
              hours = 2;
              minutes = 30;
              seconds = 0;
            }
          }
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNum = (num: number) => String(num).padStart(2, "0");

  const hStr = formatNum(time.hours);
  const mStr = formatNum(time.minutes);
  const sStr = formatNum(time.seconds);

  return (
    <div className={styles.auctionCard}>
      <div className={styles.auctionThumb}>
        <div className={styles.liveBadge}>
          <span className={styles.flameIcon}>🔥</span>
          <FlameSmoke />
          <span>LIVE NOW</span>
        </div>
        <img src="/tiki_hero_banner.png" alt="Live Auction" className={styles.auctionImg} />
        <div className={styles.timerOverlay}>
          <span className={styles.timerLabel}>KẾT THÚC SAU</span>
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
      <div className={styles.auctionBody}>
        <span className={styles.auctionTag}>Phiên Đấu Giá Đặc Biệt</span>
        <h4 className={styles.auctionTitle}>Tai Nghe Premium Aura Wave - Tropical Edition</h4>
        <div className={styles.bidInfo}>
          <div className={styles.bidCol}>
            <span className={styles.bidLabel}>Giá hiện tại</span>
            <span className={styles.bidValue}>1.450.000 ₫</span>
          </div>
          <div className={styles.bidCol}>
            <span className={styles.bidLabel}>Người ra giá</span>
            <span className={styles.bidUser}>Minh ***</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.bidBtn}
          onClick={() => alert("Chức năng đấu giá sẽ khả dụng trong phiên trực tiếp tiếp theo!")}
        >
          ĐẤU GIÁ NGAY
        </button>
      </div>
    </div>
  );
}

interface ProductsSectionProps {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  page: number;
  totalPages: number;
  onLoadMore: () => void;
}

export default function ProductsSection({
  products,
  loading,
  loadingMore,
  page,
  totalPages,
  onLoadMore,
}: ProductsSectionProps) {
  return (
    <section className={`container ${styles.section}`}>
      <Reveal>
        <SectionTitle
          title="Gợi ý hôm nay"
          subtitle="Dành riêng cho bạn"
        />
        <StaggerContainer className={styles.grid}>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={`sk-${i}`}>
                <ProductCardSkeleton />
              </div>
            ))
          ) : (
            <>
              <StaggerItem key="live-auction">
                <LiveAuctionCard />
              </StaggerItem>
              {products.map((p) => (
                <StaggerItem key={p.id}>
                  <ProductCard product={p} />
                </StaggerItem>
              ))}
            </>
          )}
        </StaggerContainer>

        {!loading && (
          <div className={styles.actionContainer}>
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={onLoadMore}
              disabled={loadingMore || page >= totalPages}
            >
              {page >= totalPages ? "Đã tải hết" : loadingMore ? "Đang tải..." : "Xem thêm gợi ý hôm nay"}
            </button>
          </div>
        )}
      </Reveal>
    </section>
  );
}

