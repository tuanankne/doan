import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const emptyForm = {
  violation_code: "",
  violation_name: "",
  vehicle_type: "",
  fine_amount: "",
  description: "",
  is_active: true,
};

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) {
    return "0 ₫";
  }
  return `${amount.toLocaleString("vi-VN")} ₫`;
}

function normalizeApiBaseUrl(baseUrl) {
  const value = (baseUrl || "").trim().replace(/\/+$/, "");
  return value.replace(/\/api\/v1$/, "");
}

export default function FineManagementPage() {
  const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1");
  const requestTimeout = 60000;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm);

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const loadItems = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`${apiBaseUrl}/api/v1/violation-penalties`, { timeout: requestTimeout });
      setItems(response.data?.items || []);
    } catch (requestError) {
      const msg = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail || requestError.message || "Không thể tải danh sách mức phạt."
        : "Không thể tải danh sách mức phạt.";
      setError(msg);
      console.error("Load violation-penalties error:", msg, requestError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
    setSuccess("");
    setError("");
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      violation_code: item.violation_code || "",
      violation_name: item.violation_name || "",
      vehicle_type: item.vehicle_type || "",
      fine_amount: String(item.fine_amount ?? ""),
      description: item.description || "",
      is_active: Boolean(item.is_active),
    });
    setSuccess("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {
      violation_code: form.violation_code.trim(),
      violation_name: form.violation_name.trim(),
      vehicle_type: form.vehicle_type || null,
      fine_amount: Number(form.fine_amount),
      description: form.description.trim(),
      is_active: form.is_active,
    };

    if (!payload.violation_code || !payload.violation_name || !Number.isFinite(payload.fine_amount)) {
      setError("Vui lòng nhập đầy đủ mã lỗi, tên lỗi và mức phạt hợp lệ.");
      setSubmitting(false);
      return;
    }

    try {
      if (isEditing) {
        await axios.put(`${apiBaseUrl}/api/v1/violation-penalties/${editingId}`, payload, { timeout: requestTimeout });
        setSuccess("Đã cập nhật mức phạt.");
      } else {
        await axios.post(`${apiBaseUrl}/api/v1/violation-penalties`, payload, { timeout: requestTimeout });
        setSuccess("Đã thêm mức phạt mới.");
      }

      resetForm();
      await loadItems();
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.detail || requestError.message || "Không thể lưu dữ liệu."
          : "Không thể lưu dữ liệu."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Xóa mức phạt \"${item.violation_name}\"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError("");
    setSuccess("");

    try {
      await axios.delete(`${apiBaseUrl}/api/v1/violation-penalties/${item.id}`, { timeout: requestTimeout });
      setSuccess("Đã xóa mức phạt.");
      if (editingId === item.id) {
        resetForm();
      }
      await loadItems();
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.detail || requestError.message || "Không thể xóa dữ liệu."
          : "Không thể xóa dữ liệu."
      );
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div>
      <header className="page-heading">
        <div>
          <h1>Quản lý mức phạt</h1>
          <p className="subtitle">Thêm, sửa, xóa các quy định mức phạt tiền cho từng lỗi vi phạm trong hệ thống.</p>
        </div>
      </header>

      <section className="section-card">
        <div className="section-head">
          <h3>{isEditing ? "Chỉnh sửa mức phạt" : "Thêm mức phạt mới"}</h3>
          {isEditing ? (
            <button type="button" onClick={resetForm} className="btn">
              Hủy chỉnh sửa
            </button>
          ) : null}
        </div>

        <form className="fine-form" onSubmit={handleSubmit}>
          <div className="form-grid fine-grid">
            <div className="field">
              <label htmlFor="violation-code">Mã lỗi</label>
              <input
                id="violation-code"
                value={form.violation_code}
                onChange={(event) => setForm((prev) => ({ ...prev, violation_code: event.target.value }))}
                placeholder="VD: RED_LIGHT"
              />
            </div>

            <div className="field">
              <label htmlFor="violation-name">Tên lỗi</label>
              <input
                id="violation-name"
                value={form.violation_name}
                onChange={(event) => setForm((prev) => ({ ...prev, violation_name: event.target.value }))}
                placeholder="VD: Vượt đèn đỏ"
              />
            </div>

            <div className="field">
              <label htmlFor="vehicle-type">Loại xe áp dụng</label>
              <select
                id="vehicle-type"
                value={form.vehicle_type}
                onChange={(event) => setForm((prev) => ({ ...prev, vehicle_type: event.target.value }))}
              >
                <option value="">Tất cả loại xe</option>
                <option value="Xe gắn máy">Xe gắn máy</option>
                <option value="Xe ô tô">Xe ô tô</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="fine-amount">Mức phạt (VNĐ)</label>
              <input
                id="fine-amount"
                type="number"
                min="0"
                value={form.fine_amount}
                onChange={(event) => setForm((prev) => ({ ...prev, fine_amount: event.target.value }))}
                placeholder="VD: 500000"
              />
            </div>

            <div className="field">
              <label htmlFor="is-active">Trạng thái</label>
              <select
                id="is-active"
                value={form.is_active ? "true" : "false"}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value === "true" }))}
              >
                <option value="true">Đang áp dụng</option>
                <option value="false">Tạm ngưng</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="fine-description">Mô tả</label>
            <textarea
              id="fine-description"
              rows={4}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Nhập mô tả, căn cứ áp dụng hoặc ghi chú khác"
            />
          </div>

          <div className="submit-row">
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? "Đang lưu..." : isEditing ? "Cập nhật mức phạt" : "Thêm mức phạt"}
            </button>
            <button type="button" onClick={resetForm} className="btn btn-danger">
              Xóa nội dung
            </button>
          </div>
        </form>
      </section>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <section className="section-card" style={{ marginTop: 16 }}>
        <div className="section-head">
          <h3>Danh sách mức phạt hiện có</h3>
          <button type="button" onClick={loadItems} className="btn">
            Tải lại
          </button>
        </div>

        {loading ? <div className="hint">Đang tải dữ liệu...</div> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã lỗi</th>
                <th>Tên lỗi</th>
                <th>Loại xe áp dụng</th>
                <th>Mức phạt</th>
                <th>Trạng thái</th>
                <th>Mô tả</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="empty-note">
                    Chưa có dữ liệu mức phạt.
                  </td>
                </tr>
              ) : null}

              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.violation_code}</td>
                  <td>{item.violation_name}</td>
                  <td>{item.vehicle_type || "Tất cả"}</td>
                  <td>{formatMoney(item.fine_amount)}</td>
                  <td>
                    <span className={`status-badge ${item.is_active ? "status-done" : "status-other"}`}>
                      {item.is_active ? "Đang áp dụng" : "Tạm ngưng"}
                    </span>
                  </td>
                  <td>{item.description || "-"}</td>
                  <td>
                    <div className="actions-inline">
                      <button type="button" className="btn" onClick={() => startEdit(item)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? "Đang xóa..." : "Xóa"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
