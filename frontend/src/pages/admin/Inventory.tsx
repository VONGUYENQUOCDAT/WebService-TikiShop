import { useState, useEffect } from "react";
import { api } from "@/shared/api/client";
import styles from "./AdminPages.module.css";

export default function AdminInventory() {
  const [stockList, setStockList] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Transfer Modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [srcBranchId, setSrcBranchId] = useState("");
  const [destBranchId, setDestBranchId] = useState("");
  const [transferProductId, setTransferProductId] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Reconciliation Dashboard Widget
  const [reconReport, setReconReport] = useState<any | null>(null);
  const [reconLoading, setReconLoading] = useState(false);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const [stockRes, brRes, transRes] = await Promise.all([
        api.branchStock({ branchId: selectedBranchId, q: searchTerm }),
        api.branches(),
        api.transfers()
      ]);
      setStockList(stockRes);
      setBranches(brRes);
      setTransfers(transRes);
    } catch (err) {
      console.error("Lỗi lấy dữ liệu tồn kho:", err);
    } finally {
      setLoading(false);
    }
  };

  const runReconciliation = async () => {
    try {
      setReconLoading(true);
      const res = await api.reconciliation();
      setReconReport(res);
    } catch (err) {
      console.error("Lỗi đối soát dữ liệu:", err);
    } finally {
      setReconLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
    runReconciliation();
  }, [selectedBranchId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStock();
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    try {
      await api.createTransfer({
        srcBranchId,
        destBranchId,
        items: [
          { productId: transferProductId, quantity: Number(transferQty) }
        ]
      });

      setShowTransfer(false);
      setTransferProductId("");
      setTransferQty(1);
      fetchStock();
    } catch (err: any) {
      setTransferError(err.message || "Luân chuyển kho thất bại.");
    }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <div style={{ flex: 1 }}>
          <h1 className={styles.title}>Quản lý Kho hàng & Điều chuyển (Inventory & Transfers)</h1>
          <p className={styles.lead}>Quản lý lượng hàng thực tế tại từng chi nhánh Tiki Shop, điều phối hàng liên chi nhánh.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className={styles.btnPrimary} style={{ background: "#2563eb" }} onClick={runReconciliation}>
            🔄 Chạy đối soát dữ liệu (Reconcile)
          </button>
          <button className={styles.btnPrimary} onClick={() => { setTransferError(null); setShowTransfer(true); }}>
            ⇄ Tạo phiếu luân chuyển
          </button>
        </div>
      </div>

      {/* Reconciliation Engine Widget (Section 11) */}
      {reconReport && (
        <div className={styles.panel} style={{ marginBottom: "24px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
            <div>
              <h3 className={styles.subtitle} style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                Hệ thống Đối soát Tồn kho Tự động (Inventory Reconciliation Engine)
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Kiểm tra lệch tồn kho (Stock Drift), Lô trống, Lịch sử sổ cái, Sai lệch nhà cung cấp.
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Điểm toàn vẹn:</span><br />
              <strong style={{ fontSize: "1.5rem", color: reconReport.integrityScore === 100 ? "#0d9488" : "#b91c1c" }}>
                {reconReport.integrityScore} / 100
              </strong>
            </div>
          </div>

          {reconLoading ? (
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Đang quét cơ sở dữ liệu...</p>
          ) : (
            <div>
              {reconReport.discrepancies.length === 0 ? (
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: "10px 14px", borderRadius: "8px", fontSize: "0.88rem", fontWeight: 600 }}>
                  ✓ Hoàn hảo: Không phát hiện bất kỳ sai lệch nào giữa Kho hàng, Lô hàng và Sổ cái giao dịch.
                </div>
              ) : (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 14px", borderRadius: "8px" }}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 700, fontSize: "0.9rem" }}>
                    ⚠️ Phát hiện {reconReport.discrepancies.length} điểm sai lệch dữ liệu:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {reconReport.discrepancies.map((d: any, idx: number) => (
                      <li key={idx}>
                        <strong>[{d.type}]</strong> {d.productName} ({d.branchName}): {d.details} (Dự kiến: {d.expected}, Thực tế: {d.actual})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter stock table */}
      <div className={styles.panel} style={{ marginBottom: "20px" }}>
        <form onSubmit={handleSearch} className={styles.toolbar} style={{ marginBottom: 0 }}>
          <div className={styles.searchRow}>
            <select
              className={styles.select}
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="">-- Tất cả chi nhánh Tiki Shop --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm..."
              className={styles.input}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.btnPrimary}>
            Lọc kho
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>Đang tải...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
          {/* Stock List Table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Chi nhánh</th>
                  <th>Sản phẩm</th>
                  <th>SKU</th>
                  <th>Số lượng tồn (Chi nhánh)</th>
                  <th>Tổng tồn kho (Sản phẩm)</th>
                  <th>Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {stockList.map((st) => {
                  const isLow = st.stock <= st.minStock;
                  return (
                    <tr key={st.id}>
                      <td style={{ fontWeight: 500 }}>{st.branch?.name}</td>
                      <td>{st.product?.name}</td>
                      <td className={styles.mono}>{st.product?.sku}</td>
                      <td style={{ fontWeight: 700, fontSize: "1rem", color: isLow ? "#b91c1c" : "#0f172a" }}>
                        {st.stock}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {st.product?.stock_quantity}
                      </td>
                      <td>
                        {isLow ? (
                          <span className={`${styles.pill} ${styles.pill_bad}`} style={{ fontSize: "0.68rem" }}>
                            Sắp hết hàng
                          </span>
                        ) : (
                          <span className={`${styles.pill} ${styles.pill_ok}`} style={{ fontSize: "0.68rem" }}>
                            An toàn
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {stockList.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                      Không có sản phẩm nào khớp với tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Stock Transfers History (Right Column) */}
          <div>
            <h3 className={styles.subtitle} style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px" }}>
              Lịch sử điều chuyển nội bộ
            </h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Nguồn → Đích</th>
                    <th>Chi tiết điều chuyển</th>
                    <th>Ngày lập</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((tr) => (
                    <tr key={tr.id}>
                      <td className={styles.mono} style={{ fontWeight: 600 }}>{tr.transferNumber}</td>
                      <td style={{ fontSize: "0.85rem" }}>
                        <strong>Từ:</strong> {tr.srcBranch?.name.substring(10)}<br />
                        <strong>Tới:</strong> {tr.destBranch?.name.substring(10)}
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>
                        <ul style={{ margin: 0, paddingLeft: "14px" }}>
                          {tr.items.map((tri: any) => (
                            <li key={tri.id}>
                              {tri.product?.name}: <strong>{tri.quantity}</strong>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{new Date(tr.createdAt).toLocaleDateString("vi-VN")}</td>
                      <td>
                        <span className={`${styles.pill} ${styles.pill_ok}`}>
                          {tr.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        Chưa có giao dịch điều chuyển nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Drawer */}
      {showTransfer && (
        <div className={styles.drawerOverlay} onClick={() => setShowTransfer(false)}>
          <div className={styles.drawerPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHead}>
              <h2 className={styles.subtitle} style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                Lập phiếu điều chuyển tồn kho (FEFO Allocation)
              </h2>
              <button className={styles.btnSmMuted} onClick={() => setShowTransfer(false)}>
                Đóng
              </button>
            </div>

            {transferError && <div className={styles.btnDanger} style={{ padding: "10px", marginBottom: "12px", borderRadius: "8px" }}>{transferError}</div>}

            <form onSubmit={handleExecuteTransfer} className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Kho hàng nguồn (Deduct stock)</label>
                <select
                  required
                  className={styles.select}
                  value={srcBranchId}
                  onChange={(e) => setSrcBranchId(e.target.value)}
                >
                  <option value="">-- Chọn Kho nguồn --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Kho nhận hàng (Add stock)</label>
                <select
                  required
                  className={styles.select}
                  value={destBranchId}
                  onChange={(e) => setDestBranchId(e.target.value)}
                >
                  <option value="">-- Chọn Kho nhận --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.fieldLabel}>Sản phẩm cần điều phối</label>
                <select
                  required
                  className={styles.select}
                  style={{ width: "100%" }}
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                >
                  <option value="">-- Chọn sản phẩm --</option>
                  {/* List products from stockList matching source branch to see what is available */}
                  {stockList
                    .filter(st => !srcBranchId || st.branchId === srcBranchId)
                    .map(st => (
                      <option key={st.product.id} value={st.product.id}>
                        {st.product.name} (Tồn kho: {st.stock})
                      </option>
                    ))}
                </select>
              </div>

              <div className={styles.fieldFull}>
                <label className={styles.fieldLabel}>Số lượng điều chuyển</label>
                <input
                  type="number"
                  required
                  min="1"
                  className={styles.input}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                />
              </div>

              <div className={styles.drawerActions} style={{ gridColumn: "1 / -1", display: "flex", justifySelf: "flex-end", gap: "10px" }}>
                <button type="button" className={styles.btnSmMuted} onClick={() => setShowTransfer(false)}>
                  Hủy
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Xác nhận điều phối (FEFO)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
