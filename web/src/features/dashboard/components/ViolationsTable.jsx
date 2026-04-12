import { useState } from "react";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatViolationType(value) {
  if (value === "Vuot den do") {
    return "Vượt đèn đỏ";
  }
  if (value === "Nguoc chieu") {
    return "Ngược chiều";
  }
  return value || "-";
}

function getStatusClassName(value) {
  const status = (value || "").toLowerCase();
  if (status.includes("done") || status.includes("xu ly") || status.includes("hoan")) {
    return "status-badge status-done";
  }
  if (status.includes("cho") || status.includes("pending") || status.includes("wait")) {
    return "status-badge status-pending";
  }
  return "status-badge status-other";
}

function formatStatus(value) {
  const status = (value || "").toLowerCase();
  if (!status) {
    return "Chờ xử lý";
  }
  if (status.includes("done") || status.includes("hoan")) {
    return "Đã xử lý";
  }
  if (status.includes("pending") || status.includes("wait") || status.includes("cho")) {
    return "Chờ xử lý";
  }
  if (status.includes("xu ly")) {
    return "Đang xử lý";
  }
  return value;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") {
    return "Chưa có mức phạt";
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "Chưa có mức phạt";
  }

  return `${amount.toLocaleString("vi-VN")} ₫`;
}

export default function ViolationsTable({ violations, loading, error, onRefresh }) {
  const [selectedOwner, setSelectedOwner] = useState(null);

  const openOwnerModal = (item) => {
    setSelectedOwner(item);
  };

  const closeOwnerModal = () => {
    setSelectedOwner(null);
  };

  return (
    <section className="section-card" style={{ marginTop: 16 }}>
      <div className="section-head">
        <h3>Danh sách vi phạm</h3>
        <button type="button" onClick={onRefresh} className="btn">
          Tải lại
        </button>
      </div>

      {loading ? <div className="hint">Đang tải dữ liệu...</div> : null}
      {error ? <div className="alert alert-danger">Lỗi: {error}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Biển số</th>
              <th>Loại xe</th>
              <th>Chủ xe</th>
              <th>Loại lỗi</th>
              <th>Mức phạt</th>
              <th>Trạng thái</th>
              <th>Ảnh toàn cảnh</th>
              <th>Ảnh biển số</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 && !loading ? (
              <tr>
                <td colSpan={9} className="empty-note">
                  Chưa có dữ liệu vi phạm.
                </td>
              </tr>
            ) : null}

            {violations.map((item) => (
              <tr key={item.id || `${item.detected_at}-${item.detected_license_plate || "unknown"}`}>
                <td>{formatDate(item.detected_at)}</td>
                <td>{item.detected_license_plate || "Không đọc được"}</td>
                <td>{item.vehicle_type || "Không xác định"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => openOwnerModal(item)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#1b4d3e",
                    }}
                    title="Xem giấy đăng ký xe"
                  >
                    <div style={{ fontWeight: 600 }}>{item.owner_full_name || "Chưa có"}</div>
                    <div className="hint" style={{ fontSize: 12 }}>
                      {item.owner_citizen_id || ""}
                    </div>
                  </button>
                </td>
                <td>{formatViolationType(item.violation_type)}</td>
                <td>
                  <div>{formatMoney(item.fine_amount_snapshot)}</div>
                </td>
                <td>
                  <span className={getStatusClassName(item.status)}>{formatStatus(item.status)}</span>
                </td>
                <td>
                  {item.evidence_image_url ? (
                    <a href={item.evidence_image_url} target="_blank" rel="noreferrer">
                      <img src={item.evidence_image_url} alt="Toàn cảnh" className="thumb" />
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {item.evidence_plate_url ? (
                    <a href={item.evidence_plate_url} target="_blank" rel="noreferrer">
                      <img src={item.evidence_plate_url} alt="Biển số" className="thumb" />
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedOwner ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeOwnerModal}
        >
          <div
            className="section-card"
            style={{ width: "min(680px, 92vw)", maxHeight: "86vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h3>Thông tin giấy đăng ký xe</h3>
              <button type="button" className="btn" onClick={closeOwnerModal}>
                Đóng
              </button>
            </div>
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div><strong>Biển số:</strong> {selectedOwner.detected_license_plate || "-"}</div>
              <div><strong>Loại xe:</strong> {selectedOwner.vehicle_type || "-"}</div>
              <div><strong>Chủ xe:</strong> {selectedOwner.owner_full_name || "-"}</div>
              <div><strong>CCCD:</strong> {selectedOwner.owner_citizen_id || "-"}</div>
              <div><strong>SĐT:</strong> {selectedOwner.owner_phone_number || "-"}</div>
              <div><strong>Địa chỉ:</strong> {selectedOwner.owner_address || "-"}</div>
              <div><strong>Hãng xe:</strong> {selectedOwner.vehicle_brand || "-"}</div>
              <div><strong>Màu xe:</strong> {selectedOwner.vehicle_color || "-"}</div>
              <div><strong>Số khung:</strong> {selectedOwner.vehicle_frame_number || "-"}</div>
              <div><strong>Số máy:</strong> {selectedOwner.vehicle_engine_number || "-"}</div>
              <div><strong>Ngày đăng ký:</strong> {selectedOwner.vehicle_registration_date || "-"}</div>
              <div><strong>Hạn đăng ký:</strong> {selectedOwner.vehicle_registration_expiry_date || "-"}</div>
              <div><strong>Cơ quan cấp:</strong> {selectedOwner.vehicle_issuing_authority || "-"}</div>
              <div><strong>Trạng thái ĐK:</strong> {selectedOwner.vehicle_registration_status || "-"}</div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
