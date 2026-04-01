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

export default function ViolationsTable({ violations, loading, error, onRefresh }) {
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
              <th>Loại lỗi</th>
              <th>Trạng thái</th>
              <th>Ảnh toàn cảnh</th>
              <th>Ảnh biển số</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="empty-note">
                  Chưa có dữ liệu vi phạm.
                </td>
              </tr>
            ) : null}

            {violations.map((item) => (
              <tr key={item.id || `${item.detected_at}-${item.detected_license_plate || "unknown"}`}>
                <td>{formatDate(item.detected_at)}</td>
                <td>{item.detected_license_plate || "Không đọc được"}</td>
                <td>{formatViolationType(item.violation_type)}</td>
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
                <td>{item.id || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
