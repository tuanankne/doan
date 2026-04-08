import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
import FineManagementPage from "../features/fine-management/pages/FineManagementPage";
import VideoConfig from "../features/video-config/components/VideoConfig";

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
            </nav>
          </div>
        </header>

        <main className="page-shell">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/config" element={<VideoConfig />} />
            <Route path="/fines" element={<FineManagementPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
