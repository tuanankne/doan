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
                    className="owner-link-btn"
                    title="Xem giấy đăng ký xe"
                  >
                    {item.owner_full_name || "Chưa có"}
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
        <div className="modal-overlay" onClick={closeOwnerModal}>
          <div className="modal modal-large" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Thông tin phương tiện</h2>
              <button type="button" className="close-btn" onClick={closeOwnerModal}>
                ✕
              </button>
            </div>
            <div className="details-card">
              <div className="vehicle-cert-card">
                <div className="vehicle-cert-head">Thông tin phương tiện</div>
                <div className="vehicle-cert-body">
                  <div className="vehicle-cert-plate">{selectedOwner.detected_license_plate || "-"}</div>
                  <div className="vehicle-cert-verified">Đã xác minh</div>

                  <div className="vehicle-cert-grid">
                    <div className="vehicle-col">
                      <div className="vehicle-item">
                        <span className="label">Số giấy đăng ký</span>
                        <span className="value">{selectedOwner.owner_citizen_id || "-"}</span>
                      </div>
                      <div className="vehicle-item">
                        <span className="label">Ngày đăng ký</span>
                        <span className="value">{selectedOwner.vehicle_registration_date || "-"}</span>
                      </div>
                      <div className="vehicle-item">
                        <span className="label">Loại phương tiện</span>
                        <span className="value">{selectedOwner.vehicle_type || "-"}</span>
                      </div>
                      <div className="vehicle-item">
                        <span className="label">Hãng xe</span>
                        <span className="value">{selectedOwner.vehicle_brand || "-"}</span>
                      </div>
                    </div>

                    <div className="vehicle-col">
                      <div className="vehicle-item">
                        <span className="label">Số khung</span>
                        <span className="value">{selectedOwner.vehicle_frame_number || "-"}</span>
                      </div>
                      <div className="vehicle-item">
                        <span className="label">Số máy</span>
                        <span className="value">{selectedOwner.vehicle_engine_number || "-"}</span>
                      </div>
                      <div className="vehicle-item">
                        <span className="label">Cơ quan cấp</span>
                        <span className="value">{selectedOwner.vehicle_issuing_authority || "-"}</span>
                      </div>
                      <div className="vehicle-item">
                        <span className="label">Chủ xe</span>
                        <span className="value">{selectedOwner.owner_full_name || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
