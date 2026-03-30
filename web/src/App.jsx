import React from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import VideoConfig from "./components/VideoConfig";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <nav
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 20px",
            borderBottom: "1px solid #e5e7eb",
            background: "#ffffff",
          }}
        >
          <Link to="/" style={linkStyle}>
            Dashboard
          </Link>
          <Link to="/config" style={linkStyle}>
            Cau hinh video
          </Link>
        </nav>

        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/config" element={<VideoConfig />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

const linkStyle = {
  textDecoration: "none",
  color: "#111827",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
};
