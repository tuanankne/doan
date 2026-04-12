import { useEffect, useMemo, useRef, useState } from "react";
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

function normalizeApiBaseUrl(baseUrl) {
  const value = (baseUrl || "").trim().replace(/\/+$/, "");
  return value.replace(/\/api\/v1$/, "");
}

export default function VideoConfig({
  apiBaseUrl = "http://localhost:8000",
  processEndpoint = "/api/v1/process-video",
  confirmEndpoint = "/api/v1/confirm-violations",
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
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
  const [isConfirming, setIsConfirming] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resultSummary, setResultSummary] = useState(null);
  const [editableViolations, setEditableViolations] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(null);

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

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    const timer = window.setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev >= 92) {
          return prev;
        }
        const step = prev < 40 ? 5 : 2;
        return Math.min(92, prev + step);
      });
    }, 350);

    return () => {
      window.clearInterval(timer);
    };
  }, [isSubmitting]);

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
    setResultSummary(null);
    setEditableViolations([]);
    setSuccessMessage("");
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
    setResultSummary(null);
    setEditableViolations([]);
    setSuccessMessage("");
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
    setProcessingProgress(5);
    setErrorMessage("");
    setSuccessMessage("");
    setResultSummary(null);
    setEditableViolations([]);

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

      const url = `${normalizedApiBaseUrl}${processEndpoint}`;
      const response = await axios.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30 * 60 * 1000,
      });

      const violations = response.data?.violations || [];
      setEditableViolations(
        violations.map((item) => ({
          ...item,
          detected_license_plate: item.detected_license_plate || "",
          vehicle_type: item.vehicle_type || "Không xác định",
          owner_citizen_id: item.owner_citizen_id || "",
          owner_full_name: item.owner_full_name || "",
          owner_phone_number: item.owner_phone_number || "",
          owner_address: item.owner_address || "",
        }))
      );
      setResultSummary({ total_violations: response.data?.total_violations || violations.length });
      setProcessingProgress(100);
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

  const handlePlateChange = (index, value) => {
    setEditableViolations((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              detected_license_plate: value,
            }
          : item
      )
    );
  };

  const handleRemoveViolation = (index) => {
    setEditableViolations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const openOwnerModal = (item) => {
    setSelectedOwner(item);
  };

  const closeOwnerModal = () => {
    setSelectedOwner(null);
  };

  const confirmSaveToSupabase = async () => {
    if (!editableViolations.length || isConfirming) {
      return;
    }

    setIsConfirming(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const url = `${normalizedApiBaseUrl}${confirmEndpoint}`;
      const response = await axios.post(
        url,
        {
          violations: editableViolations,
        },
        { timeout: 5 * 60 * 1000 }
      );

      const savedCount = response.data?.saved_count ?? 0;
      setSuccessMessage(`Đã xác nhận và lưu ${savedCount} vi phạm vào hệ thống.`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.detail ||
          error.message ||
          "Không thể lưu dữ liệu xác nhận vào backend.";
        setErrorMessage(message);
      } else {
        setErrorMessage(error.message || "Có lỗi không xác định khi lưu xác nhận.");
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("vi-VN");
  };

  return (
    <div>
      <header className="page-heading">
        <div>
          <h2>Cấu hình video và tải lên</h2>
          <p className="subtitle">Chọn video, vẽ vạch dừng và vector hướng đường rồi gửi về máy chủ AI để xử lý.</p>
        </div>
      </header>

      <section className="section-card">
        <div className="video-tools">
          <div className="field">
            <span className="field-title">Tệp video</span>
            <input type="file" accept="video/*" onChange={handleVideoChange} />
          </div>

          <div className="actions-row">
            <button
              type="button"
              onClick={() => setDrawMode(MODE_STOP_LINE)}
              className={`btn btn-mode ${drawMode === MODE_STOP_LINE ? "active-stop" : ""}`}
            >
              Vẽ vạch dừng
            </button>
            <button
              type="button"
              onClick={() => setDrawMode(MODE_ROAD_DIRECTION)}
              className={`btn btn-mode ${drawMode === MODE_ROAD_DIRECTION ? "active-direction" : ""}`}
            >
              Vẽ vector hướng đường
            </button>
            <button type="button" onClick={clearCurrentMode} className="btn">
              Xóa vạch hiện tại
            </button>
            <button type="button" onClick={clearAll} className="btn btn-danger">
              Xóa tất cả
            </button>
          </div>

          <div className="mode-label">
            Chế độ vẽ hiện tại: <strong>{drawMode === MODE_STOP_LINE ? "Vạch dừng" : "Vector hướng đường"}</strong>
          </div>
        </div>

        {videoUrl ? (
          <div className="stage-scroll">
            <div className="video-stage" style={{ width: stageSize.width, height: stageSize.height }}>
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
                    <Line points={stopLineFlat} stroke="#f08c00" strokeWidth={3} lineCap="round" />
                  ) : null}
                  {roadDirectionPoints.length === 2 ? (
                    <>
                      <Line points={roadDirectionFlat} stroke="#2f9e44" strokeWidth={3} lineCap="round" />
                      <Arrow
                        points={roadDirectionFlat}
                        stroke="#2f9e44"
                        fill="#2f9e44"
                        strokeWidth={3}
                        lineCap="round"
                        pointerLength={10}
                        pointerWidth={10}
                      />
                    </>
                  ) : null}

                  <Text
                    text="Nhấn trực tiếp lên video để đặt điểm"
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
          </div>
        ) : (
          <div className="video-placeholder">Chưa có video. Hãy chọn file để bắt đầu cấu hình.</div>
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="tracker">Bộ bám vết</label>
            <select id="tracker" value={tracker} onChange={(e) => setTracker(e.target.value)}>
              <option value="bytetrack.yaml">ByteTrack</option>
              <option value="botsort.yaml">BoT-SORT</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="confidence">Độ tin cậy</label>
            <input id="confidence" value={confidence} onChange={(e) => setConfidence(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="iou">IoU</label>
            <input id="iou" value={iou} onChange={(e) => setIou(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="trajectory-window">Cửa sổ quỹ đạo</label>
            <input
              id="trajectory-window"
              value={trajectoryWindow}
              onChange={(e) => setTrajectoryWindow(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="wrong-way-angle">Góc ngược chiều</label>
            <input
              id="wrong-way-angle"
              value={wrongWayAngleThreshold}
              onChange={(e) => setWrongWayAngleThreshold(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="min-displacement">Độ dịch chuyển tối thiểu (px)</label>
            <input
              id="min-displacement"
              value={wrongWayMinDisplacementPx}
              onChange={(e) => setWrongWayMinDisplacementPx(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="cooldown-seconds">Thời gian chờ (giây)</label>
            <input
              id="cooldown-seconds"
              value={violationCooldownSeconds}
              onChange={(e) => setViolationCooldownSeconds(e.target.value)}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="red-intervals">Khoảng đèn đỏ (JSON)</label>
          <textarea
            id="red-intervals"
            rows={4}
            value={redIntervalsText}
            onChange={(e) => setRedIntervalsText(e.target.value)}
            placeholder="[[0,12.5],[35,50]]"
          />
        </div>

        <div className="coord-preview">
          <div>Vạch dừng: {JSON.stringify(stopLinePoints.map(normalizePoint))}</div>
          <div>Hướng đường: {JSON.stringify(roadDirectionPoints.map(normalizePoint))}</div>
        </div>

        <div className="submit-row">
          <button
            type="button"
            onClick={submitToBackend}
            disabled={!canSubmit}
            className="btn btn-primary"
          >
            {isSubmitting ? "Đang xử lý..." : "Tải lên và chạy AI"}
          </button>
          {!canSubmit ? (
            <span className="hint" style={{ color: "#a82525" }}>
              Cần có video + đủ 2 điểm cho mỗi vạch.
            </span>
          ) : null}
        </div>

        {isSubmitting ? (
          <div className="processing-progress-wrap">
            <div className="processing-progress-head">
              <strong>Tiến độ xử lý video</strong>
              <span>{processingProgress}%</span>
            </div>
            <div className="processing-progress-track">
              <div
                className="processing-progress-fill"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}

        {successMessage ? <div className="alert alert-success">{successMessage}</div> : null}

        {resultSummary ? (
          <div className="alert alert-success">
            <div style={{ fontWeight: 700 }}>Xử lý thành công</div>
            <div>Tổng vi phạm phát hiện: {resultSummary.total_violations}</div>
            <div style={{ marginTop: 4 }}>
              Hãy kiểm tra và chỉnh sửa biển số (nếu cần), sau đó nhấn xác nhận để lưu vào Supabase.
            </div>
          </div>
        ) : null}

        {editableViolations.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Mã lỗi</th>
                  <th>Loại xe</th>
                  <th>Chủ xe</th>
                  <th>Biển số (có thể sửa)</th>
                  <th>Loại lỗi</th>
                  <th>Ảnh toàn cảnh</th>
                  <th>Ảnh biển số</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {editableViolations.map((item, index) => (
                  <tr key={`${item.detected_at || ""}-${index}`}>
                    <td>{formatDate(item.detected_at)}</td>
                    <td>{item.violation_code || "-"}</td>
                    <td>{item.vehicle_type || "Không xác định"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => openOwnerModal(item)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          textAlign: "left",
                          cursor: "pointer",
                          color: "#1b4d3e",
                        }}
                        title="Xem giấy đăng ký xe"
                      >
                        <div style={{ fontWeight: 600 }}>{item.owner_full_name || "Chưa có"}</div>
                        <div className="hint" style={{ fontSize: 12 }}>
                          {item.owner_citizen_id || ""}
                        </div>
                      </button>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <input
                        value={item.detected_license_plate || ""}
                        onChange={(e) => handlePlateChange(index, e.target.value)}
                        placeholder="Nhập biển số"
                      />
                    </td>
                    <td>{item.violation_type || "-"}</td>
                    <td>
                      {item.evidence_image_url ? (
                        <a href={item.evidence_image_url} target="_blank" rel="noreferrer">
                          <img src={item.evidence_image_url} alt="Toàn cảnh" className="thumb" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {item.evidence_plate_url ? (
                        <a href={item.evidence_plate_url} target="_blank" rel="noreferrer">
                          <img src={item.evidence_plate_url} alt="Biển số" className="thumb" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-danger" onClick={() => handleRemoveViolation(index)}>
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {editableViolations.length > 0 ? (
          <div className="submit-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={confirmSaveToSupabase}
              className="btn btn-primary"
              disabled={isConfirming}
            >
              {isConfirming ? "Đang lưu xác nhận..." : "Xác nhận và lưu vào Supabase"}
            </button>
          </div>
        ) : null}
      </section>

      {selectedOwner ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeOwnerModal}
        >
          <div
            className="section-card"
            style={{ width: "min(680px, 92vw)", maxHeight: "86vh", overflow: "auto" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head">
              <h3>Thông tin giấy đăng ký xe</h3>
              <button type="button" className="btn" onClick={closeOwnerModal}>
                Đóng
              </button>
            </div>
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div><strong>Biển số:</strong> {selectedOwner.detected_license_plate || "-"}</div>
              <div><strong>Loại xe:</strong> {selectedOwner.vehicle_type || "-"}</div>
              <div><strong>Chủ xe:</strong> {selectedOwner.owner_full_name || "-"}</div>
              <div><strong>CCCD:</strong> {selectedOwner.owner_citizen_id || "-"}</div>
              <div><strong>SĐT:</strong> {selectedOwner.owner_phone_number || "-"}</div>
              <div><strong>Địa chỉ:</strong> {selectedOwner.owner_address || "-"}</div>
              <div><strong>Hãng xe:</strong> {selectedOwner.vehicle_brand || "-"}</div>
              <div><strong>Màu xe:</strong> {selectedOwner.vehicle_color || "-"}</div>
              <div><strong>Số khung:</strong> {selectedOwner.vehicle_frame_number || "-"}</div>
              <div><strong>Số máy:</strong> {selectedOwner.vehicle_engine_number || "-"}</div>
              <div><strong>Ngày đăng ký:</strong> {selectedOwner.vehicle_registration_date || "-"}</div>
              <div><strong>Hạn đăng ký:</strong> {selectedOwner.vehicle_registration_expiry_date || "-"}</div>
              <div><strong>Cơ quan cấp:</strong> {selectedOwner.vehicle_issuing_authority || "-"}</div>
              <div><strong>Trạng thái ĐK:</strong> {selectedOwner.vehicle_registration_status || "-"}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
