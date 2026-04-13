import React, { useState, useEffect } from "react";
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  listDriverLicenses,
  listVehicles,
} from "../../../shared/api/managementApi";
import "../styles/ManagementPages.css";

const ProfilesManagementPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    citizen_id: "",
    phone_number: "",
    address: "",
    date_of_birth: "",
  });
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null); // "license" or "vehicle"
  const [detailItems, setDetailItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [vehiclePlateMap, setVehiclePlateMap] = useState({});
  const [licenseClassMap, setLicenseClassMap] = useState({});
  const [searchCitizendId, setSearchCitizendId] = useState("");

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const filteredProfiles = profiles.filter((profile) =>
    profile.citizen_id.toLowerCase().includes(searchCitizendId.toLowerCase())
  );

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const [profilesResponse, vehiclesResponse, licensesResponse] = await Promise.all([
        listProfiles(),
        listVehicles(),
        listDriverLicenses(),
      ]);

      setProfiles(profilesResponse.items || []);

      const plateMap = {};
      (vehiclesResponse.items || []).forEach((vehicle) => {
        if (vehicle?.id) {
          plateMap[vehicle.id] = vehicle.license_plate || vehicle.id;
        }
      });
      setVehiclePlateMap(plateMap);

      const classMap = {};
      (licensesResponse.items || []).forEach((license) => {
        if (license?.id) {
          classMap[license.id] = license.license_class || "-";
        }
      });
      setLicenseClassMap(classMap);
    } catch (error) {
      alert("Lỗi tải danh sách dân cư: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      full_name: "",
      citizen_id: "",
      phone_number: "",
      address: "",
      date_of_birth: "",
    });
    setShowForm(true);
  };

  const handleEditClick = (profile) => {
    setEditingId(profile.id);
    setFormData({
      full_name: profile.full_name,
      citizen_id: profile.citizen_id,
      phone_number: profile.phone_number,
      address: profile.address || "",
      date_of_birth: profile.date_of_birth || "",
    });
    setShowForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Update mode: only send changed fields
        const updateData = {};
        const originalProfile = profiles.find((p) => p.id === editingId);
        if (formData.full_name !== originalProfile.full_name)
          updateData.full_name = formData.full_name;
        if (formData.phone_number !== originalProfile.phone_number)
          updateData.phone_number = formData.phone_number;
        if (formData.address !== originalProfile.address)
          updateData.address = formData.address;
        if (formData.date_of_birth !== originalProfile.date_of_birth)
          updateData.date_of_birth = formData.date_of_birth;

        await updateProfile(editingId, updateData);
        alert("Cập nhật hồ sơ thành công!");
      } else {
        // Create mode
        await createProfile(formData);
        alert("Thêm hồ sơ thành công!");
      }
      setShowForm(false);
      await loadProfiles();
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa hồ sơ này?")) {
      try {
        await deleteProfile(id);
        alert("Xóa hồ sơ thành công!");
        await loadProfiles();
      } catch (error) {
        alert("Lỗi xóa: " + error.message);
      }
    }
  };

  const handleViewDetails = async (profile, type, targetId = null) => {
    setSelectedProfile(profile);
    setModalType(type);
    setDetailItems([]);
    setDetailLoading(true);
    setShowModal(true);

    try {
      if (type === "license") {
        const response = await listDriverLicenses();
        const ids = new Set(profile.driver_licenses || []);
        const matched = (response.items || []).filter((item) => ids.has(item.id));
        const picked = targetId ? matched.filter((item) => item.id === targetId) : matched;
        setDetailItems(picked);
      } else {
        const response = await listVehicles();
        const ids = new Set(profile.vehicles || []);
        const matched = (response.items || []).filter((item) => ids.has(item.id));
        const picked = targetId ? matched.filter((item) => item.id === targetId) : matched;
        setDetailItems(picked);
      }
    } catch (error) {
      alert("Lỗi tải chi tiết: " + error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderDetailButtons = (profile, type, ids, labelResolver, title) => {
    return ids.map((id, index) => (
      <React.Fragment key={id}>
        <button
          onClick={() => handleViewDetails(profile, type, id)}
          className="link-btn"
          title={title}
        >
          {labelResolver(id)}
        </button>
        {index < ids.length - 1 ? <span>, </span> : null}
      </React.Fragment>
    ));
  };

  const renderLicenseOrVehicleCell = (profile, type) => {
    const items = type === "license" ? profile.driver_licenses : profile.vehicles;
    if (!items || items.length === 0) {
      return <span style={{ color: "#999" }}>Chưa có</span>;
    }

    if (type === "license") {
      return renderDetailButtons(
        profile,
        type,
        items,
        (id) => licenseClassMap[id] || id,
        "Xem chi tiết bằng lái"
      );
    }

    if (type === "vehicle") {
      return renderDetailButtons(
        profile,
        type,
        items,
        (id) => vehiclePlateMap[id] || id,
        "Xem chi tiết phương tiện"
      );
    }

    return (
      <button
        onClick={() => handleViewDetails(profile, type)}
        className="link-btn"
      >
        {items.length} {type === "license" ? "giấy phép" : "xe"}
      </button>
    );
  };

  return (
    <div className="management-page">
      <div className="page-header">
        <h1>Quản Lí Thông Tin Dân Cư</h1>
        <button onClick={handleAddClick} className="btn-primary">
          + Thêm Dân Cư
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
                <th>Họ Tên</th>
                <th>CCCD</th>
                <th>Số Điện Thoại</th>
                <th>Địa Chỉ</th>
                <th>Ngày Sinh</th>
                <th>Bằng Lái Xe</th>
                <th>Phương Tiện</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.full_name}</td>
                  <td>{profile.citizen_id}</td>
                  <td>{profile.phone_number}</td>
                  <td>{profile.address || "-"}</td>
                  <td>{profile.date_of_birth || "-"}</td>
                  <td>{renderLicenseOrVehicleCell(profile, "license")}</td>
                  <td>{renderLicenseOrVehicleCell(profile, "vehicle")}</td>
                  <td className="action-buttons">
                    <button
                      onClick={() => handleEditClick(profile)}
                      className="btn-edit"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteClick(profile.id)}
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
              <h2>{editingId ? "Chỉnh Sửa Hồ Sơ" : "Thêm Hồ Sơ Mới"}</h2>
              <button
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label>Họ Tên *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>CCCD *</label>
                <input
                  type="text"
                  name="citizen_id"
                  value={formData.citizen_id}
                  onChange={handleInputChange}
                  disabled={!!editingId}
                  required
                />
              </div>
              <div className="form-group">
                <label>Số Điện Thoại *</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Địa Chỉ</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Ngày Sinh</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
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

      {/* Detail Modal - Driver License or Vehicle */}
      {showModal && selectedProfile && (
        <ProfileDetailsModal
          profile={selectedProfile}
          type={modalType}
          items={detailItems}
          loading={detailLoading}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// Component to show details as card (like license/registration certificate)
const ProfileDetailsModal = ({ profile, type, items, loading, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {type === "license" ? "Thông Tin Bằng Lái Xe" : "Thông Tin Phương Tiện"}
          </h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="details-card">
          {loading ? <div className="loading">Đang tải chi tiết...</div> : null}
          {!loading && (!items || items.length === 0) ? (
            <div className="loading">Không có dữ liệu chi tiết.</div>
          ) : null}
          {!loading && type === "license"
            ? (items || []).map((item) => <LicenseCard key={item.id} item={item} profile={profile} />)
            : null}
          {!loading && type === "vehicle"
            ? (items || []).map((item) => <VehicleCard key={item.id} item={item} profile={profile} />)
            : null}
        </div>
      </div>
    </div>
  );
};

const LicenseCard = ({ item, profile }) => (
  <div className="license-cert-card">
    <div className="license-cert-head">
      <div className="license-cert-title">Giấy phép lái xe</div>
      <div className="license-cert-no">Số GPLX: {item.license_number || "-"}</div>
    </div>
    <div className="license-cert-body">
      <div className="license-badge">Hạng {item.license_class || "-"}</div>
      <div className="license-row">
        <span className="label">Họ tên:</span>
        <span className="value">{profile.full_name || "-"}</span>
      </div>
      <div className="license-row">
        <span className="label">CCCD:</span>
        <span className="value">{profile.citizen_id || "-"}</span>
      </div>
      <div className="license-row">
        <span className="label">Ngày sinh:</span>
        <span className="value">{profile.date_of_birth || "-"}</span>
      </div>
      <div className="license-row">
        <span className="label">Ngày cấp:</span>
        <span className="value">{item.issued_date || "-"}</span>
      </div>
      <div className="license-row">
        <span className="label">Hết hạn:</span>
        <span className="value">{item.expiry_date || "Không thời hạn"}</span>
      </div>
      <div className="license-row">
        <span className="label">Nơi cấp:</span>
        <span className="value">{item.issuing_authority || "-"}</span>
      </div>
      <div className="license-row">
        <span className="label">Điểm còn lại:</span>
        <span className="value">{item.points ?? "-"}</span>
      </div>
    </div>
  </div>
);

const VehicleCard = ({ item, profile }) => (
  <div className="vehicle-cert-card">
    <div className="vehicle-cert-head">Thông tin phương tiện</div>
    <div className="vehicle-cert-body">
      <div className="vehicle-cert-plate">{item.license_plate || "-"}</div>
      <div className="vehicle-cert-verified">Đã xác minh</div>

      <div className="vehicle-cert-grid">
        <div className="vehicle-col">
          <div className="vehicle-item">
            <span className="label">Số giấy đăng ký</span>
            <span className="value">{profile.citizen_id || "-"}</span>
          </div>
          <div className="vehicle-item">
            <span className="label">Ngày đăng ký</span>
            <span className="value">{item.registration_date || "-"}</span>
          </div>
          <div className="vehicle-item">
            <span className="label">Loại phương tiện</span>
            <span className="value">{item.vehicle_type || "-"}</span>
          </div>
          <div className="vehicle-item">
            <span className="label">Hãng xe</span>
            <span className="value">{item.brand || "-"}</span>
          </div>
        </div>

        <div className="vehicle-col">
          <div className="vehicle-item">
            <span className="label">Số khung</span>
            <span className="value">{item.frame_number || "-"}</span>
          </div>
          <div className="vehicle-item">
            <span className="label">Số máy</span>
            <span className="value">{item.engine_number || "-"}</span>
          </div>
          <div className="vehicle-item">
            <span className="label">Cơ quan cấp</span>
            <span className="value">{item.issuing_authority || "-"}</span>
          </div>
          <div className="vehicle-item">
            <span className="label">Chủ xe</span>
            <span className="value">{profile.full_name || "-"}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ProfilesManagementPage;
