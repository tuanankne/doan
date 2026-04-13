import React, { useState, useEffect } from "react";
import {
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  checkCitizen,
} from "../../../shared/api/managementApi";
import "../styles/ManagementPages.css";

const VehiclesManagementPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [citizenCheckStatus, setCitizenCheckStatus] = useState(null); // "checking", "exists", "not-found", null
  const [formData, setFormData] = useState({
    citizen_id: "",
    license_plate: "",
    vehicle_type: "",
    brand: "",
    color: "",
    frame_number: "",
    engine_number: "",
    registration_date: "",
    registration_expiry_date: "",
    issuing_authority: "",
    registration_status: "Hoạt động",
  });
  const [searchPlate, setSearchPlate] = useState("");

  const filteredVehicles = vehicles.filter((vehicle) =>
    vehicle.license_plate.toLowerCase().includes(searchPlate.toLowerCase())
  );

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const response = await listVehicles();
      setVehicles(response.items || []);
    } catch (error) {
      alert("Lỗi tải danh sách phương tiện: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setCitizenCheckStatus(null);
    setFormData({
      citizen_id: "",
      license_plate: "",
      vehicle_type: "",
      brand: "",
      color: "",
      frame_number: "",
      engine_number: "",
      registration_date: "",
      registration_expiry_date: "",
      issuing_authority: "",
      registration_status: "Hoạt động",
    });
    setShowForm(true);
  };

  const handleEditClick = (vehicle) => {
    setEditingId(vehicle.id);
    setCitizenCheckStatus(null);
    setFormData({
      citizen_id: vehicle.citizen_id,
      license_plate: vehicle.license_plate || "",
      vehicle_type: vehicle.vehicle_type || "",
      brand: vehicle.brand || "",
      color: vehicle.color || "",
      frame_number: vehicle.frame_number || "",
      engine_number: vehicle.engine_number || "",
      registration_date: vehicle.registration_date || "",
      registration_expiry_date: vehicle.registration_expiry_date || "",
      issuing_authority: vehicle.issuing_authority || "",
      registration_status: vehicle.registration_status || "Hoạt động",
    });
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "citizen_id") {
      setCitizenCheckStatus(null);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        const original = vehicles.find((v) => v.id === editingId);
        if ((formData.citizen_id || "") !== (original?.citizen_id || "")) {
          const citizenResponse = await checkCitizen(formData.citizen_id);
          if (!citizenResponse.exists) {
            alert("CCCD mới không tồn tại trong hồ sơ dân cư");
            return;
          }
        }
        Object.keys(formData).forEach((key) => {
          if (formData[key] !== (original[key] || "")) {
            updateData[key] = formData[key];
          }
        });
        await updateVehicle(editingId, updateData);
        alert("Cập nhật phương tiện thành công!");
      } else {
        await createVehicle(formData);
        alert("Thêm phương tiện thành công!");
      }
      setShowForm(false);
      await loadVehicles();
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa phương tiện này?")) {
      try {
        await deleteVehicle(id);
        alert("Xóa phương tiện thành công!");
        await loadVehicles();
      } catch (error) {
        alert("Lỗi xóa: " + error.message);
      }
    }
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Quản Lí Phương Tiện</h1>
        <button onClick={handleAddClick} className="btn-primary">
          + Thêm Phương Tiện
        </button>
      </div>

      <div style={{ marginBottom: 16, background: "white", padding: 12, borderRadius: 8 }}>
        <input
          type="text"
          placeholder="Tìm kiếm theo biển số..."
          value={searchPlate}
          onChange={(e) => setSearchPlate(e.target.value)}
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
                <th>Biển KK</th>
                <th>CCCD</th>
                <th>Hãng Xe</th>
                <th>Loại Xe</th>
                <th>Màu</th>
                <th>Số Khung</th>
                <th>Ngày Đăng Ký</th>
                <th>Trạng Thái</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.license_plate}</td>
                  <td>{vehicle.citizen_id}</td>
                  <td>{vehicle.brand || "-"}</td>
                  <td>{vehicle.vehicle_type || "-"}</td>
                  <td>{vehicle.color || "-"}</td>
                  <td>{vehicle.frame_number || "-"}</td>
                  <td>{vehicle.registration_date || "-"}</td>
                  <td>{vehicle.registration_status}</td>
                  <td className="action-buttons">
                    <button
                      onClick={() => handleEditClick(vehicle)}
                      className="btn-edit"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteClick(vehicle.id)}
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
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingId ? "Chỉnh Sửa Phương Tiện" : "Thêm Phương Tiện Mới"}
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
                    required
                  />
                  <button
                    type="button"
                    onClick={handleCheckCitizen}
                    className="btn-check"
                  >
                    Kiểm tra
                  </button>
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
                  <label>Biển KK *</label>
                  <input
                    type="text"
                    name="license_plate"
                    value={formData.license_plate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Loại Xe</label>
                  <input
                    type="text"
                    name="vehicle_type"
                    value={formData.vehicle_type}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Hãng Xe</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Màu</label>
                  <input
                    type="text"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Số Khung</label>
                  <input
                    type="text"
                    name="frame_number"
                    value={formData.frame_number}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Số Máy</label>
                  <input
                    type="text"
                    name="engine_number"
                    value={formData.engine_number}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ngày Đăng Ký</label>
                  <input
                    type="date"
                    name="registration_date"
                    value={formData.registration_date}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Hết Hạn Đăng Ký</label>
                  <input
                    type="date"
                    name="registration_expiry_date"
                    value={formData.registration_expiry_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Cơ Quan Cấp</label>
                <input
                  type="text"
                  name="issuing_authority"
                  value={formData.issuing_authority}
                  onChange={handleInputChange}
                />
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

export default VehiclesManagementPage;
