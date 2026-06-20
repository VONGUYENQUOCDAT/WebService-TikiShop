import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { Product } from "@/shared/api/types";
import { FadeIn, useToast } from "@/shared/ui";
import ImageWithFallback from "@/shared/ui/ImageWithFallback";
import { formatPrice } from "@/shared/lib/format";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import ProductCard from "@/widgets/ProductCard";
import ProductCardSkeleton from "@/widgets/ProductCardSkeleton";
import styles from "./ProductPage.module.css";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Product reviews states
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsDistribution, setReviewsDistribution] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setQty(1);
    api
      .productBySlug(slug)
      .then((p) => {
        setProduct(p);
        // Load related products from same category
        if (p.category?.slug) {
          setRelatedLoading(true);
          api
            .category(p.category.slug, { page: 1, limit: 8 })
            .then((c) => {
              setRelatedProducts(c.products.filter((rp) => rp.id !== p.id).slice(0, 6));
            })
            .catch(() => setRelatedProducts([]))
            .finally(() => setRelatedLoading(false));
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    setReviewsLoading(true);
    api
      .getProductReviews(product.id, { page: reviewsPage, pageSize: 5 })
      .then((res) => {
        setReviews(res.reviews);
        setReviewsTotal(res.total);
        setReviewsDistribution(res.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      })
      .catch(() => {
        setReviews([]);
        setReviewsTotal(0);
      })
      .finally(() => setReviewsLoading(false));
  }, [product, reviewsPage]);

  const addToCart = async () => {
    if (!product) return;
    if (!token) {
      navigate("/dang-nhap", { state: { from: `/p/${product.slug}` } });
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      toast({ type: "error", message: "Số lượng phải là số nguyên từ 1 đến 99." });
      return;
    }
    setAddingToCart(true);
    try {
      await api.addCart(product.id, qty);
      const c = await api.cart();
      useCartStore.getState().setCount(c.items.reduce((s, i) => s + i.quantity, 0));
      toast({ type: "success", message: `Đã thêm ${qty} sản phẩm vào giỏ hàng!` });
    } catch (e) {
      toast({ type: "error", message: (e as Error).message });
    } finally {
      setAddingToCart(false);
    }
  };

  const buyNow = async () => {
    if (!product) return;
    if (!token) {
      navigate("/dang-nhap", { state: { from: `/p/${product.slug}` } });
      return;
    }
    setAddingToCart(true);
    try {
      await api.addCart(product.id, qty);
      const c = await api.cart();
      useCartStore.getState().setCount(c.items.reduce((s, i) => s + i.quantity, 0));
      navigate("/gio-hang");
    } catch (e) {
      toast({ type: "error", message: (e as Error).message });
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className={`container ${styles.shell}`}>
        <div className={styles.loadingLayout}>
          <div className="skeleton" style={{ aspectRatio: "1", borderRadius: 12 }} />
          <div>
            <div className="skeleton" style={{ height: 24, width: "80%", marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 16, width: "60%", marginBottom: 20 }} />
            <div className="skeleton" style={{ height: 40, width: "50%", marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 44, width: "70%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`container ${styles.shell}`}>
        <div className="empty-state">
          <h2>Không tìm thấy sản phẩm</h2>
          <p>Sản phẩm bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const discount =
    product.listPrice && product.listPrice > product.price
      ? Math.round((1 - product.price / product.listPrice) * 100)
      : null;

  return (
    <div className={styles.page}>
      <div className="container">
        <FadeIn>
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden>›</span>
            {product.category && (
              <>
                <Link to={`/danh-muc/${product.category.slug}`}>{product.category.name}</Link>
                <span aria-hidden>›</span>
              </>
            )}
            <span>{product.name}</span>
          </nav>
        </FadeIn>

        <div className={styles.layout}>
          <motion.div
            className={styles.gallery}
            initial={reduce ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {product.badge && <span className={styles.badge}>{product.badge}</span>}
            <ImageWithFallback src={product.image} alt={product.name} width={480} height={480} />
          </motion.div>

          <FadeIn delay={0.06} className={styles.info}>
            {product.brand && <p className={styles.brand}>Thương hiệu: <Link to={`/tim-kiem?q=${encodeURIComponent(product.brand)}`} className={styles.brandLink}>{product.brand}</Link></p>}
            <h1 className={styles.title}>{product.name}</h1>
            <div className={styles.meta}>
              <span className={styles.metaStars} aria-hidden>{"★".repeat(Math.round(product.rating))}</span>
              <span>{product.rating}</span>
              <span className={styles.metaDot}>·</span>
              <span>{product.reviewCount} đánh giá</span>
              <span className={styles.metaDot}>·</span>
              <span>Đã bán {product.sold >= 1000 ? `${(product.sold / 1000).toFixed(1)}k` : product.sold}</span>
            </div>

            <div className={styles.priceBlock}>
              <span className={styles.price}>{formatPrice(product.price)}</span>
              {product.listPrice && product.listPrice > product.price && (
                <>
                  <span className={styles.old}>{formatPrice(product.listPrice)}</span>
                  {discount != null && discount > 0 && (
                    <span className={styles.discount}>-{discount}%</span>
                  )}
                </>
              )}
            </div>

            <div className={styles.deliveryInfo}>
              <div className={styles.deliveryItem}>
                <span className={styles.deliveryIcon}>🚚</span>
                <div>
                  <strong>Giao nhanh 2h</strong>
                  <span>Trước 10h ngày mai</span>
                </div>
              </div>
              <div className={styles.deliveryItem}>
                <span className={styles.deliveryIcon}>✓</span>
                <div>
                  <strong>Freeship</strong>
                  <span>Đơn từ 45.000₫</span>
                </div>
              </div>
            </div>

            <div className={styles.qty}>
              <span>Số lượng</span>
              <div className={styles.qtyControls}>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={qty}
                  onChange={(e) => setQty(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                  aria-label="Số lượng sản phẩm"
                />
                <button type="button" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99}>
                  +
                </button>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className="btn btn-primary btn-lg" onClick={addToCart} disabled={addingToCart}>
                {addingToCart ? (
                  <><span className="spinner" style={{ width: 18, height: 18 }} /> Đang thêm…</>
                ) : (
                  "Thêm vào giỏ hàng"
                )}
              </button>
              <button type="button" className={`btn btn-lg ${styles.buyNowBtn}`} onClick={buyNow} disabled={addingToCart}>
                Mua ngay
              </button>
            </div>
          </FadeIn>
        </div>

        {/* Description */}
        <FadeIn delay={0.1}>
          <section className={styles.descSection} aria-labelledby="product-desc-heading">
            <h2 id="product-desc-heading">Mô tả sản phẩm</h2>
            <div className={styles.descBody}>
              <p>{product.description}</p>
            </div>
          </section>
        </FadeIn>

        {/* Customer reviews section */}
        <FadeIn delay={0.12}>
          <section className={styles.reviewsSection} aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className={styles.sectionTitle}>Khách hàng đánh giá</h2>
            
            <div className={styles.reviewsOverview}>
              <div className={styles.ratingSummary}>
                <div className={styles.averageRating}>{product.rating}</div>
                <div className={styles.stars} aria-hidden>
                  {"★".repeat(Math.round(product.rating))}
                  {"☆".repeat(5 - Math.round(product.rating))}
                </div>
                <div className={styles.totalReviewsCount}>{product.reviewCount} đánh giá</div>
              </div>

              <div className={styles.ratingDistribution}>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = reviewsDistribution[stars] || 0;
                  const percent = reviewsTotal > 0 ? Math.round((count / reviewsTotal) * 100) : 0;
                  return (
                    <div key={stars} className={styles.distributionRow}>
                      <span className={styles.distStars}>{stars} ★</span>
                      <div className={styles.distBarWrap}>
                        <div className={styles.distBarFill} style={{ width: `${percent}%` }} />
                      </div>
                      <span className={styles.distPercent}>{percent}%</span>
                      <span className={styles.distCount}>({count})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {reviewsLoading && (
              <div className={styles.reviewsLoading}>Đang tải đánh giá...</div>
            )}

            {!reviewsLoading && reviews.length === 0 && (
              <div className={styles.emptyReviews}>
                <p>Chưa có đánh giá nào cho sản phẩm này.</p>
                <p className={styles.emptySubtitle}>Hãy mua hàng và trở thành người đầu tiên viết nhận xét nhé!</p>
              </div>
            )}

            {!reviewsLoading && reviews.length > 0 && (
              <div className={styles.reviewsList}>
                {reviews.map((rev) => {
                  let parsedImages: string[] = [];
                  try {
                    parsedImages = typeof rev.imageUrls === "string" ? JSON.parse(rev.imageUrls) : (rev.imageUrls ?? []);
                  } catch {
                    parsedImages = [];
                  }
                  return (
                    <div key={rev.id} className={styles.reviewItem}>
                      <div className={styles.reviewUserHead}>
                        <span className={styles.reviewAvatar}>
                          {rev.user?.name ? rev.user.name.charAt(0).toUpperCase() : "U"}
                        </span>
                        <div>
                          <div className={styles.reviewUserName}>{rev.user?.name || "Khách hàng Tiki"}</div>
                          <div className={styles.reviewMeta}>
                            <span className={styles.reviewStars}>
                              {"★".repeat(rev.rating)}
                              {"☆".repeat(5 - rev.rating)}
                            </span>
                            <span className={styles.reviewDate}>
                              {new Date(rev.createdAt).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {rev.comment && <p className={styles.reviewComment}>{rev.comment}</p>}

                      {parsedImages.length > 0 && (
                        <div className={styles.reviewImages}>
                          {parsedImages.map((imgUrl, i) => (
                            <img key={i} src={imgUrl} alt={`Ảnh đánh giá ${i + 1}`} className={styles.reviewImg} />
                          ))}
                        </div>
                      )}

                      {rev.adminReply && (
                        <div className={styles.adminReplyBlock}>
                          <div className={styles.adminReplyTitle}>
                            💬 <strong>Tiki Phản hồi:</strong>
                          </div>
                          <p className={styles.adminReplyText}>{rev.adminReply}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pagination */}
                {reviewsTotal > 5 && (
                  <div className={styles.reviewsPagination}>
                    <button
                      type="button"
                      disabled={reviewsPage <= 1}
                      onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                      className="btn btn-outline btn-sm"
                    >
                      ← Trước
                    </button>
                    <span className={styles.paginationText}>
                      Trang {reviewsPage} / {Math.ceil(reviewsTotal / 5)}
                    </span>
                    <button
                      type="button"
                      disabled={reviewsPage >= Math.ceil(reviewsTotal / 5)}
                      onClick={() => setReviewsPage((p) => Math.min(Math.ceil(reviewsTotal / 5), p + 1))}
                      className="btn btn-outline btn-sm"
                    >
                      Sau →
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </FadeIn>

        {/* Related products */}
        {(relatedLoading || relatedProducts.length > 0) && (
          <FadeIn delay={0.15}>
            <section className={styles.relatedSection}>
              <h2 className={styles.relatedTitle}>Sản phẩm tương tự</h2>
              <div className={styles.relatedGrid}>
                {relatedLoading
                  ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
                  : relatedProducts.map((rp) => <ProductCard key={rp.id} product={rp} />)}
              </div>
            </section>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
