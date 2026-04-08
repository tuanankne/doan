-- Seed data cho bảng violation_penalties
-- Chứa các định nghĩa lỗi vi phạm giao thông và mức phạt tương ứng

-- Xóa dữ liệu cũ nếu cần (comment lại nếu không muốn)
-- DELETE FROM public.violation_penalties;

-- Chèn dữ liệu violation_penalties
INSERT INTO public.violation_penalties (
  violation_code,
  violation_name,
  fine_amount,
  description,
  is_active
) VALUES
  (
    'VUOT_DEN_DO',
    'Vượt đèn đỏ',
    5000000,
    'Vi phạm tín hiệu đèn giao thông - vượt khi đèn đỏ',
    true
  ),
  (
    'NGUOC_CHIEU',
    'Ngược chiều',
    3500000,
    'Đi ngược chiều trên đường có quy định hướng đi',
    true
  ),
  (
    'LAN_LAN',
    'Lấn làn',
    1200000,
    'Lấn làn gây cản trở giao thông',
    true
  ),
  (
    'KHONG_MU_BAO_HIEM',
    'Không mang mũ bảo hiểm',
    400000,
    'Người điều khiển hoặc hành khách xe máy không đội mũ bảo hiểm',
    true
  ),
  (
    'VUOT_TOC_DO',
    'Vượt tốc độ',
    2500000,
    'Chạy quá tốc độ cho phép',
    true
  ),
  (
    'DUNG_IEN_TAI',
    'Dùng điện thoại khi lái xe',
    600000,
    'Sử dụng điện thoại di động khi điều khiển phương tiện',
    true
  ),
  (
    'DUNG_HANG_HAI',
    'Đỗ hàng hai',
    500000,
    'Để xe ở bên cạnh một hàng xe đang đỗ',
    true
  ),
  (
    'DUNG_HEM_DUONG',
    'Đỗ hẻm đường',
    300000,
    'Đỗ xe tại vị trí cấm đỗ (vùng lõi, hẻm đường)',
    true
  ),
  (
    'VUOT_KHONG_AN_TOAN',
    'Vượt không an toàn',
    1500000,
    'Vượt xe khi không có điều kiện an toàn',
    true
  ),
  (
    'CHI_CHI_HOAT_DONG',
    'Chỉ chỉ không rõ',
    200000,
    'Chỉ chỉ không rõ hoặc không phù hợp khi chiếu sáng',
    true
  ),
  (
    'HANH_LANG_DUONG_BO',
    'Hành lang đường bộ',
    800000,
    'Vi phạm quy định về hành lang đường bộ',
    true
  ),
  (
    'KHONG_TUC_DUONG',
    'Lái xe không tứcỉ đường',
    1000000,
    'Lái xe không tứcỉ đường/ lấn làn cho xe khác',
    true
  ),
  (
    'KIEM_DINH_KHONG_HOP_LE',
    'Kiểm định không hợp lệ',
    1800000,
    'Phương tiện không có giấy kiểm định an toàn kỹ thuật hợp lệ',
    true
  ),
  (
    'KHONG_DANG_KIEM',
    'Không đăng kiểm',
    2000000,
    'Phương tiện quá hạn kiểm định an toàn kỹ thuật',
    true
  ),
  (
    'CANH_TRANH_DUONG_BO',
    'Cạnh tranh đường bộ',
    750000,
    'Cạnh tranh đường bộ một cách nguy hiểm',
    true
  )
ON CONFLICT (violation_code) DO UPDATE
SET 
  violation_name = EXCLUDED.violation_name,
  fine_amount = EXCLUDED.fine_amount,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Xác nhận dữ liệu đã được chèn
SELECT COUNT(*) as total_violations FROM public.violation_penalties;
