from __future__ import annotations

import math
import os
import re
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Sequence, Tuple

import cv2
import easyocr
import numpy as np
from storage3.exceptions import StorageApiError
from supabase import Client, create_client
from ultralytics import YOLO

Point = Tuple[float, float]
BBox = Tuple[float, float, float, float]


@dataclass
class ProcessingConfig:
    stop_line: Tuple[Point, Point]
    road_direction: Tuple[Point, Point]
    red_intervals: List[Tuple[float, float]] = field(default_factory=list)
    tracker: str = "bytetrack.yaml"
    confidence: float = 0.35
    iou: float = 0.45
    trajectory_window: int = 12
    wrong_way_angle_threshold: float = 120.0
    wrong_way_min_displacement_px: float = 25.0
    violation_cooldown_seconds: float = 3.0
    one_violation_per_track: bool = True
    duplicate_window_seconds: float = 8.0
    duplicate_center_distance_px: float = 80.0

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "ProcessingConfig":
        stop_line_raw = data["stop_line"]
        road_direction_raw = data["road_direction"]

        stop_line = (
            (float(stop_line_raw[0][0]), float(stop_line_raw[0][1])),
            (float(stop_line_raw[1][0]), float(stop_line_raw[1][1])),
        )
        road_direction = (
            (float(road_direction_raw[0][0]), float(road_direction_raw[0][1])),
            (float(road_direction_raw[1][0]), float(road_direction_raw[1][1])),
        )

        intervals_raw = data.get("red_intervals", [])
        red_intervals = [(float(item[0]), float(item[1])) for item in intervals_raw]

        return ProcessingConfig(
            stop_line=stop_line,
            road_direction=road_direction,
            red_intervals=red_intervals,
            tracker=data.get("tracker", "bytetrack.yaml"),
            confidence=float(data.get("confidence", 0.35)),
            iou=float(data.get("iou", 0.45)),
            trajectory_window=int(data.get("trajectory_window", 12)),
            wrong_way_angle_threshold=float(data.get("wrong_way_angle_threshold", 120.0)),
            wrong_way_min_displacement_px=float(data.get("wrong_way_min_displacement_px", 25.0)),
            violation_cooldown_seconds=float(data.get("violation_cooldown_seconds", 3.0)),
            one_violation_per_track=bool(data.get("one_violation_per_track", True)),
            duplicate_window_seconds=float(data.get("duplicate_window_seconds", 8.0)),
            duplicate_center_distance_px=float(data.get("duplicate_center_distance_px", 80.0)),
        )


class VideoProcessor:
    def __init__(
        self,
        model_path: str,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        storage_bucket: str = "violations",
        violations_table: str = "violations",
        violation_penalties_table: str = "violation_penalties",
        ocr_languages: Optional[Sequence[str]] = None,
        supabase_client: Optional[Client] = None,
    ) -> None:
        model_file = Path(model_path)
        if not model_file.exists():
            raise FileNotFoundError(f"YOLO model not found: {model_path}")

        self.model = YOLO(str(model_file))
        self.plate_detector_model = YOLO(str(self._resolve_plate_detector_model_path()))
        self.plate_reader_model = YOLO(str(self._resolve_plate_reader_model_path()))
        self.vehicle_model = YOLO(str(self._resolve_vehicle_model_path()))
        helmet_model_path = self._resolve_helmet_model_path()
        self.helmet_model = YOLO(str(helmet_model_path)) if helmet_model_path is not None else None
        if supabase_client is not None:
            self.supabase = supabase_client
        else:
            if not supabase_url or not supabase_key:
                raise ValueError("supabase_url and supabase_key are required when supabase_client is not provided")
            self.supabase = create_client(supabase_url, supabase_key)
        self.storage_bucket = storage_bucket
        self.violations_table = violations_table
        self.violation_penalties_table = violation_penalties_table
        self.ocr_languages = list(ocr_languages or ["en"])
        self.ocr_reader = easyocr.Reader(self.ocr_languages, gpu=False)

        self.track_history: Dict[int, Deque[Point]] = defaultdict(deque)
        self.track_prev_side: Dict[int, float] = {}
        self.last_violation_frame: Dict[Tuple[int, str], int] = {}
        self.track_violations_committed: Dict[int, set[str]] = defaultdict(set)
        self.recent_violations: Deque[Dict[str, Any]] = deque(maxlen=500)
        self._penalty_lookup_cache: Optional[Dict[str, Dict[str, Any]]] = None
        self._bucket_ready = False
        self.vehicle_class_ids = self._infer_vehicle_class_ids(self.vehicle_model.names)
        self.plate_class_ids = self._infer_plate_class_ids()
        self.char_class_ids = self._infer_char_class_ids()
        self.no_helmet_class_ids = self._infer_no_helmet_class_ids()
        self.helmet_class_ids = self._infer_helmet_class_ids()
        self.head_class_ids = self._infer_head_class_ids()

    @staticmethod
    def _resolve_vehicle_model_path() -> Path:
        raw_model = os.getenv("VEHICLE_TRACKER_MODEL", "models/yolo11n.pt").strip()
        model_candidate = Path(raw_model)

        if model_candidate.is_absolute() and model_candidate.exists():
            return model_candidate

        server_root = Path(__file__).resolve().parents[2]
        candidates = [
            (server_root / model_candidate).resolve(),
            (server_root.parent / model_candidate).resolve(),
            (server_root / "models" / "yolo11n.pt").resolve(),
        ]

        for candidate in candidates:
            if candidate.exists():
                return candidate

        raise FileNotFoundError(
            "Vehicle tracker model not found. Set VEHICLE_TRACKER_MODEL to an existing file, for example models/yolo11n.pt"
        )

    @staticmethod
    def _resolve_plate_detector_model_path() -> Path:
        raw_model = os.getenv("PLATE_DETECTOR_MODEL", "models/phathienbien.pt").strip()
        model_candidate = Path(raw_model)

        if model_candidate.is_absolute() and model_candidate.exists():
            return model_candidate

        server_root = Path(__file__).resolve().parents[2]
        candidates = [
            (server_root / model_candidate).resolve(),
            (server_root.parent / model_candidate).resolve(),
            (server_root / "models" / "phathienbien.pt").resolve(),
            (server_root / "models" / "ver2.pt").resolve(),
        ]

        for candidate in candidates:
            if candidate.exists():
                return candidate

        raise FileNotFoundError(
            "Plate detector model not found. Set PLATE_DETECTOR_MODEL to an existing file, for example models/phathienbien.pt"
        )

    @staticmethod
    def _resolve_plate_reader_model_path() -> Path:
        raw_model = os.getenv("PLATE_READER_MODEL", "models/docbien.pt").strip()
        model_candidate = Path(raw_model)

        if model_candidate.is_absolute() and model_candidate.exists():
            return model_candidate

        server_root = Path(__file__).resolve().parents[2]
        candidates = [
            (server_root / model_candidate).resolve(),
            (server_root.parent / model_candidate).resolve(),
            (server_root / "models" / "docbien.pt").resolve(),
        ]

        for candidate in candidates:
            if candidate.exists():
                return candidate

        raise FileNotFoundError(
            "Plate reader model not found. Set PLATE_READER_MODEL to an existing file, for example models/docbien.pt"
        )

    @staticmethod
    def _resolve_helmet_model_path() -> Optional[Path]:
        raw_model = os.getenv("HELMET_MODEL_PATH", "models/mubaohiem2.pt").strip()
        if not raw_model:
            return None

        model_candidate = Path(raw_model)

        if model_candidate.is_absolute() and model_candidate.exists():
            return model_candidate

        server_root = Path(__file__).resolve().parents[2]
        candidates = [
            (server_root / model_candidate).resolve(),
            (server_root.parent / model_candidate).resolve(),
            (server_root / "models" / "mubaohiem2.pt").resolve(),
            (server_root / "models" / "mubaohiem.pt").resolve(),
        ]

        for candidate in candidates:
            if candidate.exists():
                return candidate

        # Optional model path: skip no-helmet detection if model is unavailable.
        return None

    @staticmethod
    def _extract_rows(response: Any) -> List[Dict[str, Any]]:
        rows = getattr(response, "data", None)
        if rows is None and isinstance(response, dict):
            rows = response.get("data")
        return rows or []

    def _ensure_storage_bucket(self) -> None:
        if self._bucket_ready:
            return

        buckets_response = self.supabase.storage.list_buckets()
        buckets = self._extract_rows(buckets_response)
        exists = any(
            str(item.get("id", "")) == self.storage_bucket or str(item.get("name", "")) == self.storage_bucket
            for item in buckets
        )

        if not exists:
            try:
                self.supabase.storage.create_bucket(
                    self.storage_bucket,
                    options={
                        "public": True,
                        "file_size_limit": "50MB",
                    },
                )
            except StorageApiError as exc:
                message = str(exc).lower()
                if "already exists" not in message and "duplicate" not in message:
                    raise

        self._bucket_ready = True

    @staticmethod
    def _canonical_plate(plate_text: str) -> str:
        return re.sub(r"[^A-Z0-9]", "", (plate_text or "").upper())

    def _find_vehicle_id(self, plate_text: str) -> Optional[str]:
        canonical = self._canonical_plate(plate_text)
        if not canonical:
            return None

        query = (
            self.supabase.table("vehicles")
            .select("id, license_plate")
            .ilike("license_plate", f"%{canonical}%")
            .limit(20)
            .execute()
        )

        rows = getattr(query, "data", None)
        if rows is None and isinstance(query, dict):
            rows = query.get("data", [])
        rows = rows or []

        for row in rows:
            candidate = self._canonical_plate(str(row.get("license_plate", "")))
            if candidate == canonical:
                return row.get("id")

        return None

    def _infer_vehicle_class_ids(self, names: Any) -> List[int]:
        target_names = {
            "car",
            "truck",
            "bus",
            "motorcycle",
            "motorbike",
            "bicycle",
            "vehicle",
            "van",
        }

        if isinstance(names, dict):
            candidate_ids = [
                int(class_id)
                for class_id, class_name in names.items()
                if str(class_name).strip().lower() in target_names
            ]
        else:
            candidate_ids = [
                idx
                for idx, class_name in enumerate(names)
                if str(class_name).strip().lower() in target_names
            ]

        if candidate_ids:
            return candidate_ids

        if isinstance(names, dict):
            return sorted(int(class_id) for class_id in names.keys())

        return list(range(len(names)))

    def _class_name(self, class_id: int) -> str:
        names = self.plate_reader_model.names
        if isinstance(names, dict):
            return str(names.get(int(class_id), "")).strip()
        if 0 <= int(class_id) < len(names):
            return str(names[int(class_id)]).strip()
        return ""

    def _vehicle_class_name(self, class_id: int) -> str:
        names = self.vehicle_model.names
        if isinstance(names, dict):
            return str(names.get(int(class_id), "")).strip()
        if 0 <= int(class_id) < len(names):
            return str(names[int(class_id)]).strip()
        return ""

    @staticmethod
    def _normalize_vehicle_type_label(label: str) -> str:
        text = str(label or "").strip().lower()
        if any(keyword in text for keyword in ("motorcycle", "motorbike", "scooter", "moped", "xe gan may", "xe_gan_may")):
            return "Xe gắn máy"

        if any(keyword in text for keyword in ("bicycle", "bike", "cycl", "pushbike", "xe tho so", "xe_tho_so")):
            return "Xe thô sơ"

        if any(
            keyword in text
            for keyword in (
                "car",
                "sedan",
                "truck",
                "bus",
                "van",
                "pickup",
                "lorry",
                "auto",
                "vehicle",
                "xe oto",
                "xe_o_to",
            )
        ):
            return "Xe ô tô"

        if not text:
            return "Xe ô tô"

        return "Xe thô sơ"

    def _vehicle_type_from_class_id(self, class_id: Optional[int]) -> str:
        if class_id is None or class_id < 0:
            return "Không xác định"

        class_name = self._vehicle_class_name(class_id)
        return self._normalize_vehicle_type_label(class_name)

    def _infer_plate_class_ids(self) -> List[int]:
        plate_keywords = {
            "plate",
            "license_plate",
            "licence_plate",
            "number_plate",
            "plate_number",
            "bienso",
            "bien_so",
            "bien-so",
        }

        names = self.plate_detector_model.names
        class_ids: List[int] = []
        if isinstance(names, dict):
            iterable = names.items()
        else:
            iterable = enumerate(names)

        for class_id, class_name in iterable:
            normalized = str(class_name).strip().lower().replace(" ", "_")
            if normalized in plate_keywords or "plate" in normalized or "bien" in normalized:
                class_ids.append(int(class_id))

        if class_ids:
            return class_ids

        if isinstance(names, dict):
            return sorted(int(class_id) for class_id in names.keys())

        return list(range(len(names)))

    @staticmethod
    def _center_distance(a: Point, b: Point) -> float:
        dx = a[0] - b[0]
        dy = a[1] - b[1]
        return math.sqrt(dx * dx + dy * dy)

    def _infer_char_class_ids(self) -> List[int]:
        names = self.plate_reader_model.names
        class_ids: List[int] = []
        if isinstance(names, dict):
            iterable = names.items()
        else:
            iterable = enumerate(names)

        for class_id, class_name in iterable:
            normalized = str(class_name).strip().upper()
            if len(normalized) == 1 and normalized.isalnum():
                class_ids.append(int(class_id))
        return class_ids

    def _infer_no_helmet_class_ids(self) -> List[int]:
        if self.helmet_model is None:
            return []

        names = self.helmet_model.names
        if isinstance(names, dict):
            iterable = names.items()
        else:
            iterable = enumerate(names)

        class_ids: List[int] = []
        for class_id, class_name in iterable:
            normalized = str(class_name).strip().lower().replace(" ", "_")
            has_helmet_token = any(
                token in normalized for token in ("helmet", "bao_hiem", "mu_bao_hiem", "doi_mu")
            )
            has_negative_token = any(
                token in normalized for token in ("no", "without", "khong", "non", "not", "none")
            )
            if has_helmet_token and has_negative_token:
                class_ids.append(int(class_id))

        return class_ids

    def _infer_helmet_class_ids(self) -> List[int]:
        if self.helmet_model is None:
            return []

        names = self.helmet_model.names
        if isinstance(names, dict):
            iterable = names.items()
        else:
            iterable = enumerate(names)

        class_ids: List[int] = []
        for class_id, class_name in iterable:
            normalized = str(class_name).strip().lower().replace(" ", "_")
            has_helmet_token = any(token in normalized for token in ("helmet", "bao_hiem", "mu_bao_hiem"))
            has_negative_token = any(token in normalized for token in ("no", "without", "khong", "non", "not"))
            if has_helmet_token and not has_negative_token:
                class_ids.append(int(class_id))

        return class_ids

    def _infer_head_class_ids(self) -> List[int]:
        if self.helmet_model is None:
            return []

        names = self.helmet_model.names
        if isinstance(names, dict):
            iterable = names.items()
        else:
            iterable = enumerate(names)

        class_ids: List[int] = []
        for class_id, class_name in iterable:
            normalized = str(class_name).strip().lower().replace(" ", "_")
            if any(token in normalized for token in ("head", "dau", "nguoi")):
                class_ids.append(int(class_id))

        return class_ids

    @staticmethod
    def _line_side(point: Point, line: Tuple[Point, Point]) -> float:
        (x1, y1), (x2, y2) = line
        px, py = point
        return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)

    @staticmethod
    def _orientation(a: Point, b: Point, c: Point) -> float:
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    @staticmethod
    def _on_segment(a: Point, b: Point, c: Point) -> bool:
        return (
            min(a[0], c[0]) <= b[0] <= max(a[0], c[0])
            and min(a[1], c[1]) <= b[1] <= max(a[1], c[1])
        )

    @classmethod
    def _segments_intersect(cls, p1: Point, p2: Point, q1: Point, q2: Point) -> bool:
        o1 = cls._orientation(p1, p2, q1)
        o2 = cls._orientation(p1, p2, q2)
        o3 = cls._orientation(q1, q2, p1)
        o4 = cls._orientation(q1, q2, p2)

        if o1 == 0 and cls._on_segment(p1, q1, p2):
            return True
        if o2 == 0 and cls._on_segment(p1, q2, p2):
            return True
        if o3 == 0 and cls._on_segment(q1, p1, q2):
            return True
        if o4 == 0 and cls._on_segment(q1, p2, q2):
            return True

        return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0)

    @classmethod
    def _bbox_intersects_line(cls, bbox: BBox, line: Tuple[Point, Point]) -> bool:
        x1, y1, x2, y2 = bbox
        rect = [
            ((x1, y1), (x2, y1)),
            ((x2, y1), (x2, y2)),
            ((x2, y2), (x1, y2)),
            ((x1, y2), (x1, y1)),
        ]

        for edge_start, edge_end in rect:
            if cls._segments_intersect(edge_start, edge_end, line[0], line[1]):
                return True
        return False

    @staticmethod
    def _bbox_center(bbox: BBox) -> Point:
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)

    @staticmethod
    def _bbox_bottom_center(bbox: BBox) -> Point:
        x1, _, x2, y2 = bbox
        return ((x1 + x2) / 2.0, y2)

    @staticmethod
    def _expand_for_rider(bbox: BBox) -> BBox:
        x1, y1, x2, y2 = bbox
        w = max(1.0, x2 - x1)
        h = max(1.0, y2 - y1)
        return (
            x1 - 0.15 * w,
            y1 - 0.90 * h,
            x2 + 0.15 * w,
            y2 + 0.05 * h,
        )

    @staticmethod
    def _angle_between(v1: np.ndarray, v2: np.ndarray) -> float:
        n1 = np.linalg.norm(v1)
        n2 = np.linalg.norm(v2)
        if n1 == 0 or n2 == 0:
            return 0.0
        cos_theta = float(np.dot(v1, v2) / (n1 * n2))
        cos_theta = max(-1.0, min(1.0, cos_theta))
        return math.degrees(math.acos(cos_theta))

    @staticmethod
    def _is_red(second: float, intervals: Sequence[Tuple[float, float]]) -> bool:
        if not intervals:
            return True
        return any(start <= second <= end for start, end in intervals)

    @staticmethod
    def _sanitize_plate_text(raw_text: str) -> str:
        text = raw_text.upper().strip()
        text = re.sub(r"[^A-Z0-9]", "", text)
        return text

    @staticmethod
    def _normalize_violation_code(value: str) -> str:
        text = (value or "").upper().strip()
        text = re.sub(r"[^A-Z0-9]+", "_", text)
        text = re.sub(r"_+", "_", text)
        return text.strip("_")

    def _load_penalty_lookup(self) -> Dict[str, Dict[str, Any]]:
        if self._penalty_lookup_cache is not None:
            return self._penalty_lookup_cache

        lookup: Dict[str, Dict[str, Any]] = {}
        try:
            response = (
                self.supabase.table(self.violation_penalties_table)
                .select("violation_code, violation_name, fine_amount, is_active")
                .execute()
            )
            rows = self._extract_rows(response)
            for row in rows:
                code = self._normalize_violation_code(str(row.get("violation_code", "")))
                if not code:
                    continue
                lookup[code] = row
        except Exception:
            # Fallback to default mapping if violation_penalties table is unavailable.
            lookup = {}

        self._penalty_lookup_cache = lookup
        return lookup

    @classmethod
    def _default_violation_name(cls, violation_type: str, violation_code: str) -> str:
        code = cls._normalize_violation_code(violation_code)
        if code == "VUOT_DEN_DO":
            return "Vượt đèn đỏ"
        if code == "NGUOC_CHIEU":
            return "Ngược chiều"
        if code == "KHONG_DOI_MU_BAO_HIEM":
            return "Không đội mũ bảo hiểm"
        return (violation_type or code).strip() or "Lỗi khác"

    def _violation_meta(
        self,
        violation_type: str,
        violation_code: Optional[str] = None,
    ) -> Tuple[str, str, Optional[int]]:
        code = self._normalize_violation_code(violation_code or "")
        normalized_type = self._normalize_violation_code(violation_type)

        if not code:
            if normalized_type in {"VUOT_DEN_DO", "VƯỢT_ĐÈN_ĐỎ", "RED_LIGHT"}:
                code = "VUOT_DEN_DO"
            elif normalized_type in {"NGUOC_CHIEU", "NGƯỢC_CHIỀU", "WRONG_WAY"}:
                code = "NGUOC_CHIEU"
            elif normalized_type in {"KHONG_DOI_MU_BAO_HIEM", "KHÔNG_ĐỘI_MŨ_BẢO_HIỂM", "NO_HELMET"}:
                code = "KHONG_DOI_MU_BAO_HIEM"
            else:
                code = normalized_type or "KHAC"

        display = self._default_violation_name(violation_type, code)
        fine_amount_snapshot: Optional[int] = None
        penalty = self._load_penalty_lookup().get(code)
        if penalty:
            mapped_name = str(penalty.get("violation_name", "")).strip()
            if mapped_name:
                display = mapped_name

            fine_amount_raw = penalty.get("fine_amount")
            if fine_amount_raw is not None:
                try:
                    fine_amount_snapshot = int(fine_amount_raw)
                except (TypeError, ValueError):
                    fine_amount_snapshot = None

        return code, display, fine_amount_snapshot

    @staticmethod
    def _safe_crop(frame: np.ndarray, bbox: BBox) -> Optional[np.ndarray]:
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = bbox

        x1i = max(0, min(w - 1, int(round(x1))))
        x2i = max(0, min(w, int(round(x2))))
        y1i = max(0, min(h - 1, int(round(y1))))
        y2i = max(0, min(h, int(round(y2))))

        if x2i <= x1i or y2i <= y1i:
            return None

        return frame[y1i:y2i, x1i:x2i].copy()

    @staticmethod
    def _expand_bbox(bbox: BBox, padding: float) -> BBox:
        x1, y1, x2, y2 = bbox
        return (x1 - padding, y1 - padding, x2 + padding, y2 + padding)

    @staticmethod
    def _preprocess_plate_crop(crop: np.ndarray) -> np.ndarray:
        if crop is None or crop.size == 0:
            return crop

        h, w = crop.shape[:2]
        min_height = 80
        if h > 0 and h < min_height:
            scale = min_height / float(h)
            crop = cv2.resize(crop, (int(round(w * scale)), min_height), interpolation=cv2.INTER_CUBIC)

        lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
        l = clahe.apply(l)
        merged = cv2.merge([l, a, b])
        return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

    @staticmethod
    def _bbox_iou(box1: BBox, box2: BBox) -> float:
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])

        inter_w = max(0.0, x2 - x1)
        inter_h = max(0.0, y2 - y1)
        inter_area = inter_w * inter_h
        if inter_area <= 0:
            return 0.0

        area1 = max(0.0, box1[2] - box1[0]) * max(0.0, box1[3] - box1[1])
        area2 = max(0.0, box2[2] - box2[0]) * max(0.0, box2[3] - box2[1])
        denom = area1 + area2 - inter_area
        if denom <= 0:
            return 0.0
        return inter_area / denom

    @staticmethod
    def _point_in_bbox(point: Point, bbox: BBox) -> bool:
        px, py = point
        return bbox[0] <= px <= bbox[2] and bbox[1] <= py <= bbox[3]

    def _find_plate_bbox_for_vehicle(
        self,
        vehicle_bbox: BBox,
        all_bboxes: np.ndarray,
        all_classes: np.ndarray,
        all_scores: np.ndarray,
    ) -> Optional[BBox]:
        if not self.plate_class_ids:
            return None

        candidates: List[Tuple[float, BBox]] = []
        for idx in range(len(all_bboxes)):
            class_id = int(all_classes[idx])
            if class_id not in self.plate_class_ids:
                continue

            plate_bbox: BBox = (
                float(all_bboxes[idx][0]),
                float(all_bboxes[idx][1]),
                float(all_bboxes[idx][2]),
                float(all_bboxes[idx][3]),
            )
            center = self._bbox_center(plate_bbox)
            if not self._point_in_bbox(center, vehicle_bbox):
                continue

            iou_score = self._bbox_iou(vehicle_bbox, plate_bbox)
            conf = float(all_scores[idx])
            candidates.append((conf + iou_score, plate_bbox))

        if not candidates:
            return None

        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]

    def _estimate_plate_bbox_from_vehicle(self, vehicle_bbox: BBox) -> BBox:
        x1, y1, x2, y2 = vehicle_bbox
        w = max(1.0, x2 - x1)
        h = max(1.0, y2 - y1)
        ex1 = x1 + 0.22 * w
        ex2 = x1 + 0.78 * w
        ey1 = y1 + 0.56 * h
        ey2 = y1 + 0.90 * h
        return (ex1, ey1, ex2, ey2)

    def _decode_plate_text_from_model(
        self,
        frame: np.ndarray,
        plate_bbox: Optional[BBox],
    ) -> str:
        if plate_bbox is None or not self.char_class_ids:
            return ""

        plate_crop = self._safe_crop(frame, self._expand_bbox(plate_bbox, padding=6.0))
        if plate_crop is None or plate_crop.size == 0:
            return ""

        plate_crop = self._preprocess_plate_crop(plate_crop)

        results = self.plate_reader_model.predict(
            source=plate_crop,
            conf=0.15,
            iou=0.40,
            imgsz=320,
            max_det=20,
            agnostic_nms=True,
            verbose=False,
        )
        if not results:
            return ""

        boxes = results[0].boxes
        if boxes is None or boxes.xyxy is None or len(boxes) == 0:
            return ""

        xyxy = boxes.xyxy.cpu().numpy()
        classes = boxes.cls.cpu().numpy().astype(int) if boxes.cls is not None else np.zeros(len(xyxy), dtype=np.int32)
        scores = boxes.conf.cpu().numpy() if boxes.conf is not None else np.ones(len(xyxy), dtype=np.float32)

        chars: List[Tuple[float, float, float, str, float]] = []
        for idx in range(len(xyxy)):
            class_id = int(classes[idx])
            if class_id not in self.char_class_ids:
                continue

            char_label = self._class_name(class_id).upper().strip()
            if len(char_label) != 1 or not char_label.isalnum():
                continue

            x_center = float(xyxy[idx][0] + xyxy[idx][2]) / 2.0
            y_center = float(xyxy[idx][1] + xyxy[idx][3]) / 2.0
            height = float(xyxy[idx][3] - xyxy[idx][1])
            chars.append((x_center, y_center, max(1.0, height), char_label, float(scores[idx])))

        if not chars:
            return ""

        if len(chars) <= 2:
            chars.sort(key=lambda item: item[0])
            ordered = chars
        else:
            heights = sorted(item[2] for item in chars)
            median_h = heights[len(heights) // 2]
            line_gap = max(6.0, 0.60 * median_h)

            lines: List[Dict[str, Any]] = []
            for item in sorted(chars, key=lambda v: v[1]):
                assigned = False
                for line in lines:
                    if abs(item[1] - float(line["y"])) <= line_gap:
                        line["items"].append(item)
                        line["y"] = sum(v[1] for v in line["items"]) / len(line["items"])
                        assigned = True
                        break
                if not assigned:
                    lines.append({"y": item[1], "items": [item]})

            if len(lines) <= 1:
                ordered = sorted(chars, key=lambda item: item[0])
            else:
                lines.sort(key=lambda line: float(line["y"]))
                ordered = []
                for line in lines:
                    ordered.extend(sorted(line["items"], key=lambda item: item[0]))

        # Prefer VN two-line number pattern: 4 digits on top line + 5 digits on bottom line.
        if len(ordered) >= 9:
            numeric = [item for item in ordered if item[3].isdigit()]
            if len(numeric) >= 9:
                top4 = numeric[:4]
                bottom5 = numeric[4:9]
                ordered = top4 + bottom5

        plate_text = "".join(ch for _, _, _, ch, _ in ordered)
        return self._sanitize_plate_text(plate_text)

    def _ocr_plate_text(self, plate_img: np.ndarray) -> str:
        if plate_img is None or plate_img.size == 0:
            return ""

        if len(plate_img.shape) == 3:
            gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        else:
            gray = plate_img.copy()

        upscaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        blur = cv2.GaussianBlur(upscaled, (3, 3), 0)
        _, otsu = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        adaptive = cv2.adaptiveThreshold(
            blur,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            31,
            5,
        )

        variants = [gray, upscaled, blur, otsu, adaptive]
        candidates: List[str] = []
        for variant in variants:
            result = self.ocr_reader.readtext(variant, detail=0, paragraph=False)
            for text in result:
                cleaned = self._sanitize_plate_text(str(text))
                if len(cleaned) >= 6:
                    candidates.append(cleaned)

        if not candidates:
            return ""

        candidates.sort(key=len, reverse=True)
        return candidates[0]

    def _detect_plate_boxes(self, frame: np.ndarray, conf: float, iou: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        results = self.plate_detector_model.predict(
            source=frame,
            conf=max(0.15, conf),
            iou=iou,
            imgsz=640,
            verbose=False,
        )
        if not results:
            return np.empty((0, 4)), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)
        boxes = results[0].boxes
        if boxes is None or boxes.xyxy is None or len(boxes) == 0:
            return np.empty((0, 4)), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)
        xyxy = boxes.xyxy.cpu().numpy()
        cls = boxes.cls.cpu().numpy().astype(int) if boxes.cls is not None else np.zeros(len(xyxy), dtype=np.int32)
        confs = boxes.conf.cpu().numpy() if boxes.conf is not None else np.ones(len(xyxy), dtype=np.float32)
        return xyxy, cls, confs

    def _detect_helmet_boxes(self, frame: np.ndarray, conf: float, iou: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        if self.helmet_model is None or not self.no_helmet_class_ids:
            return np.empty((0, 4)), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)

        results = self.helmet_model.predict(source=frame, conf=max(0.20, conf), iou=iou, verbose=False)
        if not results:
            return np.empty((0, 4)), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)

        boxes = results[0].boxes
        if boxes is None or boxes.xyxy is None or len(boxes) == 0:
            return np.empty((0, 4)), np.empty((0,), dtype=np.int32), np.empty((0,), dtype=np.float32)

        xyxy = boxes.xyxy.cpu().numpy()
        cls = boxes.cls.cpu().numpy().astype(int) if boxes.cls is not None else np.zeros(len(xyxy), dtype=np.int32)
        confs = boxes.conf.cpu().numpy() if boxes.conf is not None else np.ones(len(xyxy), dtype=np.float32)
        return xyxy, cls, confs

    def _has_no_helmet_in_vehicle(
        self,
        vehicle_bbox: BBox,
        helmet_bboxes: np.ndarray,
        helmet_classes: np.ndarray,
        helmet_scores: np.ndarray,
    ) -> bool:
        if len(helmet_bboxes) == 0:
            return False

        rider_bbox = self._expand_for_rider(vehicle_bbox)

        # Prefer explicit no-helmet classes if the model provides them.
        for idx in range(len(helmet_bboxes)):
            class_id = int(helmet_classes[idx])
            if class_id not in self.no_helmet_class_ids:
                continue

            if float(helmet_scores[idx]) < 0.15:
                continue

            candidate_bbox: BBox = (
                float(helmet_bboxes[idx][0]),
                float(helmet_bboxes[idx][1]),
                float(helmet_bboxes[idx][2]),
                float(helmet_bboxes[idx][3]),
            )
            center = self._bbox_center(candidate_bbox)
            if self._point_in_bbox(center, rider_bbox):
                return True

        # Fallback for models like: 0=head, 1=helmet, 2=person.
        if not self.head_class_ids or not self.helmet_class_ids:
            return False

        head_bboxes: List[BBox] = []
        helmet_only_bboxes: List[BBox] = []

        for idx in range(len(helmet_bboxes)):
            class_id = int(helmet_classes[idx])
            score = float(helmet_scores[idx])
            if score < 0.15:
                continue

            candidate_bbox: BBox = (
                float(helmet_bboxes[idx][0]),
                float(helmet_bboxes[idx][1]),
                float(helmet_bboxes[idx][2]),
                float(helmet_bboxes[idx][3]),
            )
            center = self._bbox_center(candidate_bbox)
            if not self._point_in_bbox(center, rider_bbox):
                continue

            if class_id in self.head_class_ids:
                head_bboxes.append(candidate_bbox)
            elif class_id in self.helmet_class_ids:
                helmet_only_bboxes.append(candidate_bbox)

        for head_bbox in head_bboxes:
            has_helmet = False
            for helmet_bbox in helmet_only_bboxes:
                helmet_center = self._bbox_center(helmet_bbox)
                if self._point_in_bbox(helmet_center, head_bbox) or self._bbox_iou(head_bbox, helmet_bbox) > 0.10:
                    has_helmet = True
                    break
            if not has_helmet:
                return True

        return False

    def _is_duplicate_violation(
        self,
        track_id: int,
        violation_type: str,
        bbox: BBox,
        plate_text: str,
        frame_idx: int,
        fps: float,
        config: ProcessingConfig,
    ) -> bool:
        if config.one_violation_per_track and violation_type in self.track_violations_committed[track_id]:
            return True

        current_center = self._bbox_center(bbox)
        window_frames = int(config.duplicate_window_seconds * fps)
        canonical_plate = self._canonical_plate(plate_text)

        for item in self.recent_violations:
            if item["violation_type"] != violation_type:
                continue
            if frame_idx - int(item["frame_idx"]) > window_frames:
                continue
            if self._center_distance(current_center, item["center"]) > config.duplicate_center_distance_px:
                continue
            prev_plate = str(item.get("plate_text", ""))
            prev_canonical = self._canonical_plate(prev_plate)
            if canonical_plate and prev_canonical and canonical_plate != prev_canonical:
                continue
            return True

        return False

    def _mark_violation_seen(
        self,
        track_id: int,
        violation_type: str,
        bbox: BBox,
        plate_text: str,
        frame_idx: int,
    ) -> None:
        self.track_violations_committed[track_id].add(violation_type)
        self.recent_violations.append(
            {
                "track_id": track_id,
                "violation_type": violation_type,
                "center": self._bbox_center(bbox),
                "plate_text": plate_text,
                "frame_idx": frame_idx,
            }
        )

    @staticmethod
    def _draw_bbox(frame: np.ndarray, bbox: BBox, color: Tuple[int, int, int], label: str) -> None:
        x1, y1, x2, y2 = [int(round(v)) for v in bbox]
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        if label:
            cv2.putText(
                frame,
                label,
                (x1, max(0, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
                cv2.LINE_AA,
            )

    def _upload_jpeg(self, image: np.ndarray, storage_path: str) -> str:
        self._ensure_storage_bucket()

        ok, encoded = cv2.imencode(".jpg", image)
        if not ok:
            raise RuntimeError("Failed to encode image to JPEG")

        upload_result = self.supabase.storage.from_(self.storage_bucket).upload(
            storage_path,
            encoded.tobytes(),
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )

        if isinstance(upload_result, dict) and upload_result.get("error"):
            raise RuntimeError(f"Supabase upload error: {upload_result['error']}")

        public_url_data = self.supabase.storage.from_(self.storage_bucket).get_public_url(storage_path)
        if isinstance(public_url_data, dict):
            return str(public_url_data.get("publicURL") or public_url_data.get("publicUrl") or "")

        return str(public_url_data)

    def _prepare_violation_record(
        self,
        frame: np.ndarray,
        vehicle_bbox: BBox,
        plate_bbox: Optional[BBox],
        violation_type: str,
        violation_code: str,
        plate_text: str,
        vehicle_type: str,
        event_time: datetime,
    ) -> Dict[str, Any]:
        annotated_frame = frame.copy()
        self._draw_bbox(annotated_frame, vehicle_bbox, (0, 0, 255), "vehicle")

        plate_bbox_to_use = plate_bbox or self._estimate_plate_bbox_from_vehicle(vehicle_bbox)
        self._draw_bbox(
            annotated_frame,
            plate_bbox_to_use,
            (0, 255, 255),
            f"plate:{plate_text or 'UNKNOWN'}",
        )

        vehicle_crop = self._safe_crop(frame, vehicle_bbox)
        if vehicle_crop is None:
            raise RuntimeError("Vehicle crop failed")

        plate_img = self._safe_crop(frame, plate_bbox_to_use)
        if plate_img is None:
            plate_img = vehicle_crop

        if not plate_text:
            plate_text = self._ocr_plate_text(plate_img)

        uid = uuid.uuid4().hex
        snapshot_path = f"{event_time.strftime('%Y/%m/%d')}/{uid}_scene.jpg"
        plate_path = f"{event_time.strftime('%Y/%m/%d')}/{uid}_plate.jpg"

        scene_url = self._upload_jpeg(annotated_frame, snapshot_path)

        plate_url = self._upload_jpeg(plate_img, plate_path)

        record = {
            "detected_license_plate": plate_text or "UNKNOWN",
            "vehicle_type": vehicle_type or "Không xác định",
            "violation_code": violation_code,
            "violation_type": violation_type,
            "evidence_image_url": scene_url,
            "evidence_plate_url": plate_url,
            "detected_at": event_time.isoformat(),
            "status": "pending_confirmation",
        }
        return record

    def save_confirmed_violations(self, violations: Sequence[Dict[str, Any]]) -> int:
        inserted = 0
        for item in violations:
            plate_text = self._sanitize_plate_text(str(item.get("detected_license_plate", "")))
            vehicle_type = self._normalize_vehicle_type_label(str(item.get("vehicle_type", "")))
            raw_violation_type = str(item.get("violation_type", "")).strip()
            raw_violation_code = str(item.get("violation_code", "")).strip()
            violation_code, violation_type, fine_amount_snapshot = self._violation_meta(
                raw_violation_type,
                raw_violation_code,
            )
            evidence_image_url = str(item.get("evidence_image_url", "")).strip()
            evidence_plate_url = str(item.get("evidence_plate_url", "")).strip()
            detected_at = str(item.get("detected_at", "")).strip()

            if not violation_type or not evidence_image_url or not evidence_plate_url:
                continue

            if not detected_at:
                detected_at = datetime.now(timezone.utc).isoformat()

            vehicle_id = self._find_vehicle_id(plate_text)

            record = {
                "vehicle_id": vehicle_id,
                "detected_license_plate": plate_text or "UNKNOWN",
                "vehicle_type": vehicle_type,
                "violation_code": violation_code,
                "violation_type": violation_type,
                "fine_amount_snapshot": fine_amount_snapshot,
                "evidence_image_url": evidence_image_url,
                "evidence_plate_url": evidence_plate_url,
                "detected_at": detected_at,
                "status": "pending",
            }

            try:
                self.supabase.table(self.violations_table).insert(record).execute()
            except Exception:
                # Backward compatibility for old schema where violations has no violation_code column.
                fallback_record = {
                    k: v
                    for k, v in record.items()
                    if k not in {"violation_code", "fine_amount_snapshot"}
                }
                self.supabase.table(self.violations_table).insert(fallback_record).execute()
            inserted += 1

        return inserted

    def process_video(self, video_path: str, config: ProcessingConfig) -> List[Dict[str, Any]]:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30.0

        cooldown_frames = int(config.violation_cooldown_seconds * fps)
        road_vec = np.array(
            [
                config.road_direction[1][0] - config.road_direction[0][0],
                config.road_direction[1][1] - config.road_direction[0][1],
            ],
            dtype=np.float32,
        )

        violations: List[Dict[str, Any]] = []
        frame_idx = -1

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1
                timestamp_sec = frame_idx / fps
                current_time = datetime.now(timezone.utc) + timedelta(seconds=timestamp_sec)

                results = self.vehicle_model.track(
                    source=frame,
                    persist=True,
                    tracker=config.tracker,
                    conf=config.confidence,
                    iou=config.iou,
                    verbose=False,
                    classes=self.vehicle_class_ids,
                )

                if not results:
                    continue

                boxes = results[0].boxes
                if boxes is None or boxes.xyxy is None or len(boxes) == 0:
                    continue

                xyxy = boxes.xyxy.cpu().numpy()
                track_classes = (
                    boxes.cls.cpu().numpy().astype(int)
                    if boxes.cls is not None
                    else np.full(len(xyxy), -1, dtype=np.int32)
                )
                if boxes.id is None:
                    continue
                track_ids = boxes.id.cpu().numpy().astype(int)

                plate_xyxy, plate_classes, plate_confs = self._detect_plate_boxes(frame, config.confidence, config.iou)
                helmet_xyxy, helmet_classes, helmet_confs = self._detect_helmet_boxes(frame, config.confidence, config.iou)

                for i, track_id in enumerate(track_ids):
                    bbox_arr = xyxy[i]
                    bbox: BBox = (
                        float(bbox_arr[0]),
                        float(bbox_arr[1]),
                        float(bbox_arr[2]),
                        float(bbox_arr[3]),
                    )
                    vehicle_class_id = int(track_classes[i]) if i < len(track_classes) else None
                    vehicle_type = self._vehicle_type_from_class_id(vehicle_class_id)

                    center = self._bbox_center(bbox)
                    plate_bbox = self._find_plate_bbox_for_vehicle(bbox, plate_xyxy, plate_classes, plate_confs)
                    plate_text = self._decode_plate_text_from_model(frame, plate_bbox)
                    history = self.track_history[track_id]
                    if history.maxlen != config.trajectory_window:
                        history = deque(history, maxlen=config.trajectory_window)
                        self.track_history[track_id] = history
                    history.append(center)

                    bottom_center = self._bbox_bottom_center(bbox)
                    current_side = self._line_side(bottom_center, config.stop_line)
                    previous_side = self.track_prev_side.get(track_id)
                    self.track_prev_side[track_id] = current_side

                    if previous_side is not None:
                        changed_side = previous_side * current_side < 0
                        intersects_line = self._bbox_intersects_line(bbox, config.stop_line)
                        in_red = self._is_red(timestamp_sec, config.red_intervals)

                        if changed_side and intersects_line and in_red:
                            key = (track_id, "red_light")
                            last_frame = self.last_violation_frame.get(key, -10**9)
                            if frame_idx - last_frame >= cooldown_frames:
                                violation_code, violation_type, fine_amount_snapshot = self._violation_meta(
                                    "Vượt đèn đỏ",
                                    "VUOT_DEN_DO",
                                )
                                if self._is_duplicate_violation(
                                    track_id=track_id,
                                    violation_type=violation_type,
                                    bbox=bbox,
                                    plate_text=plate_text,
                                    frame_idx=frame_idx,
                                    fps=fps,
                                    config=config,
                                ):
                                    continue
                                record = self._prepare_violation_record(
                                    frame=frame,
                                    vehicle_bbox=bbox,
                                    plate_bbox=plate_bbox,
                                    violation_type=violation_type,
                                    violation_code=violation_code,
                                    plate_text=plate_text,
                                    vehicle_type=vehicle_type,
                                    event_time=current_time,
                                )
                                record["fine_amount_snapshot"] = fine_amount_snapshot
                                violations.append(record)
                                self.last_violation_frame[key] = frame_idx
                                self._mark_violation_seen(track_id, violation_type, bbox, plate_text, frame_idx)

                    if vehicle_type == "Xe gắn máy":
                        has_no_helmet = self._has_no_helmet_in_vehicle(
                            vehicle_bbox=bbox,
                            helmet_bboxes=helmet_xyxy,
                            helmet_classes=helmet_classes,
                            helmet_scores=helmet_confs,
                        )

                        if has_no_helmet:
                            key = (track_id, "no_helmet")
                            last_frame = self.last_violation_frame.get(key, -10**9)
                            if frame_idx - last_frame >= cooldown_frames:
                                violation_code, violation_type, fine_amount_snapshot = self._violation_meta(
                                    "Không đội mũ bảo hiểm",
                                    "KHONG_DOI_MU_BAO_HIEM",
                                )
                                if self._is_duplicate_violation(
                                    track_id=track_id,
                                    violation_type=violation_type,
                                    bbox=bbox,
                                    plate_text=plate_text,
                                    frame_idx=frame_idx,
                                    fps=fps,
                                    config=config,
                                ):
                                    continue
                                record = self._prepare_violation_record(
                                    frame=frame,
                                    vehicle_bbox=bbox,
                                    plate_bbox=plate_bbox,
                                    violation_type=violation_type,
                                    violation_code=violation_code,
                                    plate_text=plate_text,
                                    vehicle_type=vehicle_type,
                                    event_time=current_time,
                                )
                                record["fine_amount_snapshot"] = fine_amount_snapshot
                                violations.append(record)
                                self.last_violation_frame[key] = frame_idx
                                self._mark_violation_seen(track_id, violation_type, bbox, plate_text, frame_idx)

                    if len(history) >= max(3, config.trajectory_window // 2):
                        movement = np.array(
                            [
                                history[-1][0] - history[0][0],
                                history[-1][1] - history[0][1],
                            ],
                            dtype=np.float32,
                        )
                        displacement = float(np.linalg.norm(movement))

                        if displacement >= config.wrong_way_min_displacement_px:
                            angle = self._angle_between(movement, road_vec)
                            if angle >= config.wrong_way_angle_threshold:
                                key = (track_id, "wrong_way")
                                last_frame = self.last_violation_frame.get(key, -10**9)
                                if frame_idx - last_frame >= cooldown_frames:
                                    violation_code, violation_type, fine_amount_snapshot = self._violation_meta(
                                        "Ngược chiều",
                                        "NGUOC_CHIEU",
                                    )
                                    if self._is_duplicate_violation(
                                        track_id=track_id,
                                        violation_type=violation_type,
                                        bbox=bbox,
                                        plate_text=plate_text,
                                        frame_idx=frame_idx,
                                        fps=fps,
                                        config=config,
                                    ):
                                        continue
                                    record = self._prepare_violation_record(
                                        frame=frame,
                                        vehicle_bbox=bbox,
                                        plate_bbox=plate_bbox,
                                        violation_type=violation_type,
                                        violation_code=violation_code,
                                        plate_text=plate_text,
                                        vehicle_type=vehicle_type,
                                        event_time=current_time,
                                    )
                                    record["fine_amount_snapshot"] = fine_amount_snapshot
                                    violations.append(record)
                                    self.last_violation_frame[key] = frame_idx
                                    self._mark_violation_seen(track_id, violation_type, bbox, plate_text, frame_idx)
        finally:
            cap.release()

        return violations

