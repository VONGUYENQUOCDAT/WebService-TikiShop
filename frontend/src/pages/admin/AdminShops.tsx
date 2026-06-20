import { useCallback, useEffect, useState } from "react";
import { api } from "@/shared/api/client";
import type { Shop } from "@/shared/api/types";
import { useToast } from "@/shared/ui/Toast";
import styles from "./AdminPages.module.css";

export default function AdminShops() {
  const toast = useToast();
  const [items, setItems] = useState<Shop[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingShop, setRejectingShop] = useState<Shop | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    api
      .adminShops({
        page,
        limit: 10,
        status: status || undefined,
        q: q || undefined,
      })
      .then((r) => {
        setItems(r.items);
        setTotalPages(Math.max(1, r.pagination.totalPages));
        setTotal(r.pagination.total);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, q]);

  const applySearch = () => setQ(qInput.trim());

  const handleApprove = async (shop: Shop) => {
    const ok = window.confirm(`Bạn có chắc muốn phê duyệt gian hàng "${shop.shopName}"? Chủ gian hàng sẽ được phân quyền SELLER.`);
    if (!ok) return;

    setBusyId(shop.id);
    try {
      await api.adminApproveShop(shop.id);
      toast({
        title: "Duyệt thành công",
        message: `Gian hàng "${shop.shopName}" đã được duyệt hoạt động.`,
        type: "success",
      });
      load();
    } catch (e: any) {
      toast({
        title: "Lỗi phê duyệt",
        message: e.message || "Không thể phê duyệt gian hàng.",
        type: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenRejectModal = (shop: Shop) => {
    setRejectingShop(shop);
    setRejectReason("");
  };

  const handleCloseRejectModal = () => {
    setRejectingShop(null);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectingShop) return;
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối.");
      return;
    }

    setRejecting(true);
    try {
      await api.adminRejectShop(rejectingShop.id, rejectReason.trim());
      toast({
        title: "Từ chối thành công",
        message: `Đã từ chối gian hàng "${rejectingShop.shopName}".`,
        type: "success",
      });
      handleCloseRejectModal();
      load();
    } catch (e: any) {
      toast({
        title: "Lỗi từ chối",
        message: e.message || "Không thể từ chối gian hàng.",
        type: "error",
      });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div>
      <h1 className={styles.title}>Quản lý Gian hàng (Multi-Vendor)</h1>
      <p className={styles.lead}>
        Xét duyệt hồ sơ đăng ký mở gian hàng của người dùng hệ thống. Phê duyệt để phân quyền người bán (SELLER).
      </p>

      {/* Toolbar / Filters */}
      <div className={styles.toolbar} style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { value: "", label: "Tất cả" },
            { value: "PENDING", label: "Chờ duyệt" },
            { value: "APPROVED", label: "Đã duyệt" },
            { value: "REJECTED", label: "Từ chối" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={status === tab.value ? styles.btnPrimary : styles.btnSmMuted}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.searchRow} style={{ maxWidth: "360px" }}>
          <input
            type="search"
            className={styles.input}
            placeholder="Tên shop, email chủ..."
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
        {total.toLocaleString("vi-VN")} gian hàng được tìm thấy.
      </p>

      {loading ? (
        <p className={styles.muted}>Đang tải danh sách...</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên gian hàng</th>
                  <th>Chủ gian hàng</th>
                  <th>Xác minh (MST/CCCD)</th>
                  <th>Địa chỉ kho</th>
                  <th>Trạng thái</th>
                  <th>Ngày đăng ký</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                      Không tìm thấy gian hàng nào.
                    </td>
                  </tr>
                ) : (
                  items.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.shopName}</td>
                      <td>
                        <div>{s.owner?.name}</div>
                        <div className={styles.muted} style={{ fontSize: "11px" }}>{s.owner?.email}</div>
                      </td>
                      <td>
                        {s.taxCode && <div>MST: <span className={styles.mono}>{s.taxCode}</span></div>}
                        {s.idCard && <div>CCCD: <span className={styles.mono}>{s.idCard}</span></div>}
                        {!s.taxCode && !s.idCard && <span className={styles.muted}>Chưa cung cấp</span>}
                      </td>
                      <td style={{ maxWidth: "200px", wordBreak: "break-word" }}>{s.businessAddress}</td>
                      <td>
                        <span
                          className={`${styles.pill} ${
                            s.status === "APPROVED"
                              ? styles.pill_ok
                              : s.status === "REJECTED"
                              ? styles.pill_bad
                              : styles.pill_warn
                          }`}
                        >
                          {s.status === "PENDING"
                            ? "Chờ duyệt"
                            : s.status === "APPROVED"
                            ? "Đã duyệt"
                            : "Từ chối"}
                        </span>
                        {s.status === "REJECTED" && s.rejectReason && (
                          <div className={styles.muted} style={{ fontSize: "11px", marginTop: "4px", maxWidth: "150px" }}>
                            Lý do: {s.rejectReason}
                          </div>
                        )}
                      </td>
                      <td className={styles.muted}>{new Date(s.createdAt).toLocaleDateString("vi-VN")}</td>
                      <td>
                        <div className={styles.rowBtns}>
                          {s.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                className={styles.btnSm}
                                disabled={busyId === s.id}
                                onClick={() => handleApprove(s)}
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                className={styles.btnDanger}
                                disabled={busyId === s.id}
                                onClick={() => handleOpenRejectModal(s)}
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {s.status === "APPROVED" && (
                            <span style={{ fontSize: "12px", color: "green", fontWeight: 600 }}>✓ Đang hoạt động</span>
                          )}
                          {s.status === "REJECTED" && (
                            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Đã từ chối</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {/* Rejection Modal */}
      {rejectingShop && (
        <div className={styles.drawerOverlay}>
          <div className={styles.drawerPanel} style={{ maxWidth: "500px" }}>
            <div className={styles.drawerHead}>
              <h2 className={styles.subtitle} style={{ fontSize: "16px", fontWeight: 700 }}>
                Từ chối hồ sơ gian hàng
              </h2>
              <button
                type="button"
                className={styles.btnSmMuted}
                onClick={handleCloseRejectModal}
                disabled={rejecting}
              >
                Đóng
              </button>
            </div>
            
            <p className={styles.muted} style={{ marginBottom: 16 }}>
              Gian hàng: <strong>{rejectingShop.shopName}</strong> (Chủ shop: {rejectingShop.owner?.email})
            </p>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Lý do từ chối <span style={{ color: "red" }}>*</span></span>
              <textarea
                rows={4}
                className={styles.textarea}
                placeholder="Nhập lý do từ chối để thông báo cho người đăng ký..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={rejecting}
                required
              />
            </div>

            <div className={styles.drawerActions} style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className={styles.btnSmMuted}
                onClick={handleCloseRejectModal}
                disabled={rejecting}
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ backgroundColor: "#ef4444" }}
                onClick={handleReject}
                disabled={rejecting}
              >
                {rejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
