import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import ViolationsTable from "../components/ViolationsTable";
import { supabase } from "../../../shared/lib/supabaseClient";

const VIOLATIONS_TABLE = import.meta.env.VITE_SUPABASE_VIOLATIONS_TABLE || "violations";

function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function getViolationCode(item) {
  const code = normalizeText(item?.violation_code || "");
  if (code) {
    return code;
  }

  const typeCode = normalizeText(item?.violation_type || "");
  if (typeCode === "VUOT_DEN_DO" || typeCode === "VƯỢT_ĐÈN_ĐỎ" || typeCode === "RED_LIGHT") {
    return "VUOT_DEN_DO";
  }
  if (typeCode === "NGUOC_CHIEU" || typeCode === "NGƯỢC_CHIỀU" || typeCode === "WRONG_WAY") {
    return "NGUOC_CHIEU";
  }
  return typeCode;
}

export default function DashboardPage() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: violationsError } = await supabase
      .from(VIOLATIONS_TABLE)
      .select(
        "id, vehicle_id, detected_license_plate, violation_code, violation_type, evidence_image_url, evidence_plate_url, detected_at, status, fine_amount_snapshot"
      )
      .order("detected_at", { ascending: false })
      .limit(200);

    if (violationsError) {
      setError(violationsError.message);
      setViolations([]);
      setLoading(false);
      return;
    }

    setViolations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const channel = supabase
      .channel("violations-realtime-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: VIOLATIONS_TABLE },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  const enrichedViolations = useMemo(() => {
    return violations.map((item) => {
      const violationCode = getViolationCode(item);

      return {
        ...item,
        violation_code: violationCode,
        fine_amount_snapshot: item?.fine_amount_snapshot ?? null,
      };
    });
  }, [violations]);

  const stats = useMemo(() => {
    const redLight = enrichedViolations.filter(
      (item) => item.violation_type === "Vượt đèn đỏ" || item.violation_type === "Vuot den do"
    ).length;
    const wrongWay = enrichedViolations.filter(
      (item) => item.violation_type === "Ngược chiều" || item.violation_type === "Nguoc chieu"
    ).length;
    const totalFine = enrichedViolations.reduce(
      (sum, item) => sum + Number(item.fine_amount_snapshot || 0),
      0
    );

    return {
      total: enrichedViolations.length,
      redLight,
      wrongWay,
      totalFine,
    };
  }, [enrichedViolations]);

  return (
    <div>
      <header className="page-heading">
        <div>
          <h1>Bảng điều khiển phạt nguội</h1>
          <p className="subtitle">Giám sát và quản lý dữ liệu vi phạm giao thông theo thời gian thực.</p>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard title="Tổng vi phạm" value={stats.total} />
        <StatCard title="Vượt đèn đỏ" value={stats.redLight} />
        <StatCard title="Đi ngược chiều" value={stats.wrongWay} />
        <StatCard title="Tổng tiền phạt ước tính" value={formatMoney(stats.totalFine)} />
      </section>

      <section className="section-card admin-shortcuts">
        <div className="section-head">
          <h3>Quản trị dữ liệu</h3>
        </div>
        <div className="shortcut-grid">
          <NavLink to="/admin/profiles" className="shortcut-card">
            <div className="shortcut-title">Quản lý dân cư</div>
            <div className="shortcut-desc">Xem, thêm, sửa, xóa hồ sơ dân cư.</div>
          </NavLink>
          <NavLink to="/admin/vehicles" className="shortcut-card">
            <div className="shortcut-title">Quản lý phương tiện</div>
            <div className="shortcut-desc">Thêm và cập nhật thông tin xe theo CCCD.</div>
          </NavLink>
          <NavLink to="/admin/licenses" className="shortcut-card">
            <div className="shortcut-title">Quản lý bằng lái</div>
            <div className="shortcut-desc">Theo dõi bằng lái, hạng và điểm còn lại.</div>
          </NavLink>
        </div>
      </section>

      <ViolationsTable
        violations={enrichedViolations}
        loading={loading}
        error={error}
        onRefresh={loadDashboardData}
      />
    </div>
  );
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("vi-VN")} ₫`;
}

function StatCard({ title, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
