import React, { useState, useEffect } from "react";
import {
  listDriverLicenses,
  createDriverLicense,
  updateDriverLicense,
  deleteDriverLicense,
  checkCitizen,
} from "../../../shared/api/managementApi";
import "../styles/ManagementPages.css";

const DriverLicensesManagementPage = () => {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [citizenCheckStatus, setCitizenCheckStatus] = useState(null); // "checking", "exists", "not-found", null
  const [formData, setFormData] = useState({
    citizen_id: "",
    license_number: "",
    license_class: "",
    issued_date: "",
    expiry_date: "",
    issuing_authority: "",
    points: 12,
    status: "Hoạt động",
  });
  const [searchCitizendId, setSearchCitizendId] = useState("");

  useEffect(() => {
    loadDriverLicenses();
  }, []);

  const filteredLicenses = licenses.filter((license) =>
    license.citizen_id.toLowerCase().includes(searchCitizendId.toLowerCase())
  );

  const loadDriverLicenses = async () => {
    setLoading(true);
    try {
      const response = await listDriverLicenses();
      setLicenses(response.items || []);
    } catch (error) {
      alert("Lỗi tải danh sách bằng lái: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setCitizenCheckStatus(null);
    setFormData({
      citizen_id: "",
      license_number: "",
      license_class: "",
      issued_date: "",
      expiry_date: "",
      issuing_authority: "",
      points: 12,
      status: "Hoạt động",
    });
    setShowForm(true);
  };

  const handleEditClick = (license) => {
    setEditingId(license.id);
    setCitizenCheckStatus(null);
    setFormData({
      citizen_id: license.citizen_id,
      license_number: license.license_number || "",
      license_class: license.license_class || "",
      issued_date: license.issued_date || "",
      expiry_date: license.expiry_date || "",
      issuing_authority: license.issuing_authority || "",
      points: license.points || 12,
      status: license.status || "Hoạt động",
    });
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "points" ? parseInt(value) || 0 : value,
    }));
  };

  const handleCheckCitizen = async () => {
    if (!formData.citizen_id.trim()) {
      alert("Vui lòng nhập CCCD");
      return;
    }
    setCitizenCheckStatus("checking");
    try {
      const response = await checkCitizen(formData.citizen_id);
      setCitizenCheckStatus(response.exists ? "exists" : "not-found");
    } catch (error) {
      setCitizenCheckStatus("not-found");
      alert("Lỗi kiểm tra: " + error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (citizenCheckStatus !== "exists" && !editingId) {
        alert("Vui lòng kiểm tra và xác nhận CCCD tồn tại");
        return;
      }

      if (editingId) {
        const updateData = {};
        const original = licenses.find((l) => l.id === editingId);
        Object.keys(formData).forEach((key) => {
          if (key === "citizen_id") {
            return;
          }
          if (formData[key] !== (original[key] || "")) {
            updateData[key] = formData[key];
          }
        });
        await updateDriverLicense(editingId, updateData);
        alert("Cập nhật bằng lái thành công!");
      } else {
        await createDriverLicense(formData);
        alert("Thêm bằng lái thành công!");
      }
      setShowForm(false);
      await loadDriverLicenses();
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bằng lái này?")) {
      try {
        await deleteDriverLicense(id);
        alert("Xóa bằng lái thành công!");
        await loadDriverLicenses();
      } catch (error) {
        alert("Lỗi xóa: " + error.message);
      }
    }
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Quản Lí Bằng Lái Xe</h1>
        <button onClick={handleAddClick} className="btn-primary">
          + Thêm Bằng Lái
        </button>
      </div>

      <div style={{ marginBottom: 16, background: "white", padding: 12, borderRadius: 8 }}>
        <input
          type="text"
          placeholder="Tìm kiếm theo CCCD..."
          value={searchCitizendId}
          onChange={(e) => setSearchCitizendId(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>CCCD</th>
                <th>Số Giấy Phép</th>
                <th>Hạng</th>
                <th>Ngày Cấp</th>
                <th>Hết Hạn</th>
                <th>Điểm</th>
                <th>Trạng Thái</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredLicenses.map((license) => (
                <tr key={license.id}>
                  <td>{license.citizen_id}</td>
                  <td>{license.license_number}</td>
                  <td>{license.license_class}</td>
                  <td>{license.issued_date || "-"}</td>
                  <td>{license.expiry_date || "Không thời hạn"}</td>
                  <td>{license.points}</td>
                  <td>{license.status}</td>
                  <td className="action-buttons">
                    <button
                      onClick={() => handleEditClick(license)}
                      className="btn-edit"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteClick(license.id)}
                      className="btn-delete"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingId ? "Chỉnh Sửa Bằng Lái" : "Thêm Bằng Lái Mới"}
              </h2>
              <button
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label>CCCD *</label>
                <div className="citizen-check">
                  <input
                    type="text"
                    name="citizen_id"
                    value={formData.citizen_id}
                    onChange={handleInputChange}
                    disabled={!!editingId}
                    required
                  />
                  {!editingId && (
                    <button
                      type="button"
                      onClick={handleCheckCitizen}
                      className="btn-check"
                    >
                      Kiểm tra
                    </button>
                  )}
                </div>
                {citizenCheckStatus === "exists" && (
                  <div className="status-message success">✓ CCCD tồn tại</div>
                )}
                {citizenCheckStatus === "not-found" && (
                  <div className="status-message error">✗ CCCD không tồn tại</div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Số Giấy Phép *</label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Hạng Bằng *</label>
                  <input
                    type="text"
                    name="license_class"
                    value={formData.license_class}
                    onChange={handleInputChange}
                    placeholder="VD: A1, A2, B, C"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ngày Cấp *</label>
                  <input
                    type="date"
                    name="issued_date"
                    value={formData.issued_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Hết Hạn</label>
                  <input
                    type="date"
                    name="expiry_date"
                    value={formData.expiry_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cơ Quan Cấp</label>
                  <input
                    type="text"
                    name="issuing_authority"
                    value={formData.issuing_authority}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Điểm</label>
                  <input
                    type="number"
                    name="points"
                    value={formData.points}
                    onChange={handleInputChange}
                    min="0"
                    max="12"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Trạng Thái</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Hết hạn">Hết hạn</option>
                  <option value="Tạm dừng">Tạm dừng</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingId ? "Cập Nhật" : "Thêm"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverLicensesManagementPage;
