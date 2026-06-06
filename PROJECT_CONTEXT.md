# PROJECT CONTEXT — Hệ thống phát hiện vi phạm giao thông AI

Cập nhật lần cuối: **2026-06-07**

Tài liệu mô tả **toàn bộ những gì dự án đã hoàn thiện** tại thời điểm hiện tại, dựa trên mã nguồn thực tế trong repo.

---

## 1) Mục tiêu dự án

Xây dựng hệ thống **phạt nguội giao thông** từ video camera, gồm:

| Khả năng | Trạng thái |
|---|---|
| Phát hiện **vượt đèn đỏ** | ✅ Hoàn thiện |
| Phát hiện **đi ngược chiều** | ✅ Hoàn thiện |
| Phát hiện **không đội mũ bảo hiểm** (xe máy) | ✅ Hoàn thiện |
| **Trích xuất biển số** (YOLO + EasyOCR fallback) | ✅ Hoàn thiện |
| **Tra cứu chủ xe** từ biển số trong CSDL | ✅ Hoàn thiện |
| Upload ảnh bằng chứng lên **Supabase Storage** | ✅ Hoàn thiện |
| Lưu vi phạm vào **Supabase PostgreSQL** | ✅ Hoàn thiện (sau bước xác nhận) |
| Dashboard web realtime + thống kê | ✅ Hoàn thiện |
| Quản lý mức phạt, dân cư, xe, bằng lái | ✅ Hoàn thiện |
| Ứng dụng mobile công dân (đăng nhập, xem vi phạm, thanh toán) | ✅ Hoàn thiện phần lõi |
| Khiếu nại vi phạm (`complaints`) | ⏳ Chỉ có schema DB, chưa có API/UI |

---

## 2) Kiến trúc tổng quan

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   web/ (React)  │────▶│ server/ (API)   │────▶│    Supabase     │
│   Dashboard     │     │   FastAPI + AI  │     │  PostgreSQL +   │
│   Cấu hình video│     │   YOLO/EasyOCR  │     │    Storage      │
└────────┬────────┘     └────────▲────────┘     └────────▲────────┘
         │                       │                        │
         │  (dashboard realtime) │                        │
         └───────────────────────┴────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   app/ (Flutter mobile) │
                    │   Đăng nhập, vi phạm,   │
                    │   giấy tờ, thanh toán   │
                    └─────────────────────────┘
```

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **server/** | Python 3.10+, FastAPI, Ultralytics, OpenCV, EasyOCR | Xử lý video AI, API REST, mã hóa dữ liệu, PayPal |
| **web/** | React 18, Vite 5, Konva, Axios, Supabase JS | Dashboard quản trị, cấu hình video, CRUD dữ liệu |
| **app/** | Flutter 3.x, HTTP | Ứng dụng công dân trên Android/iOS |
| **Database** | Supabase (PostgreSQL) | profiles, vehicles, violations, accounts, … |
| **Storage** | Supabase Storage bucket `violations` | Ảnh toàn cảnh + ảnh biển số |

---

## 3) Cấu trúc thư mục

```text
doan/
├── PROJECT_CONTEXT.md          # Tài liệu này
├── HUONG_DAN_CAI_DAT.md        # Hướng dẫn cài đặt & chạy dự án
├── Sql.md                      # Schema database tham chiếu
│
├── server/
│   ├── .env                    # Biến môi trường backend
│   ├── app/
│   │   ├── main.py             # Entry: app = build_app()
│   │   ├── api/
│   │   │   ├── routes.py       # API vi phạm, video, mức phạt, PayPal
│   │   │   └── management_routes.py  # API quản trị + auth công dân
│   │   ├── core/
│   │   │   ├── settings.py     # Nạp .env, resolve model path
│   │   │   ├── encryption.py   # AES-256-GCM mã hóa trường nhạy cảm
│   │   │   └── passwords.py    # PBKDF2-HMAC-SHA256 hash mật khẩu/PIN
│   │   ├── schemas/
│   │   │   └── api_models.py   # Pydantic request/response models
│   │   └── services/
│   │       ├── video_processor.py    # Pipeline AI xử lý video (~1700 dòng)
│   │       ├── supabase_service.py   # Upload/khởi tạo bucket Storage
│   │       └── paypal_service.py     # Tạo order & capture PayPal
│   ├── models/                 # File model AI (.pt) — bắt buộc khi chạy
│   │   ├── yolo11n.pt          # Tracking phương tiện
│   │   ├── phathienbien.pt     # Phát hiện biển số
│   │   ├── docbien.pt          # Đọc ký tự biển số
│   │   ├── ver2.pt             # Model dự phòng (plate detect fallback)
│   │   └── mubaohiem2.pt       # Phát hiện mũ bảo hiểm
│   └── tmp/                    # Video tạm khi xử lý
│
├── web/
│   ├── .env
│   ├── package.json
│   ├── vite.config.js          # Dev server: 0.0.0.0:5173
│   └── src/
│       ├── main.jsx            # Entry React (StrictMode)
│       ├── app/
│       │   ├── App.jsx         # Router + topbar navigation
│       │   └── styles.css      # CSS toàn cục
│       ├── features/
│       │   ├── dashboard/
│       │   │   ├── pages/DashboardPage.jsx
│       │   │   └── components/ViolationsTable.jsx
│       │   ├── video-config/
│       │   │   └── components/VideoConfig.jsx
│       │   ├── fine-management/
│       │   │   └── pages/FineManagementPage.jsx
│       │   └── admin/
│       │       ├── pages/ProfilesManagementPage.jsx
│       │       ├── pages/VehiclesManagementPage.jsx
│       │       ├── pages/DriverLicensesManagementPage.jsx
│       │       └── styles/ManagementPages.css
│       └── shared/
│           ├── lib/supabaseClient.js
│           └── api/managementApi.js
│
└── app/                        # Flutter mobile
    ├── pubspec.yaml
    └── lib/
        ├── main.dart
        ├── app/app.dart
        ├── core/network/app_api.dart
        └── features/
            ├── auth/           # Đăng nhập, đăng ký, quên MK
            ├── home/             # Trang chủ + điều hướng
            ├── violations/       # Danh sách vi phạm + PayPal QR
            ├── documents/        # Bằng lái, đăng ký xe
            └── settings/         # Đổi MK, PIN, SĐT
```

---

## 4) Pipeline AI xử lý video

### 4.1 Các model đang dùng

`VideoProcessor` khởi tạo **5 model YOLO** độc lập:

| Model | Biến môi trường | File mặc định | Chức năng |
|---|---|---|---|
| Vehicle tracker | `VEHICLE_TRACKER_MODEL` | `models/yolo11n.pt` | ByteTrack tracking phương tiện |
| Plate detector | `PLATE_DETECTOR_MODEL` | `models/phathienbien.pt` | Phát hiện vùng biển số |
| Plate reader | `PLATE_READER_MODEL` | `models/docbien.pt` | Đọc ký tự biển số |
| Legacy/fallback | `YOLO_MODEL_PATH` | `models/ver2.pt` | Fallback nếu thiếu plate detector |
| Helmet detector | `HELMET_MODEL_PATH` | `models/mubaohiem2.pt` | Phát hiện không đội mũ (tùy chọn) |

Ngoài ra:
- **EasyOCR** (`en`) làm fallback khi model đọc biển số không ra kết quả.
- Tracker mặc định: `bytetrack.yaml` (Ultralytics).

### 4.2 Các loại vi phạm phát hiện được

| Mã lỗi | Tên hiển thị | Điều kiện phát hiện |
|---|---|---|
| `VUOT_DEN_DO` | Vượt đèn đỏ | Xe cắt qua `stop_line` khi `timestamp` nằm trong `red_intervals` |
| `NGUOC_CHIEU` | Ngược chiều | Vector di chuyển lệch ≥ `wrong_way_angle_threshold` (mặc định 120°) so với `road_direction` |
| `KHONG_DOI_MU_BAO_HIEM` | Không đội mũ bảo hiểm | Chỉ áp dụng `Xe gắn máy`, có model helmet |

### 4.3 Cấu hình xử lý (`ProcessingConfig`)

Frontend gửi JSON `config` kèm video, backend parse qua `ProcessingConfig.from_dict()`:

```json
{
  "stop_line": [[x1, y1], [x2, y2]],
  "road_direction": [[x1, y1], [x2, y2]],
  "red_intervals": [[0, 12.5], [30, 45]],
  "tracker": "bytetrack.yaml",
  "confidence": 0.35,
  "iou": 0.45,
  "trajectory_window": 12,
  "wrong_way_angle_threshold": 120.0,
  "wrong_way_min_displacement_px": 25.0,
  "violation_cooldown_seconds": 3.0,
  "one_violation_per_track": true,
  "duplicate_window_seconds": 8.0,
  "duplicate_center_distance_px": 80.0
}
```

### 4.4 Luồng xử lý 2 bước (process → confirm)

**Bước 1 — Phát hiện (chưa ghi DB vi phạm chính thức):**

1. Web `/config` upload video + config → `POST /api/v1/process-video`
2. Backend lưu video tạm, chạy `VideoProcessor.process_video()`
3. Với mỗi frame: track xe → detect biển số → decode/OCR → kiểm tra 3 loại vi phạm
4. Upload ảnh toàn cảnh + ảnh biển số lên Supabase Storage
5. Tra cứu chủ xe từ biển số (`_find_vehicle_context`)
6. Tra mức phạt từ bảng `violation_penalties` (`_violation_meta`)
7. Trả về danh sách vi phạm với `status: "pending_confirmation"`

**Bước 2 — Xác nhận lưu:**

1. Người dùng xem/chỉnh sửa biển số trên web
2. Bấm xác nhận → `POST /api/v1/confirm-violations`
3. `save_confirmed_violations()` insert vào bảng `violations` với `status: "pending"`
4. Tự liên kết `vehicle_id` nếu tìm thấy biển số trong bảng `vehicles`

### 4.5 Phân loại loại xe

- Suy luận từ class ID của model tracking (`_vehicle_type_from_class_id`)
- Nhãn chuẩn: `Xe ô tô`, `Xe gắn máy`, `Không xác định`
- Mức phạt có thể khác nhau theo `vehicle_type` trong bảng `violation_penalties`

---

## 5) Database (Supabase)

Schema đầy đủ trong `Sql.md`. Các bảng đang được code sử dụng:

| Bảng | Mục đích | API/UI sử dụng |
|---|---|---|
| `profiles` | Hồ sơ công dân (CCCD, họ tên, SĐT) | Web admin, mobile, tra cứu chủ xe |
| `accounts` | Tài khoản đăng nhập (hash mật khẩu + PIN) | Mobile auth, web reset MK |
| `vehicles` | Đăng ký phương tiện | Web admin, mobile, liên kết vi phạm |
| `driver_licenses` | Bằng lái xe | Web admin, mobile |
| `violations` | Vi phạm giao thông | Dashboard, mobile, API |
| `violation_penalties` | Quy định mức phạt | Web `/fines`, AI lookup mức phạt |
| `complaints` | Khiếu nại vi phạm | ⏳ Chưa triển khai |

**Storage bucket:** `violations` (public), tự tạo khi server khởi động nếu chưa có.

**Cột quan trọng bảng `violations`:**
- `violation_code`, `violation_type`, `fine_amount_snapshot`
- `evidence_image_url`, `evidence_plate_url`
- `detected_license_plate`, `vehicle_type`, `vehicle_id`
- `status` (mặc định `Chờ xử lý` / `pending`, sau thanh toán → `done`)
- `payment_status` (tùy chọn, dùng khi PayPal callback thành công)

---

## 6) Bảo mật dữ liệu

### 6.1 Mã hóa trường nhạy cảm (`encryption.py`)

- Thuật toán: **AES-256-GCM**
- Key derivation: SHA256(`ENCRYPTION_KEY` + `"doan_app"`)
- Trường được mã hóa khi lưu DB:
  - `profiles.citizen_id`, `profiles.phone_number`
  - `driver_licenses.license_number`
- API tự decrypt khi trả về client

### 6.2 Hash mật khẩu (`passwords.py`)

- Thuật toán: **PBKDF2-HMAC-SHA256**, 120.000 iterations, salt ngẫu nhiên
- `accounts.password_hash` — mật khẩu đăng nhập
- `accounts.reset_hash` — mã PIN (dùng quên mật khẩu)

---

## 7) API Backend đầy đủ

Base URL: `http://localhost:8000`  
Prefix chính: `/api/v1`  
Swagger: `http://localhost:8000/docs`

### 7.1 Health & Video

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/health` | Health check → `{"status":"ok"}` |
| POST | `/api/v1/process-video` | Xử lý video AI (multipart: `video` + `config`) |
| POST | `/api/v1/confirm-violations` | Xác nhận và lưu vi phạm vào DB |
| POST | `/api/v1/storage/upload-image` | Upload ảnh thủ công lên Storage |

### 7.2 Vi phạm & Mức phạt

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/violations` | Danh sách 200 vi phạm mới nhất + thông tin chủ xe |
| POST | `/api/v1/violations/{id}/paypal-qr` | Tạo QR/link thanh toán PayPal |
| GET | `/api/v1/violation-penalties` | Lấy danh sách mức phạt |
| POST | `/api/v1/violation-penalties` | Tạo mức phạt |
| PUT | `/api/v1/violation-penalties/{id}` | Cập nhật mức phạt |
| DELETE | `/api/v1/violation-penalties/{id}` | Xóa mức phạt |

### 7.3 PayPal

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/paypal/return` | Callback sau thanh toán → capture order, cập nhật `status: done` |
| GET | `/api/v1/paypal/cancel` | Callback hủy thanh toán |

### 7.4 Quản trị — prefix `/api/v1/management`

**Kiểm tra & Auth:**

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/check-citizen` | Kiểm tra CCCD tồn tại |
| POST | `/check-account` | Kiểm tra CCCD đã có tài khoản |
| POST | `/reset-password` | Admin đặt lại mật khẩu theo CCCD |
| POST | `/auth/register` | Đăng ký tài khoản (CCCD + MK + PIN) |
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/change-password` | Đổi mật khẩu |
| POST | `/auth/change-pin` | Đổi passcode/PIN |
| POST | `/auth/forgot-password` | Quên MK bằng PIN |

**Profiles (dân cư):**

| Method | Endpoint |
|---|---|
| GET | `/profiles` |
| POST | `/profiles` |
| GET | `/profiles/{id}` |
| PATCH | `/profiles/{id}` |
| DELETE | `/profiles/{id}` |

**Bằng lái:**

| Method | Endpoint |
|---|---|
| GET | `/driver-licenses` |
| POST | `/driver-licenses` |
| PATCH | `/driver-licenses/{id}` |
| DELETE | `/driver-licenses/{id}` |

**Phương tiện:**

| Method | Endpoint |
|---|---|
| GET | `/vehicles` |
| POST | `/vehicles` |
| PATCH | `/vehicles/{id}` |
| DELETE | `/vehicles/{id}` |

**Mobile — tra cứu giấy tờ theo CCCD:**

| Method | Endpoint |
|---|---|
| POST | `/documents/driver-licenses` |
| POST | `/documents/vehicles` |

---

## 8) Frontend Web — các trang đã hoàn thiện

| Route | Component | Chức năng |
|---|---|---|
| `/` | `DashboardPage` | Thống kê (tổng lỗi, chờ xử lý, đã xử lý, tổng tiền); biểu đồ cột 7 ngày / 12 tháng; donut theo loại vi phạm; bảng vi phạm; realtime Supabase |
| `/config` | `VideoConfig` | Upload video; vẽ stop line & road direction (Konva); cấu hình AI; gửi xử lý; xem/chỉnh sửa kết quả; xác nhận lưu |
| `/fines` | `FineManagementPage` | CRUD mức phạt (`violation_code`, tên, loại xe, số tiền, mô tả, active) |
| `/admin/profiles` | `ProfilesManagementPage` | CRUD dân cư; xem bằng lái/xe liên kết; tìm theo CCCD; reset mật khẩu tài khoản |
| `/admin/vehicles` | `VehiclesManagementPage` | CRUD phương tiện (biển số, loại xe, hãng, màu, số khung/máy, …) |
| `/admin/licenses` | `DriverLicensesManagementPage` | CRUD bằng lái (số GPLX, hạng, điểm, trạng thái, …) |

**Dashboard chi tiết:**
- Gọi `GET /api/v1/violations` (không đọc trực tiếp Supabase cho danh sách chính)
- Subscribe `postgres_changes` trên bảng `violations` để auto-reload
- `ViolationsTable`: hiển thị ảnh bằng chứng, modal thông tin chủ xe

**VideoConfig chi tiết:**
- Gọi `POST /api/v1/process-video` qua Axios (multipart)
- Sau xử lý: bảng chỉnh sửa biển số, xem ảnh, thông tin chủ xe
- Xác nhận: `POST /api/v1/confirm-violations`

---

## 9) Ứng dụng Flutter Mobile

### 9.1 Đã hoàn thiện

| Màn hình | Chức năng |
|---|---|
| `LoginPage` | Đăng nhập bằng CCCD + mật khẩu |
| `RegisterPage` | Đăng ký tài khoản (CCCD phải có trong `profiles`) |
| `ForgotPasswordPage` | Quên MK bằng PIN |
| `HomePage` | Trang chủ, điều hướng tính năng |
| `ViolationsPage` | Danh sách vi phạm (tab chờ/đã thanh toán), chi tiết, thanh toán PayPal QR |
| `DriverLicensePage` | Xem bằng lái theo CCCD |
| `VehicleRegistrationPage` | Xem đăng ký xe theo CCCD |
| `SettingsPage` | Đổi mật khẩu, đổi PIN, đổi SĐT |

**API mặc định:** `http://10.0.2.2:8000/api/v1` (Android Emulator)  
Override: `flutter run --dart-define=API_BASE_URL=http://IP:8000/api/v1`

### 9.2 Chưa hoàn thiện / placeholder

- Tab **Tin tức** — chưa có nội dung
- Nút **Hỗ trợ** — hiện snackbar "sẽ sớm được phát hành"
- **Ví QR giấy tờ**, **Thông báo** — `onTap: () {}` (chưa implement)
- Header hiển thị tên cứng `"Trần Tuấn Anh"` (chưa bind dữ liệu profile động)

---

## 10) Thanh toán PayPal

Luồng hoàn chỉnh trên mobile:

1. `ViolationsPage` gọi `POST /api/v1/violations/{id}/paypal-qr`
2. `PaypalService` tạo order sandbox/production, cache `order_id → violation_id` (10 phút)
3. Trả về `pay_url`, `qr_code_url`
4. Sau thanh toán, PayPal redirect về `GET /api/v1/paypal/return?token={order_id}`
5. Backend capture order, cập nhật `violations.status = "done"` (+ `payment_status` nếu có cột)

**Biến môi trường cần thiết:** `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `PAYPAL_RETURN_URL`, `PAYPAL_CANCEL_URL`

---

## 11) Biến môi trường

### Backend (`server/.env`)

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | — | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service role key (hoặc `SUPABASE_ANON_SECRET`) |
| `SUPABASE_STORAGE_BUCKET` | | `violations` | Tên bucket ảnh |
| `SUPABASE_VIOLATIONS_TABLE` | | `violations` | Tên bảng vi phạm |
| `SUPABASE_VIOLATION_PENALTIES_TABLE` | | `violation_penalties` | Tên bảng mức phạt |
| `YOLO_MODEL_PATH` | | `models/ver2.pt` | Model legacy/fallback |
| `VEHICLE_TRACKER_MODEL` | | `models/yolo11n.pt` | Model tracking |
| `PLATE_DETECTOR_MODEL` | | `models/phathienbien.pt` | Model detect biển số |
| `PLATE_READER_MODEL` | | `models/docbien.pt` | Model đọc ký tự |
| `HELMET_MODEL_PATH` | | `models/mubaohiem2.pt` | Model mũ bảo hiểm |
| `ENCRYPTION_KEY` | | unsafe default | Key mã hóa AES (đổi khi production) |
| `VEHICLE_TYPE_DEBUG` | | `1` | Log debug phân loại xe |
| `PAYPAL_*` | | sandbox URLs | Cấu hình PayPal (tùy chọn) |

### Frontend (`web/.env`)

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL Supabase (realtime) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon key |
| `VITE_API_BASE_URL` | | Mặc định `http://localhost:8000/api/v1` |
| `VITE_SUPABASE_VIOLATIONS_TABLE` | | Mặc định `violations` |

---

## 12) Lệnh chạy nhanh

### Backend
```bash
cd server
python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn python-multipart python-dotenv supabase ultralytics opencv-python easyocr numpy cryptography pydantic
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd web
npm install
npm run dev
# → http://localhost:5173
```

### Mobile
```bash
cd app
flutter pub get
flutter run
```

Chi tiết đầy đủ: xem `HUONG_DAN_CAI_DAT.md`.

---

## 13) Phụ thuộc chính

| Layer | Packages |
|---|---|
| Backend | fastapi, uvicorn, python-multipart, python-dotenv, supabase, ultralytics, opencv-python, easyocr, numpy, cryptography, pydantic, torch (auto) |
| Web | react, react-dom, react-router-dom, vite, axios, konva, react-konva, @supabase/supabase-js |
| Mobile | flutter, http |

---

## 14) Checklist debug nhanh

1. Backend chạy cổng **8000**? → `GET /health`
2. `server/.env` có `SUPABASE_URL` + key hợp lệ?
3. `web/.env` có `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`?
4. Thư mục `server/models/` có đủ 5 file `.pt`?
5. Supabase: bảng + bucket `violations` đã tạo?
6. Web trắng → kiểm tra console, thường do thiếu env Supabase
7. Xử lý video lỗi → xem log terminal server (model path, EasyOCR download)
8. Không lưu được vi phạm → kiểm tra service role key và schema bảng `violations`
9. Mobile không kết nối API → dùng IP LAN hoặc `10.0.2.2` cho emulator
10. PayPal lỗi → kiểm tra đủ 5 biến `PAYPAL_*` trong `server/.env`

---

## 15) Tóm tắt mức độ hoàn thiện

### ✅ Đã hoàn thiện

- Pipeline AI đa model (tracking, biển số, mũ BH, OCR)
- 3 loại vi phạm: vượt đèn đỏ, ngược chiều, không đội mũ
- Luồng xử lý video 2 bước (phát hiện → xác nhận lưu)
- Dashboard web với thống kê, biểu đồ, realtime
- CRUD mức phạt, dân cư, xe, bằng lái (web)
- Mã hóa dữ liệu nhạy cảm + hash mật khẩu
- Auth công dân đầy đủ (đăng ký, đăng nhập, quên MK, đổi MK/PIN)
- App mobile: vi phạm, giấy tờ, cài đặt, thanh toán PayPal
- Tra cứu chủ xe tự động khi phát hiện vi phạm
- Map mức phạt theo `violation_code` + `vehicle_type` + `fine_amount_snapshot`

### ⏳ Chưa triển khai / còn placeholder

- Bảng `complaints` (khiếu nại) — chỉ có trong `Sql.md`
- Tab Tin tức, Hỗ trợ, Ví QR trên mobile
- `requirements.txt` cố định phiên bản backend
- Script chạy đồng thời backend + frontend ở root
- Bind tên người dùng động trên header mobile

---

*Tài liệu này phản ánh trạng thái mã nguồn tại `2026-06-07`. Khi thêm tính năng mới, cập nhật file này để AI/agent phiên sau nắm đúng context.*
