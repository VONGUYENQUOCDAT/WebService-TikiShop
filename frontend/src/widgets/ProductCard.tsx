import { Link, useNavigate } from "react-router-dom";
import type { Product } from "@/shared/api/types";
import { highlightText } from "@/shared/lib/highlight";
import { formatPrice } from "@/shared/lib/format";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useToast } from "@/shared/ui";
import ImageWithFallback from "@/shared/ui/ImageWithFallback";
import styles from "./ProductCard.module.css";

export default function ProductCard({
  product,
  highlightQuery,
}: {
  product: Product;
  highlightQuery?: string;
}) {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const discount =
    product.listPrice && product.listPrice > product.price
      ? Math.round((1 - product.price / product.listPrice) * 100)
      : null;

  const soldLabel =
    product.sold >= 1000
      ? `${(product.sold / 1000).toFixed(1).replace(".", ",")}k`
      : String(product.sold);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      navigate("/dang-nhap", { state: { from: `/p/${product.slug}` } });
      return;
    }
    try {
      await api.addCart(product.id, 1);
      const c = await api.cart();
      useCartStore.getState().setCount(c.items.reduce((s, i) => s + i.quantity, 0));
      toast({ type: "success", message: `Đã thêm "${product.name}" vào giỏ hàng.` });
    } catch (err) {
      toast({ type: "error", message: (err as Error).message });
    }
  };

  return (
    <article className={styles.card}>
      <Link to={`/p/${product.slug}`} className={styles.thumb}>
        {product.badge && (
          <span
            className={
              product.badge.toLowerCase().includes("tikinow") ? styles.badgeBlue : styles.badge
            }
          >
            {product.badge}
          </span>
        )}
        {discount != null && discount > 0 && (
          <span className={styles.discountPill}>-{discount}%</span>
        )}
        {product.stock_quantity === 0 && (
          <span className={styles.outOfStockBadge} style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "#ef4444",
            color: "#fff",
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: 4,
            zIndex: 2
          }}>
            Out of stock
          </span>
        )}
        <div className={styles.imgWrap} style={{ opacity: product.stock_quantity === 0 ? 0.5 : 1 }}>
          <ImageWithFallback src={product.image} alt={product.name} width={280} height={280} />
        </div>
        {product.stock_quantity > 0 && (
          <div className={styles.cartOverlay}>
            <button
              type="button"
              className={styles.overlayAddBtn}
              onClick={handleAddToCart}
              aria-label={`Thêm ${product.name} vào giỏ hàng`}
            >
              Thêm vào giỏ
            </button>
          </div>
        )}
      </Link>
      <div className={styles.body}>
        <p className={styles.official}>
          <span className={styles.officialIcon} aria-hidden>✓</span>
          Chính hãng
        </p>
        <Link to={`/p/${product.slug}`} className={styles.title}>
          {highlightQuery ? highlightText(product.name, highlightQuery) : product.name}
        </Link>
        <div className={styles.rating}>
          <span className={styles.stars} aria-hidden>
            {"★".repeat(Math.round(product.rating))}{"☆".repeat(5 - Math.round(product.rating))}
          </span>
          <span className={styles.ratingNum}>{product.rating}</span>
          <span className={styles.dot} />
          <span className={styles.sold}>Đã bán {soldLabel}</span>
        </div>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(product.price)}</span>
          {product.listPrice && product.listPrice > product.price && (
            <span className={styles.priceOld}>{formatPrice(product.listPrice)}</span>
          )}
        </div>
        <div className={styles.footer}>
          <p className={styles.freeship} title="Chương trình giao hàng miễn phí (demo)">
            <span className={styles.freeshipIcon} aria-hidden>✓</span>
            Freeship+
          </p>
          {product.stock_quantity > 0 ? (
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddToCart}
              aria-label={`Thêm ${product.name} vào giỏ hàng`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ) : (
            <span className={styles.outOfStockText} style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 700 }}>
              Hết hàng
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
