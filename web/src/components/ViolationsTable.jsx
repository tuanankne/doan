import React from "react";

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
    return "Vuot den do";
  }
  if (value === "Nguoc chieu") {
    return "Nguoc chieu";
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

export default function ViolationsTable({ violations, loading, error, onRefresh }) {
  return (
    <section className="section-card" style={{ marginTop: 16 }}>
      <div className="section-head">
        <h3>Danh sách vi phạm</h3>
        <button type="button" onClick={onRefresh} className="btn">
          Tai lai
        </button>
      </div>

      {loading ? <div className="hint">Dang tai du lieu...</div> : null}
      {error ? <div className="alert alert-danger">Loi: {error}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thoi gian</th>
              <th>Bien so</th>
              <th>Loai loi</th>
              <th>Trang thai</th>
              <th>Anh toan canh</th>
              <th>Anh bien so</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="empty-note">
                  Chua co du lieu vi pham.
                </td>
              </tr>
            ) : null}

            {violations.map((item) => (
              <tr key={item.id || `${item.detected_at}-${item.detected_license_plate || "unknown"}`}>
                <td>{formatDate(item.detected_at)}</td>
                <td>{item.detected_license_plate || "Khong doc duoc"}</td>
                <td>{formatViolationType(item.violation_type)}</td>
                <td>
                  <span className={getStatusClassName(item.status)}>{item.status || "Cho xu ly"}</span>
                </td>
                <td>
                  {item.evidence_image_url ? (
                    <a href={item.evidence_image_url} target="_blank" rel="noreferrer">
                      <img src={item.evidence_image_url} alt="Scene" className="thumb" />
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {item.evidence_plate_url ? (
                    <a href={item.evidence_plate_url} target="_blank" rel="noreferrer">
                      <img src={item.evidence_plate_url} alt="Plate" className="thumb" />
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
