# PROJECT CONTEXT - Traffic Violation AI

Cập nhật lần cuối: 2026-04-06

## 1) Mục tiêu dự án
Hệ thống phát hiện vi phạm giao thông từ video, gồm:
- Vượt đèn đỏ
- Đi ngược chiều
- Trích xuất biển số xe
- Lưu bằng chứng ảnh + dữ liệu vi phạm lên Supabase
- Hiển thị dashboard realtime trên web

## 2) Kiến trúc tổng quan
- Backend: FastAPI (xử lý video, suy luận AI, lưu Supabase)
- Frontend: React + Vite (dashboard và trang cấu hình video)
- Frontend: React + Vite (dashboard, trang cấu hình video và trang quản lý mức phạt)
- AI models:
  - `server/models/ver2.pt`: model nhận diện biển số/ký tự (đang dùng cho plate detect + decode + OCR fallback)
  - `server/models/yolo11n.pt`: model track phương tiện
- Database/Storage: Supabase (table vi phạm + bucket ảnh)
- Database/Storage: Supabase (table vi phạm, bảng mức phạt + bucket ảnh)

## 3) Cấu trúc thư mục hiện tại

```text
doan/
  app/
    .idea/                     # Thư mục IDE, không thuộc mã nguồn chạy
  server/
    .env
    app/
      main.py                  # Entry app (app = build_app())
      api/
        routes.py              # Tạo FastAPI app, API routes
      core/
        settings.py            # Nạp env và resolve model path
      schemas/
        api_models.py          # Pydantic response models
      services/
        video_processor.py     # Pipeline AI xử lý video
        supabase_service.py    # Upload/khởi tạo bucket Supabase
    models/
      ver2.pt
      yolo11n.pt
    tmp/
  web/
    .env
    index.html
    package.json
    vite.config.js
    src/
      main.jsx                 # Entry React
      app/
        App.jsx                # Router layout
        styles.css             # CSS toàn cục
      features/
        dashboard/
          pages/
            DashboardPage.jsx  # Dashboard vi phạm
          components/
            ViolationsTable.jsx
        video-config/
          components/
            VideoConfig.jsx    # Upload video + vẽ line/vector + gửi backend
        fine-management/
          pages/
            FineManagementPage.jsx # CRUD mức phạt vi phạm
      shared/
        lib/
          supabaseClient.js
```

## 4) Luồng xử lý chính

### 4.1 Luồng cấu hình + chạy AI
1. Người dùng mở trang `/config` trên web.
2. Tải video, vẽ:
   - stop_line (2 điểm)
   - road_direction (2 điểm)
3. Frontend gửi multipart form tới `POST /api/v1/process-video`:
   - `video`: file video
   - `config`: JSON cấu hình
4. Backend:
   - Lưu video tạm
   - Parse `config` thành `ProcessingConfig`
   - Chạy `VideoProcessor.process_video(...)`
5. Trong `VideoProcessor`:
   - Track vehicle bằng `yolo11n.pt`
   - Detect biển số/ký tự bằng `ver2.pt`
   - OCR fallback bằng EasyOCR nếu decode từ model không ra
   - Xác định vi phạm vượt đèn đỏ/ngược chiều
   - Upload ảnh toàn cảnh + ảnh biển số lên Supabase Storage
   - Insert record vào bảng vi phạm Supabase
6. API trả về danh sách vi phạm đã ghi.

### 4.3 Luồng quản lý mức phạt
1. Trang `/fines` dùng để thêm/sửa/xóa các quy định mức phạt.
2. Frontend gọi backend CRUD trên bảng `violation_penalties`.
3. Bảng này lưu mã lỗi, tên lỗi, mức phạt tiền, mô tả và trạng thái áp dụng.

### 4.2 Luồng dashboard realtime
1. Trang `/` query bảng vi phạm (200 bản ghi mới nhất).
2. Subcribe `postgres_changes` của Supabase để tự reload khi có thay đổi.
3. Hiển thị thống kê + bảng ảnh bằng chứng.

## 5) API backend hiện có

### GET /health
- Mục đích: health check
- Response: `{ "status": "ok" }`

### POST /api/v1/process-video
- Content-Type: multipart/form-data
- Fields:
  - `video`: UploadFile
  - `config`: JSON string
- Response model: `ProcessVideoResponse`
  - `total_violations: int`
  - `violations: List[Dict[str, Any]]`

### POST /api/v1/storage/upload-image
- Upload ảnh thủ công lên Supabase storage
- Response model: `UploadImageResponse`
  - `file_name`
  - `storage_url`

### GET /api/v1/violation-penalties
- Lấy danh sách mức phạt

### POST /api/v1/violation-penalties
- Tạo mức phạt mới

### PUT /api/v1/violation-penalties/{id}
- Cập nhật mức phạt

### DELETE /api/v1/violation-penalties/{id}
- Xóa mức phạt

## 6) Biến môi trường quan trọng

### Backend (`server/.env`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (hoặc `SUPABASE_ANON_SECRET` fallback)
- `SUPABASE_STORAGE_BUCKET` (mặc định: `violations`)
- `SUPABASE_VIOLATIONS_TABLE` (mặc định: `violations`)
- `SUPABASE_VIOLATION_PENALTIES_TABLE` (mặc định: `violation_penalties`)
- `YOLO_MODEL_PATH` (mặc định: `models/ver2.pt`)
- `VEHICLE_TRACKER_MODEL` (mặc định: `models/yolo11n.pt`)

### Frontend (`web/.env`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_VIOLATIONS_TABLE` (tuỳ chọn, mặc định `violations`)

## 7) Lệnh chạy nhanh

### Frontend
```bash
cd web
npm install
npm run dev
```

### Backend
```bash
cd server
pip install fastapi uvicorn python-multipart python-dotenv supabase ultralytics opencv-python easyocr numpy
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 8) Ghi chú kỹ thuật quan trọng cho AI phiên sau
- Frontend đã chuyển sang cấu trúc `src/app`, `src/features`, `src/shared`.
- Entry React ở `web/src/main.jsx` dùng `StrictMode` import trực tiếp từ `react`.
- API frontend hiện gọi backend mặc định: `http://localhost:8000/api/v1/process-video`.
- Dashboard đọc dữ liệu trực tiếp từ Supabase bằng client phía frontend.
- `video_processor.py` hiện dùng 2 model:
  - model phương tiện (`vehicle_model`) cho tracking
  - model chính (`model`) cho plate/char detection + OCR fallback
- Trang `/fines` dùng CRUD backend để quản lý bảng `violation_penalties`.
- Dashboard `/` hiện map dữ liệu vi phạm với bảng `violation_penalties` để hiển thị mức phạt ước tính.
- Đề xuất schema mới: `violations.violation_code` + `violations.fine_amount_snapshot` để map mức phạt theo mã lỗi và giữ lịch sử mức phạt ổn định theo thời điểm vi phạm.
- Thư mục `app/.idea` ở root là file IDE, có thể bỏ qua khi coding.

## 9) Checklist khi debug nhanh
1. Kiểm tra backend chạy cổng 8000 chưa.
2. Kiểm tra web env có đủ `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
3. Kiểm tra backend env có `SUPABASE_URL` + key hợp lệ.
4. Kiểm tra file model tồn tại ở `server/models/`.
5. Nếu giao diện trắng: mở browser console, ưu tiên lỗi import/path ở `web/src/main.jsx` và route components.
6. Nếu không ghi được vi phạm: kiểm tra bucket/table Supabase và quyền service role key.

## 10) Việc nên làm tiếp (khuyến nghị)
- Tạo `requirements.txt` cho backend để cố định dependencies.
- Thêm script `dev` ở root (chạy đồng thời backend + frontend).
- Thêm README chính thức (tiếng Việt) và tài liệu API mẫu request/response.
- Tách riêng model detect biển số và model OCR biển số nếu muốn pipeline chuẩn 2-model rõ ràng.
