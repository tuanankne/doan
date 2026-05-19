import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import ViolationsTable from "../components/ViolationsTable";
import { supabase } from "../../../shared/lib/supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const VIOLATIONS_ENDPOINT = `${normalizeApiBaseUrl(API_BASE_URL)}/api/v1/violations`;
const VIOLATIONS_TABLE = import.meta.env.VITE_SUPABASE_VIOLATIONS_TABLE || "violations";

function normalizeApiBaseUrl(baseUrl) {
  const value = (baseUrl || "").trim().replace(/\/+$/, "");
  return value.replace(/\/api\/v1$/, "");
}

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

function isValidDateValue(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function toDayKey(value) {
  const date = new Date(value);
  if (!isValidDateValue(date)) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(value) {
  const date = new Date(value);
  if (!isValidDateValue(date)) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getRecentDayKeys(totalDays = 7) {
  const keys = [];
  const today = new Date();

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    keys.push(`${year}-${month}-${day}`);
  }

  return keys;
}

function getRecentMonthKeys(totalMonths = 12) {
  const keys = [];
  const today = new Date();

  for (let index = totalMonths - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    keys.push(`${year}-${month}`);
  }

  return keys;
}

function formatDayLabel(dayKey) {
  if (!dayKey) {
    return "-";
  }

  const [year, month, day] = dayKey.split("-");
  return `${day}/${month}`;
}

function formatMonthLabel(monthKey) {
  if (!monthKey) {
    return "-";
  }

  const [year, month] = monthKey.split("-");
  return `${month}/${year.slice(2)}`;
}

function getViolationLabel(code) {
  if (!code) {
    return "Khác";
  }

  if (code === "VUOT_DEN_DO") {
    return "Vượt đèn đỏ";
  }

  if (code === "NGUOC_CHIEU") {
    return "Ngược chiều";
  }

  return code
    .toString()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="section-card chart-card">
      <div className="section-head chart-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p className="chart-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function BarChart({ data, height = 220, color = "var(--primary)" }) {
  const width = 100;
  const maxValue = Math.max(1, ...data.map((item) => item.value));
  const viewBox = `0 0 ${width} ${height}`;
  const chartHeight = height - 28;
  const chartWidth = width - 8;
  const gap = 3;
  const barWidth = data.length > 0 ? (chartWidth - gap * (data.length - 1)) / data.length : chartWidth;

  return (
    <svg className="chart-svg" viewBox={viewBox} preserveAspectRatio="none" aria-label="Biểu đồ cột">
      <line x1="2" y1={chartHeight} x2={width - 2} y2={chartHeight} className="chart-axis" />

      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * (chartHeight - 16);
        const x = 4 + index * (barWidth + gap);
        const y = chartHeight - barHeight;

        return (
          <g key={item.label}>
            <rect x={x} y={y} width={barWidth} height={Math.max(2, barHeight)} rx="2" fill={color} />
            <text x={x + barWidth / 2} y={y - 2} textAnchor="middle" className="chart-value-text">
              {item.value}
            </text>
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" className="chart-label-text">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments, total }) {
  const size = 180;
  const center = size / 2;
  const radius = 56;
  const strokeWidth = 20;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(207, 227, 211, 0.75)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {segments.map((segment) => {
          const dash = (segment.value / Math.max(1, total)) * circumference;
          const circle = (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>

      <div className="donut-center">
        <div className="donut-total">{total}</div>
        <div className="donut-label">Tổng vi phạm</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(VIOLATIONS_ENDPOINT, { timeout: 60 * 1000 });
      setViolations(response.data?.items || []);
    } catch (loadError) {
      if (axios.isAxiosError(loadError)) {
        setError(loadError.response?.data?.detail || loadError.message || "Không thể tải dữ liệu vi phạm.");
      } else {
        setError(loadError.message || "Không thể tải dữ liệu vi phạm.");
      }
      setViolations([]);
    } finally {
      setLoading(false);
    }
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
    const pendingCount = enrichedViolations.filter((item) => {
      const status = (item?.status || "").toLowerCase();
      return status.includes("pending") || status.includes("cho") || status.includes("wait");
    }).length;
    const doneCount = enrichedViolations.filter((item) => {
      const status = (item?.status || "").toLowerCase();
      return status.includes("done") || status.includes("hoan") || status.includes("xu ly");
    }).length;
    const totalFine = enrichedViolations.reduce(
      (sum, item) => sum + Number(item.fine_amount_snapshot || 0),
      0
    );

    return {
      total: enrichedViolations.length,
      pendingCount,
      doneCount,
      totalFine,
    };
  }, [enrichedViolations]);

  const charts = useMemo(() => {
    const dailyKeys = getRecentDayKeys(7);
    const monthlyKeys = getRecentMonthKeys(12);
    const dailyBuckets = new Map();
    const monthlyBuckets = new Map();
    const typeBuckets = new Map();

    for (const violation of enrichedViolations) {
      const dayKey = toDayKey(violation.detected_at);
      const monthKey = toMonthKey(violation.detected_at);
      const code = violation.violation_code || getViolationCode(violation) || "OTHER";

      if (dayKey) {
        dailyBuckets.set(dayKey, (dailyBuckets.get(dayKey) || 0) + 1);
      }

      if (monthKey) {
        monthlyBuckets.set(monthKey, (monthlyBuckets.get(monthKey) || 0) + 1);
      }

      typeBuckets.set(code, (typeBuckets.get(code) || 0) + 1);
    }

    const dailyData = dailyKeys.map((key) => ({
      label: formatDayLabel(key),
      value: dailyBuckets.get(key) || 0,
    }));

    const monthlyData = monthlyKeys.map((key) => ({
      label: formatMonthLabel(key),
      value: monthlyBuckets.get(key) || 0,
    }));

    const typeData = Array.from(typeBuckets.entries())
      .map(([code, value]) => ({
        code,
        label: getViolationLabel(code),
        value,
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);

    const typeTotal = typeData.reduce((sum, item) => sum + item.value, 0);

    return {
      dailyData,
      monthlyData,
      typeData,
      typeTotal,
    };
  }, [enrichedViolations]);

  const chartPalette = ["#2f9e44", "#1f7a32", "#40c057", "#74c69d", "#95d5b2"];

  return (
    <div>
      <header className="page-heading">
        <div>
          <h1>Bảng điều khiển phạt nguội</h1>
          <p className="subtitle">Giám sát và quản lý dữ liệu vi phạm giao thông theo thời gian thực.</p>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard title="Tổng số lỗi" value={stats.total} />
        <StatCard title="Chờ xử lý" value={stats.pendingCount} />
        <StatCard title="Đã xử lý" value={stats.doneCount} />
        <StatCard title="Tổng tiền" value={formatMoney(stats.totalFine)} />
      </section>

      <section className="analytics-grid">
        <ChartCard title="Thống kê số vi phạm theo ngày" subtitle="7 ngày gần nhất dựa trên thời gian phát hiện">
          <BarChart data={charts.dailyData} height={220} color="var(--primary)" />
        </ChartCard>

        <ChartCard title="Thống kê số vi phạm theo tháng" subtitle="12 tháng gần nhất để theo dõi xu hướng tổng quan">
          <BarChart data={charts.monthlyData} height={220} color="var(--warning)" />
        </ChartCard>

        <ChartCard title="Tỷ lệ vi phạm theo loại" subtitle="Phân bố các nhóm lỗi chính trong dữ liệu hiện có">
          <div className="type-chart-layout">
            <DonutChart
              segments={charts.typeData.map((item, index) => ({
                ...item,
                color: chartPalette[index % chartPalette.length],
              }))}
              total={charts.typeTotal}
            />

            <div className="type-legend">
              {charts.typeData.length === 0 ? (
                <div className="hint">Chưa có dữ liệu để thống kê.</div>
              ) : (
                charts.typeData.map((item, index) => {
                  const color = chartPalette[index % chartPalette.length];
                  const percent = charts.typeTotal > 0 ? Math.round((item.value / charts.typeTotal) * 100) : 0;

                  return (
                    <div key={item.code} className="type-legend-item">
                      <span className="type-color-dot" style={{ backgroundColor: color }} />
                      <div className="type-legend-content">
                        <div className="type-legend-title">{item.label}</div>
                        <div className="type-legend-subtitle">{item.value} vi phạm - {percent}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ChartCard>
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
