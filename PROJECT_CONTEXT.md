7. Hướng dẫn sử dụng Web

### 7.1. Bảng điều khiển (`/`)

- Xem danh sách vi phạm, thống kê tổng lỗi / chờ xử lý / đã xử lý / tổng tiền.
- Biểu đồ theo ngày (7 ngày), theo tháng (12 tháng), tỷ lệ theo loại vi phạm.
- Tự cập nhật realtime khi có vi phạm mới (Supabase Realtime).
- Xem ảnh bằng chứng, thông tin chủ xe.

### 7.2. Cấu hình video (`/config`)

1. **Tải video** (mp4, avi, …).
2. **Vẽ vạch dừng (stop line):** chọn 2 điểm trên khung hình.
3. **Vẽ hướng đường (road direction):** chọn 2 điểm thể hiện chiều đi đúng.
4. (Tùy chọn) Cấu hình: độ tin cậy, IOU, khoảng đèn đỏ (`red_intervals` dạng JSON, ví dụ `[[0, 12.5], [30, 45]]`).
5. Bấm **Xử lý video** — gửi tới backend, chờ AI phân tích.
6. Xem kết quả: chỉnh sửa biển số nếu cần, kiểm tra ảnh bằng chứng.
7. Bấm **Xác nhận lưu** — ghi vi phạm vào Supabase.

**Các loại vi phạm hệ thống phát hiện:**
- Vượt đèn đỏ
- Đi ngược chiều
- Không đội mũ bảo hiểm (xe máy, nếu có model)
- Trích xuất biển số + tra cứu chủ xe

### 7.3. Quản lý mức phạt (`/fines`)

Thêm / sửa / xóa quy định mức phạt (`violation_code`, tên lỗi, loại xe, số tiền).

### 7.4. Quản trị (`/admin/...`)

| Trang | Chức năng |
|---|---|
| `/admin/profiles` | Quản lý hồ sơ dân cư (CCCD, họ tên, SĐT); reset mật khẩu tài khoản |
| `/admin/vehicles` | Quản lý phương tiện (biển số, loại xe, đăng ký) |
| `/admin/licenses` | Quản lý bằng lái xe |

---

## 8. Hướng dẫn sử dụng App mobile (tùy chọn)

| Tính năng | Mô tả |
|---|---|
| Đăng ký / Đăng nhập | CCCD + mật khẩu (CCCD phải có trong bảng `profiles` trên web admin) |
| Danh sách vi phạm | Xem vi phạm, chi tiết, thanh toán PayPal QR |
| Giấy phép lái xe | Xem GPLX theo CCCD |
| Đăng ký xe | Xem thông tin xe đã đăng ký |
| Cài đặt | Đổi mật khẩu, PIN, số điện thoại |
