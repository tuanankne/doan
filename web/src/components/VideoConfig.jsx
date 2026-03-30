import React, { useMemo, useRef, useState } from "react";
import axios from "axios";
import { Arrow, Layer, Line, Stage, Text } from "react-konva";

const MODE_STOP_LINE = "stop_line";
const MODE_ROAD_DIRECTION = "road_direction";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pointDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizePoint(point) {
  return [Number(point.x.toFixed(2)), Number(point.y.toFixed(2))];
}

export default function VideoConfig({
  apiBaseUrl = "http://localhost:8000",
  processEndpoint = "/api/v1/process-video",
}) {
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [stageSize, setStageSize] = useState({ width: 960, height: 540 });

  const [drawMode, setDrawMode] = useState(MODE_STOP_LINE);
  const [stopLinePoints, setStopLinePoints] = useState([]);
  const [roadDirectionPoints, setRoadDirectionPoints] = useState([]);

  const [confidence, setConfidence] = useState("0.35");
  const [iou, setIou] = useState("0.45");
  const [trajectoryWindow, setTrajectoryWindow] = useState("12");
  const [wrongWayAngleThreshold, setWrongWayAngleThreshold] = useState("120");
  const [wrongWayMinDisplacementPx, setWrongWayMinDisplacementPx] = useState("25");
  const [violationCooldownSeconds, setViolationCooldownSeconds] = useState("3");
  const [tracker, setTracker] = useState("bytetrack.yaml");
  const [redIntervalsText, setRedIntervalsText] = useState("[]");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);

  const stopLineFlat = useMemo(
    () => stopLinePoints.flatMap((p) => [p.x, p.y]),
    [stopLinePoints]
  );
  const roadDirectionFlat = useMemo(
    () => roadDirectionPoints.flatMap((p) => [p.x, p.y]),
    [roadDirectionPoints]
  );

  const canSubmit =
    !!videoFile &&
    stopLinePoints.length === 2 &&
    roadDirectionPoints.length === 2 &&
    !isSubmitting;

  const updateStageSizeFromVideo = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const maxWidth = 1000;
    const naturalWidth = video.videoWidth || 1280;
    const naturalHeight = video.videoHeight || 720;
    const scale = Math.min(1, maxWidth / naturalWidth);

    setStageSize({
      width: Math.round(naturalWidth * scale),
      height: Math.round(naturalHeight * scale),
    });
  };

  const handleVideoChange = (event) => {
    const file = event.target.files?.[0] || null;
    setResult(null);
    setErrorMessage("");

    if (!file) {
      setVideoFile(null);
      setVideoUrl("");
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(objectUrl);

    setStopLinePoints([]);
    setRoadDirectionPoints([]);
  };

  const pushPointToCurrentMode = (newPoint) => {
    if (drawMode === MODE_STOP_LINE) {
      setStopLinePoints((prev) => {
        if (prev.length >= 2) {
          return [prev[1], newPoint];
        }
        return [...prev, newPoint];
      });
      return;
    }

    setRoadDirectionPoints((prev) => {
      if (prev.length >= 2) {
        return [prev[1], newPoint];
      }
      return [...prev, newPoint];
    });
  };

  const handleStagePointerDown = (event) => {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) {
      return;
    }

    const boundedPoint = {
      x: Math.max(0, Math.min(stageSize.width, pointer.x)),
      y: Math.max(0, Math.min(stageSize.height, pointer.y)),
    };

    pushPointToCurrentMode(boundedPoint);
  };

  const clearCurrentMode = () => {
    if (drawMode === MODE_STOP_LINE) {
      setStopLinePoints([]);
      return;
    }
    setRoadDirectionPoints([]);
  };

  const clearAll = () => {
    setStopLinePoints([]);
    setRoadDirectionPoints([]);
    setResult(null);
    setErrorMessage("");
  };

  const parseRedIntervals = () => {
    const parsed = JSON.parse(redIntervalsText || "[]");
    if (!Array.isArray(parsed)) {
      throw new Error("red_intervals phải là mảng, ví dụ [[0, 12.5], [30, 45]].");
    }

    return parsed.map((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) {
        throw new Error("Mỗi phần tử red_intervals phải có 2 số [start, end].");
      }
      const start = Number(pair[0]);
      const end = Number(pair[1]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error("Giá trị red_intervals phải là số.");
      }
      return [start, end];
    });
  };

  const submitToBackend = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setResult(null);

    try {
      const redIntervals = parseRedIntervals();

      const stopDistance = pointDistance(stopLinePoints[0], stopLinePoints[1]);
      const directionDistance = pointDistance(roadDirectionPoints[0], roadDirectionPoints[1]);

      if (stopDistance < 5 || directionDistance < 5) {
        throw new Error("Hai điểm của mỗi vạch phải cách nhau đủ xa để tạo vector hợp lệ.");
      }

      const configPayload = {
        stop_line: [normalizePoint(stopLinePoints[0]), normalizePoint(stopLinePoints[1])],
        road_direction: [
          normalizePoint(roadDirectionPoints[0]),
          normalizePoint(roadDirectionPoints[1]),
        ],
        red_intervals: redIntervals,
        tracker,
        confidence: toNumber(confidence, 0.35),
        iou: toNumber(iou, 0.45),
        trajectory_window: Math.max(4, Math.floor(toNumber(trajectoryWindow, 12))),
        wrong_way_angle_threshold: toNumber(wrongWayAngleThreshold, 120),
        wrong_way_min_displacement_px: toNumber(wrongWayMinDisplacementPx, 25),
        violation_cooldown_seconds: toNumber(violationCooldownSeconds, 3),
      };

      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("config", JSON.stringify(configPayload));

      const url = `${apiBaseUrl}${processEndpoint}`;
      const response = await axios.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30 * 60 * 1000,
      });

      setResult(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.detail ||
          error.message ||
          "Không thể gửi dữ liệu đến backend.";
        setErrorMessage(message);
      } else {
        setErrorMessage(error.message || "Có lỗi không xác định.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto", fontFamily: "Segoe UI, sans-serif" }}>
      <h2 style={{ marginBottom: 8 }}>Video Config và Upload</h2>
      <p style={{ marginTop: 0, color: "#4b5563" }}>
        Chọn video, vẽ 2 vạch (vạch dừng và hướng đường), sau đó gửi về FastAPI để xử lý AI.
      </p>

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <label>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Video File</div>
          <input type="file" accept="video/*" onChange={handleVideoChange} />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setDrawMode(MODE_STOP_LINE)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: drawMode === MODE_STOP_LINE ? "#f97316" : "#ffffff",
              color: drawMode === MODE_STOP_LINE ? "#ffffff" : "#111827",
            }}
          >
            Vẽ vạch dừng
          </button>
          <button
            type="button"
            onClick={() => setDrawMode(MODE_ROAD_DIRECTION)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: drawMode === MODE_ROAD_DIRECTION ? "#0284c7" : "#ffffff",
              color: drawMode === MODE_ROAD_DIRECTION ? "#ffffff" : "#111827",
            }}
          >
            Vẽ vector hướng đường
          </button>
          <button
            type="button"
            onClick={clearCurrentMode}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#ffffff" }}
          >
            Xóa vạch hiện tại
          </button>
          <button
            type="button"
            onClick={clearAll}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#ffffff" }}
          >
            Xóa tất cả
          </button>
        </div>

        <div style={{ color: "#374151", fontSize: 14 }}>
          Chế độ vẽ hiện tại: <strong>{drawMode === MODE_STOP_LINE ? "Vạch dừng" : "Vector hướng đường"}</strong>
        </div>
      </div>

      {videoUrl ? (
        <div style={{ position: "relative", width: stageSize.width, height: stageSize.height, border: "1px solid #d1d5db", borderRadius: 12, overflow: "hidden", background: "#111827" }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            style={{ width: stageSize.width, height: stageSize.height, objectFit: "contain", display: "block" }}
            onLoadedMetadata={updateStageSizeFromVideo}
          />

          <Stage
            width={stageSize.width}
            height={stageSize.height}
            onMouseDown={handleStagePointerDown}
            onTouchStart={handleStagePointerDown}
            style={{ position: "absolute", left: 0, top: 0 }}
          >
            <Layer>
              {stopLinePoints.length === 2 ? (
                <Line points={stopLineFlat} stroke="#f97316" strokeWidth={3} lineCap="round" />
              ) : null}
              {roadDirectionPoints.length === 2 ? (
                <>
                  <Line points={roadDirectionFlat} stroke="#0284c7" strokeWidth={3} lineCap="round" />
                  <Arrow
                    points={roadDirectionFlat}
                    stroke="#0284c7"
                    fill="#0284c7"
                    strokeWidth={3}
                    lineCap="round"
                    pointerLength={10}
                    pointerWidth={10}
                  />
                </>
              ) : null}

              <Text
                text="Click trực tiếp lên video để đặt điểm"
                x={12}
                y={12}
                fontSize={16}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth={0.35}
              />
            </Layer>
          </Stage>
        </div>
      ) : (
        <div style={{ padding: 24, border: "1px dashed #9ca3af", borderRadius: 12, color: "#4b5563" }}>
          Chưa có video. Hãy chọn file để bắt đầu cấu hình.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Tracker</div>
          <select value={tracker} onChange={(e) => setTracker(e.target.value)} style={{ width: "100%", padding: 8 }}>
            <option value="bytetrack.yaml">ByteTrack</option>
            <option value="botsort.yaml">BoT-SORT</option>
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Confidence</div>
          <input value={confidence} onChange={(e) => setConfidence(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>IoU</div>
          <input value={iou} onChange={(e) => setIou(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Trajectory Window</div>
          <input value={trajectoryWindow} onChange={(e) => setTrajectoryWindow(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Wrong-way Angle</div>
          <input
            value={wrongWayAngleThreshold}
            onChange={(e) => setWrongWayAngleThreshold(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Min Displacement (px)</div>
          <input
            value={wrongWayMinDisplacementPx}
            onChange={(e) => setWrongWayMinDisplacementPx(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Cooldown (seconds)</div>
          <input
            value={violationCooldownSeconds}
            onChange={(e) => setViolationCooldownSeconds(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Red Intervals JSON</div>
        <textarea
          rows={4}
          value={redIntervalsText}
          onChange={(e) => setRedIntervalsText(e.target.value)}
          style={{ width: "100%", padding: 10, fontFamily: "Consolas, monospace" }}
          placeholder="[[0,12.5],[35,50]]"
        />
      </label>

      <div style={{ marginTop: 12, display: "grid", gap: 6, color: "#111827" }}>
        <div>Stop line: {JSON.stringify(stopLinePoints.map(normalizePoint))}</div>
        <div>Road direction: {JSON.stringify(roadDirectionPoints.map(normalizePoint))}</div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={submitToBackend}
          disabled={!canSubmit}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            background: canSubmit ? "#111827" : "#9ca3af",
            color: "#ffffff",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {isSubmitting ? "Đang xử lý..." : "Upload và chạy AI"}
        </button>
        {!canSubmit ? (
          <span style={{ color: "#b91c1c", fontSize: 14 }}>
            Cần có video + đủ 2 điểm cho mỗi vạch.
          </span>
        ) : null}
      </div>

      {errorMessage ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#ecfeff", color: "#0e7490" }}>
          <div style={{ fontWeight: 700 }}>Xử lý thành công</div>
          <div>Tổng vi phạm: {result.total_violations}</div>
          <pre style={{ overflowX: "auto", marginTop: 8, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result.violations, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
