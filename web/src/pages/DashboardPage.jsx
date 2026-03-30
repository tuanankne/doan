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
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 20, fontFamily: "Segoe UI, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>Dashboard Phat nguoi</h1>
          <p style={{ margin: 0, color: "#4b5563" }}>Giam sat va quan ly du lieu vi pham giao thong tu AI.</p>
        </div>
      </header>

      <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
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
    <div
      style={{
        padding: 14,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280" }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}
