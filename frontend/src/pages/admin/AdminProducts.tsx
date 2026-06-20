import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { AdminCategoryRow, Product } from "@/shared/api/types";
import { formatPrice } from "@/shared/lib/format";
import { normalizeProductSlug } from "@/shared/lib/slug";
import styles from "./AdminPages.module.css";

type Draft = {
  name: string;
  slug: string;
  description: string;
  price: string;
  listPrice: string;
  image: string;
  rating: string;
  reviewCount: string;
  sold: string;
  stock_quantity: string;
  badge: string;
  brand: string;
  tags: string;
  categoryId: string;
};

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=280&h=280&fit=crop";

const DEFAULT_DESCRIPTION = "Đang cập nhật mô tả.";

function toDraft(p: Product): Draft {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: String(p.price),
    listPrice: p.listPrice != null ? String(p.listPrice) : "",
    image: p.image,
    rating: String(p.rating),
    reviewCount: String(p.reviewCount),
    sold: String(p.sold),
    stock_quantity: String(p.stock_quantity),
    badge: p.badge ?? "",
    brand: p.brand ?? "",
    tags: p.tags ?? "",
    categoryId: p.categoryId,
  };
}

function emptyDraft(categoryId: string): Draft {
  return {
    name: "",
    slug: "",
    description: DEFAULT_DESCRIPTION,
    price: "0",
    listPrice: "",
    image: DEFAULT_IMAGE,
    rating: "4.5",
    reviewCount: "0",
    sold: "0",
    stock_quantity: "0",
    badge: "",
    brand: "",
    tags: "",
    categoryId,
  };
}

function buildBody(draft: Draft): Record<string, unknown> {
  const slug = normalizeProductSlug(draft.slug);
  const desc = draft.description.trim() || DEFAULT_DESCRIPTION;
  const price = Math.round(Number(draft.price));
  const listRaw = draft.listPrice.trim();
  const listPrice = listRaw === "" ? null : Math.round(Number(listRaw));
  const rating = Number(draft.rating);
  const reviewCount = Math.round(Number(draft.reviewCount));
  const sold = Math.round(Number(draft.sold));
  const stock_quantity = Math.round(Number(draft.stock_quantity));
  return {
    name: draft.name.trim(),
    slug,
    description: desc,
    price,
    listPrice,
    image: draft.image.trim(),
    rating,
    reviewCount,
    sold,
    stock_quantity,
    badge: draft.badge.trim() || null,
    brand: draft.brand.trim() || null,
    tags: draft.tags.trim() || null,
    categoryId: draft.categoryId,
  };
}

export default function AdminProducts() {
  const [categories, setCategories] = useState<AdminCategoryRow[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const pageRef = useRef(page);
  pageRef.current = page;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<Product | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.adminCategories().then((r) => setCategories(r.items));
  }, []);

  const loadProducts = useCallback(
    async (targetPage: number) => {
      setListLoading(true);
      setErr(null);
      try {
        const r = await api.adminProducts({
          page: targetPage,
          limit: 12,
          q: q || undefined,
          categoryId: catFilter || undefined,
        });
        setItems(r.items);
        setTotalPages(Math.max(1, r.pagination.totalPages));
        setTotal(r.pagination.total);
        setPage(targetPage);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Lỗi tải danh sách");
      } finally {
        setListLoading(false);
      }
    },
    [q, catFilter]
  );

  useEffect(() => {
    void loadProducts(page);
  }, [page, q, catFilter, loadProducts]);

  const applySearch = () => {
    setQ(qInput.trim());
    setPage(1);
  };

  useEffect(() => {
    if (!successMsg) return;
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMsg(null), 4500);
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [successMsg]);

  const closeDrawer = useCallback(() => {
    setEdit(null);
    setCreateOpen(false);
    setDraft(null);
  }, []);

  const drawerOpen = (createOpen || !!edit) && !!draft;

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, saving, closeDrawer]);

  const openEdit = (p: Product) => {
    setCreateOpen(false);
    setEdit(p);
    setDraft(toDraft(p));
    setErr(null);
  };

  const openCreate = () => {
    if (categories.length === 0) {
      setErr("Chưa có danh mục — hãy tạo danh mục trước ở trang Danh mục.");
      return;
    }
    setEdit(null);
    setCreateOpen(true);
    setDraft(emptyDraft(categories[0].id));
    setErr(null);
  };

  const suggestSlugFromName = () => {
    if (!draft) return;
    const from = draft.name.trim() || draft.slug;
    setDraft({ ...draft, slug: normalizeProductSlug(from) });
  };

  const save = async () => {
    if (!draft) return;
    const price = Math.round(Number(draft.price));
    const listRaw = draft.listPrice.trim();
    const listPrice = listRaw === "" ? null : Math.round(Number(listRaw));
    if (!Number.isFinite(price) || price < 0) {
      setErr("Giá không hợp lệ");
      return;
    }
    if (listPrice !== null && (!Number.isFinite(listPrice) || listPrice < 0)) {
      setErr("Giá niêm yết không hợp lệ");
      return;
    }
    const rating = Number(draft.rating);
    const reviewCount = Math.round(Number(draft.reviewCount));
    const sold = Math.round(Number(draft.sold));
    const stock_quantity = Math.round(Number(draft.stock_quantity));
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      setErr("Đánh giá (sao) phải từ 0 đến 5");
      return;
    }
    if (!Number.isFinite(reviewCount) || reviewCount < 0 || !Number.isFinite(sold) || sold < 0 || !Number.isFinite(stock_quantity) || stock_quantity < 0) {
      setErr("Số lượng đánh giá / đã bán / tồn kho không hợp lệ");
      return;
    }
    if (!draft.name.trim()) {
      setErr("Vui lòng nhập tên sản phẩm.");
      return;
    }
    const slugNorm = normalizeProductSlug(draft.slug);
    if (!slugNorm) {
      setErr("Slug không hợp lệ. Nhập slug (chữ không dấu, số, gạch) hoặc bấm «Gợi ý từ tên».");
      return;
    }
    if (!draft.description.trim()) {
      setErr("Mô tả không được để trống.");
      return;
    }

    setSaving(true);
    setErr(null);
    const body = buildBody({ ...draft, slug: slugNorm });
    const currentPage = page;
    try {
      if (createOpen) {
        await api.adminCreateProduct(body);
        setSuccessMsg("Đã tạo sản phẩm và lưu vào cơ sở dữ liệu.");
        closeDrawer();
        await loadProducts(1);
      } else if (edit) {
        await api.adminPatchProduct(edit.id, body);
        setSuccessMsg("Đã lưu thay đổi.");
        closeDrawer();
        await loadProducts(currentPage);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Lỗi lưu");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Product) => {
    const ok = window.confirm(`Xóa sản phẩm "${p.name}"? Chỉ thực hiện được nếu sản phẩm chưa nằm trong đơn hàng nào.`);
    if (!ok) return;
    setErr(null);
    try {
      await api.adminDeleteProduct(p.id);
      if (edit?.id === p.id) closeDrawer();
      setSuccessMsg("Đã xóa sản phẩm.");
      await loadProducts(pageRef.current);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Không xóa được");
    }
  };

  const modal =
    drawerOpen &&
    draft &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        className={styles.drawerOverlay}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) closeDrawer();
        }}
      >
        <div
          className={styles.drawerPanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-product-dialog-title"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={styles.drawerHead}>
            <h2 id="admin-product-dialog-title" className={styles.subtitle}>
              {createOpen ? "Thêm sản phẩm" : "Sửa sản phẩm"}
            </h2>
            <button type="button" className={styles.btnSmMuted} disabled={saving} onClick={closeDrawer}>
              Đóng
            </button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Tên</span>
              <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <div className={styles.fieldFull}>
              <span className={styles.fieldLabel}>Slug (URL)</span>
              <div className={styles.slugRow}>
                <label className={styles.field} style={{ flex: 1, minWidth: 0 }}>
                  <input
                    className={styles.input}
                    value={draft.slug}
                    placeholder="vi-du-san-pham"
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  />
                </label>
                <button type="button" className={styles.btnSmMuted} onClick={suggestSlugFromName}>
                  Gợi ý từ tên
                </button>
              </div>
              <p className={styles.muted} style={{ marginTop: 6 }}>
                Slug sẽ được chuẩn hóa khi lưu (bỏ dấu, chữ thường, gạch ngang).
              </p>
            </div>
            <label className={styles.fieldFull}>
              <span className={styles.fieldLabel}>Mô tả</span>
              <textarea
                className={styles.textarea}
                rows={4}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Giá (đ)</span>
              <input className={styles.input} inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Giá niêm yết (đ, để trống = không)</span>
              <input className={styles.input} inputMode="numeric" value={draft.listPrice} onChange={(e) => setDraft({ ...draft, listPrice: e.target.value })} />
            </label>
            <label className={styles.fieldFull}>
              <span className={styles.fieldLabel}>Ảnh (URL)</span>
              <input className={styles.input} value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Đánh giá (0–5)</span>
              <input className={styles.input} value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Số lượt đánh giá</span>
              <input className={styles.input} value={draft.reviewCount} onChange={(e) => setDraft({ ...draft, reviewCount: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Đã bán</span>
              <input className={styles.input} value={draft.sold} onChange={(e) => setDraft({ ...draft, sold: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Tồn kho</span>
              <input className={styles.input} type="number" min="0" value={draft.stock_quantity} onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Badge</span>
              <input className={styles.input} value={draft.badge} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Thương hiệu</span>
              <input className={styles.input} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
            </label>
            <label className={styles.fieldFull}>
              <span className={styles.fieldLabel}>Tags</span>
              <input className={styles.input} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
            </label>
            <label className={styles.fieldFull}>
              <span className={styles.fieldLabel}>Danh mục</span>
              <select className={styles.select} value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.btnPrimary} disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : createOpen ? "Tạo và lưu" : "Lưu và đóng"}
            </button>
            <button type="button" className={styles.btnSmMuted} style={{ marginLeft: 10 }} disabled={saving} onClick={closeDrawer}>
              Hủy
            </button>
            {!createOpen && edit && (
              <button type="button" className={styles.btnDanger} style={{ marginLeft: 10 }} disabled={saving} onClick={() => void remove(edit)}>
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div>
      <h1 className={styles.title}>Sản phẩm</h1>
      <p className={styles.lead}>Thêm / sửa / xóa — dữ liệu ghi qua API vào DB (DATABASE_URL). Sau khi lưu, hộp thoại đóng và danh sách được làm mới.</p>

      {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

      <div className={styles.toolbar}>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          + Thêm sản phẩm
        </button>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Danh mục</span>
          <select className={styles.select} value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}>
            <option value="">Tất cả</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.searchRow}>
          <input
            type="search"
            className={styles.input}
            placeholder="Tên, slug, mô tả, thương hiệu…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
          />
          <button type="button" className={styles.btnPrimary} onClick={applySearch}>
            Tìm
          </button>
        </div>
      </div>

      {err && (
        <p className="form-alert" role="alert" style={{ marginBottom: 12 }}>
          {err}
        </p>
      )}
      <p className={styles.muted} style={{ marginBottom: 12 }}>
        {total.toLocaleString("vi-VN")} sản phẩm.
      </p>

      {listLoading ? (
        <p className={styles.muted}>Đang tải…</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Giá</th>
                  <th>Danh mục</th>
                  <th>Tồn kho</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/p/${p.slug}`}>{p.name}</Link>
                    </td>
                    <td>{formatPrice(p.price)}</td>
                    <td className={styles.muted}>{p.category?.name ?? "—"}</td>
                    <td style={{ fontWeight: 600 }}>{p.stock_quantity}</td>
                    <td>
                      <div className={styles.rowBtns}>
                        <button type="button" className={styles.btnSm} onClick={() => openEdit(p)}>
                          Sửa
                        </button>
                        <button type="button" className={styles.btnDanger} onClick={() => void remove(p)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <p className={styles.muted}>Không có sản phẩm phù hợp.</p>}
          {totalPages > 1 && (
            <div className={styles.pager}>
              <button type="button" className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>
                Trước
              </button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <button type="button" className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage((x) => x + 1)}>
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {modal}
    </div>
  );
}
