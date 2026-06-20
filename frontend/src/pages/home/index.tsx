import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { Category, Product } from "@/shared/api/types";
import CategoriesSection from "./sections/CategoriesSection";
import HeroSection from "./sections/HeroSection";
import FlashSaleSection from "./sections/FlashSaleSection";
import TopDealsSection from "./sections/TopDealsSection";
import OfficialBrandsSection from "./sections/OfficialBrandsSection";
import ProductsSection from "./sections/ProductsSection";
import styles from "./Home.module.css";


export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadProducts = async (nextPage: number) => {
    try {
      setLoadingMore(true);
      const res = await api.products({ page: nextPage, limit: 12, sort: "bestseller" });
      const pagination = res.pagination as { totalPages: number };
      setProducts((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
      setPage(nextPage);
      setTotalPages(pagination?.totalPages ?? 1);
    } catch (e: unknown) {
      if (e instanceof Error) setErr(e.message);
      else setErr("Đã có lỗi xảy ra khi tải sản phẩm");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    async function loadHomeData() {
      setLoading(true);
      try {
        const [c, p] = await Promise.all([
          api.categories(),
          api.products({ page: 1, limit: 12, sort: "bestseller" }),
        ]);
        setCategories(c);
        setProducts(p.items);
        const pagination = p.pagination as { totalPages: number };
        setPage(1);
        setTotalPages(pagination?.totalPages ?? 1);
      } catch (e: unknown) {
        if (e instanceof Error) setErr(e.message);
        else setErr("Đã có lỗi xảy ra khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  if (err) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.errorBox}>
          <h2>Không tải được trang chủ</h2>
          <p>{err}</p>
          <p className={styles.errorHint}>
            Kiểm tra backend đang chạy tại cổng 4000 và thử tải lại trang.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.homeLayout}`}>
      {/* Left sidebar - Vertical Categories */}
      <aside className={styles.sidebar}>
        <h3 className={styles.sidebarHeading}>Danh mục sản phẩm</h3>
        <ul className={styles.sidebarList}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <li
                  key={`side-sk-${i}`}
                  className={`${styles.sidebarItemSk} skeleton`}
                />
              ))
            : categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/danh-muc/${c.slug}`} className={styles.sidebarLink}>
                    <span className={styles.sidebarIcon}>{c.icon || "📦"}</span>
                    <span className={styles.sidebarName}>{c.name}</span>
                  </Link>
                </li>
              ))}
        </ul>

        {/* Right utility helper inside sidebar */}
        <div className={styles.sidebarPromo}>
          <div className={styles.promoTitle}>Tiki Assistant 🤖</div>
          <p>Trợ lý AI thông minh sẵn sàng gợi ý và so sánh giá tốt nhất cho bạn!</p>
        </div>
      </aside>

      {/* Main Area */}
      <div className={styles.mainContent}>
        <HeroSection />
        <CategoriesSection categories={categories} loading={loading} />
        
        {/* Section 1: Flash Sale (Giờ Vàng Giá Sốc) */}
        <FlashSaleSection products={products} loading={loading} />

        {/* Section 2: Top Deal (Siêu Rẻ) */}
        <TopDealsSection products={products} loading={loading} />

        {/* Section 3: Thương Hiệu Nổi Bật (Official Stores) */}
        <OfficialBrandsSection products={products} loading={loading} />

        {/* Section 4: Gợi ý hôm nay */}
        <ProductsSection
          products={products}
          loading={loading}
          loadingMore={loadingMore}
          page={page}
          totalPages={totalPages}
          onLoadMore={() => loadProducts(page + 1)}
        />
      </div>
    </div>
  );
}
