import { useState } from "react";
import { Link } from "react-router-dom";
import type { Category } from "@/shared/api/types";
import { Reveal, StaggerContainer, StaggerItem } from "@/shared/ui";
import styles from "./CategoriesSection.module.css";

interface CategoriesSectionProps {
  categories: Category[];
  loading?: boolean;
}

// Hàm chuyển đổi icon khi người dùng di chuột qua (Morphing Icons)
function getHoverIcon(slug: string, defaultIcon: string): string {
  switch (slug) {
    case "dien-thoai-may-tinh-bang":
      return "💻"; // Phone -> Laptop/Tablet
    case "dien-tu-dien-may":
      return "📱"; // TV -> Smartphone (Tech -> Mobile)
    case "thoi-trang-nam":
      return "🕶️"; // Tie -> Sunglasses
    case "thoi-trang-nu":
      return "👜"; // Dress -> Handbag
    case "nha-cua-doi-song":
      return "🛋️"; // House -> Sofa
    case "sach-vpp":
      return "✏️"; // Books -> Pencil
    case "lam-dep-suc-khoe":
      return "💅"; // Lipstick -> Nail Polish
    case "the-thao-da-ngoai":
      return "🏆"; // Soccer -> Trophy
    default:
      return defaultIcon;
  }
}

function CategoryItem({ category }: { category: Category }) {
  const [hovered, setHovered] = useState(false);
  const displayIcon = hovered ? getHoverIcon(category.slug, category.icon || "📦") : (category.icon || "📦");

  return (
    <Link
      to={`/danh-muc/${category.slug}`}
      className={styles.catItem}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={`${styles.catCircle} ${hovered ? styles.catCircleMorph : ""}`}>
        {displayIcon || "📦"}
      </span>
      <span className={styles.catName}>{category.name}</span>
    </Link>
  );
}

export default function CategoriesSection({ categories, loading = false }: CategoriesSectionProps) {
  return (
    <Reveal>
      <section className={`container ${styles.section}`}>
        <div className={styles.catPanel}>
          <div className={styles.catHead}>
            <h2 className={styles.catTitle}>Danh mục nổi bật</h2>
            <span className={styles.catHint}>Khám phá ngay</span>
          </div>
          <StaggerContainer className={styles.catScroll}>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={`sk-${i}`} className={styles.catStagger}>
                    <div className={styles.catItem}>
                      <div
                        className={`${styles.catCircle} skeleton`}
                        style={{ background: undefined }}
                      />
                      <div
                        className="skeleton"
                        style={{ width: "70%", height: 12, margin: "0 auto", borderRadius: 4 }}
                      />
                    </div>
                  </div>
                ))
              : categories.map((c) => (
                  <StaggerItem key={c.id} className={styles.catStagger}>
                    <CategoryItem category={c} />
                  </StaggerItem>
                ))}
          </StaggerContainer>
        </div>
      </section>
    </Reveal>
  );
}

