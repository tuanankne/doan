import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";
import ViolationsTable from "../components/ViolationsTable";

const VIOLATIONS_TABLE = import.meta.env.VITE_SUPABASE_VIOLATIONS_TABLE || "violations";

export default function DashboardPage() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadViolations = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from(VIOLATIONS_TABLE)
      .select("id, vehicle_id, detected_license_plate, violation_type, evidence_image_url, evidence_plate_url, detected_at, status")
      .order("detected_at", { ascending: false })
      .limit(200);

    if (queryError) {
      setError(queryError.message);
      setViolations([]);
      setLoading(false);
      return;
    }

    setViolations(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadViolations();
  }, [loadViolations]);

  useEffect(() => {
    const channel = supabase
      .channel("violations-realtime-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: VIOLATIONS_TABLE },
        () => {
          loadViolations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadViolations]);

  const stats = useMemo(() => {
    const redLight = violations.filter(
      (item) => item.violation_type === "Vượt đèn đỏ" || item.violation_type === "Vuot den do"
    ).length;
    const wrongWay = violations.filter(
      (item) => item.violation_type === "Ngược chiều" || item.violation_type === "Nguoc chieu"
    ).length;

    return {
      total: violations.length,
      redLight,
      wrongWay,
    };
  }, [violations]);

  return (
    <div>
      <header className="page-heading">
        <div>
          <h1>Dashboard phat nguoi</h1>
          <p className="subtitle">Giám sát và quản lý dữ liệu vi phạm giao thông theo thời gian thực.</p>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard title="Tong vi pham" value={stats.total} />
        <StatCard title="Vuot den do" value={stats.redLight} />
        <StatCard title="Di nguoc chieu" value={stats.wrongWay} />
      </section>

      <ViolationsTable
        violations={violations}
        loading={loading}
        error={error}
        onRefresh={loadViolations}
      />
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
