import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
import FineManagementPage from "../features/fine-management/pages/FineManagementPage";
import VideoConfig from "../features/video-config/components/VideoConfig";
import ProfilesManagementPage from '../features/admin/pages/ProfilesManagementPage';
import VehiclesManagementPage from '../features/admin/pages/VehiclesManagementPage';
import DriverLicensesManagementPage from '../features/admin/pages/DriverLicensesManagementPage';
export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              Giám sát <span>AI giao thông</span>
            </div>
            <nav className="topbar-nav">
              <NavLink to="/" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Bảng điều khiển
              </NavLink>
              <NavLink to="/config" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Cấu hình video
              </NavLink>
              <NavLink to="/fines" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Quản lý mức phạt
              </NavLink>
              <NavLink to="/admin/profiles" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Quản lý dân cư
              </NavLink>
              <NavLink to="/admin/vehicles" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Quản lý phương tiện
              </NavLink>
              <NavLink to="/admin/licenses" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Quản lý bằng lái
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="page-shell">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/config" element={<VideoConfig />} />
            <Route path="/fines" element={<FineManagementPage />} />
            <Route path="/admin/profiles" element={<ProfilesManagementPage />} />
            <Route path="/admin/vehicles" element={<VehiclesManagementPage />} />
            <Route path="/admin/licenses" element={<DriverLicensesManagementPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
