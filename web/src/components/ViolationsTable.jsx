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

export default function ViolationsTable({ violations, loading, error, onRefresh }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Danh sach vi pham</h2>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#ffffff",
            cursor: "pointer",
          }}
        >
          Tai lai
        </button>
      </div>

      {loading ? <div>Dang tai du lieu...</div> : null}
      {error ? (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            color: "#991b1b",
            background: "#fee2e2",
          }}
        >
          Loi: {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={thStyle}>Thoi gian</th>
              <th style={thStyle}>Bien so</th>
              <th style={thStyle}>Loai loi</th>
              <th style={thStyle}>Trang thai</th>
              <th style={thStyle}>Anh toan canh</th>
              <th style={thStyle}>Anh bien so</th>
              <th style={thStyle}>ID</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>
                  Chua co du lieu vi pham.
                </td>
              </tr>
            ) : null}

            {violations.map((item) => (
              <tr key={item.id || `${item.detected_at}-${item.detected_license_plate || "unknown"}`}>
                <td style={tdStyle}>{formatDate(item.detected_at)}</td>
                <td style={tdStyle}>{item.detected_license_plate || "Khong doc duoc"}</td>
                <td style={tdStyle}>{formatViolationType(item.violation_type)}</td>
                <td style={tdStyle}>{item.status || "Cho xu ly"}</td>
                <td style={tdStyle}>
                  {item.evidence_image_url ? (
                    <a href={item.evidence_image_url} target="_blank" rel="noreferrer">
                      <img
                        src={item.evidence_image_url}
                        alt="Scene"
                        style={{ width: 140, height: 80, objectFit: "cover", borderRadius: 6 }}
                      />
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={tdStyle}>
                  {item.evidence_plate_url ? (
                    <a href={item.evidence_plate_url} target="_blank" rel="noreferrer">
                      <img
                        src={item.evidence_plate_url}
                        alt="Plate"
                        style={{ width: 140, height: 80, objectFit: "cover", borderRadius: 6 }}
                      />
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={tdStyle}>{item.id || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thStyle = {
  textAlign: "left",
  fontWeight: 600,
  fontSize: 14,
  color: "#111827",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "middle",
  fontSize: 14,
  color: "#1f2937",
};
