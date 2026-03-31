import React from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import VideoConfig from "./components/VideoConfig";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              Traffic <span>AI Monitor</span>
            </div>
            <nav className="topbar-nav">
              <NavLink to="/" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Dashboard
              </NavLink>
              <NavLink to="/config" className={({ isActive }) => (isActive ? "nav-pill active" : "nav-pill")}>
                Cấu hình video
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="page-shell">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/config" element={<VideoConfig />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
