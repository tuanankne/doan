-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  violation_id uuid,
  user_id uuid,
  reason text NOT NULL,
  evidence_url text,
  status character varying DEFAULT 'Đang tiếp nhận'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_violation_id_fkey FOREIGN KEY (violation_id) REFERENCES public.violations(id),
  CONSTRAINT complaints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name character varying,
  citizen_id character varying UNIQUE,
  phone_number character varying UNIQUE,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.vehicles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  owner_id uuid,
  license_plate character varying NOT NULL UNIQUE,
  vehicle_type character varying,
  brand character varying,
  color character varying,
  registered_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vehicles_pkey PRIMARY KEY (id),
  CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.violations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  vehicle_id uuid,
  detected_license_plate character varying NOT NULL,
  violation_type character varying NOT NULL,
  violation_code character varying,
  evidence_image_url text NOT NULL,
  evidence_plate_url text,
  fine_amount_snapshot bigint,
  detected_at timestamp with time zone DEFAULT now(),
  status character varying DEFAULT 'Chờ xử lý'::character varying,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT violations_pkey PRIMARY KEY (id),
  CONSTRAINT violations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id),
  CONSTRAINT violations_violation_code_fkey FOREIGN KEY (violation_code) REFERENCES public.violation_penalties(violation_code)
);

-- ĐỀ XUẤT BỔ SUNG CHO QUẢN LÝ MỨC PHẠT
-- Bảng này dùng cho tab "Quản lý mức phạt" trong giao diện.
-- Có thể thêm/sửa/xóa các quy định mức phạt tiền theo từng lỗi vi phạm.
CREATE TABLE public.violation_penalties (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  violation_code character varying NOT NULL UNIQUE,
  violation_name character varying NOT NULL,
  fine_amount bigint NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT violation_penalties_pkey PRIMARY KEY (id)
);

-- Khuyến nghị: liên kết vi phạm phát hiện với bảng mức phạt bằng violation_code.
-- Dùng violation_code giúp dữ liệu rõ nghĩa và đồng bộ trực tiếp với quy tắc mức phạt.

CREATE INDEX idx_violations_violation_code ON public.violations(violation_code);

-- Gợi ý sử dụng:
-- - violation_code: mã lỗi để map trực tiếp sang bảng violation_penalties
-- - fine_amount_snapshot: lưu lại số tiền áp dụng tại thời điểm ghi nhận vi phạm
--   để sau này nếu thay đổi bảng violation_penalties thì dữ liệu cũ vẫn không bị lệch.

-- Migration gợi ý nếu đã có dữ liệu cũ:
-- 1) Điền violation_code từ violation_type theo luật map của hệ thống.
-- 2) Sau khi dữ liệu sạch, có thể set NOT NULL cho violations.violation_code.
-- Ví dụ:
-- UPDATE public.violations
-- SET violation_code = CASE
--   WHEN upper(violation_type) IN ('VUOT DEN DO', 'VƯỢT ĐÈN ĐỎ', 'VƯỢT ĐÈN ĐỎ', 'RED_LIGHT') THEN 'VUOT_DEN_DO'
--   WHEN upper(violation_type) IN ('NGUOC CHIEU', 'NGƯỢC CHIỀU', 'WRONG_WAY') THEN 'NGUOC_CHIEU'
--   ELSE regexp_replace(upper(violation_type), '[^A-Z0-9]+', '_', 'g')
-- END
-- WHERE violation_code IS NULL;

-- Trigger đề xuất để tự cập nhật updated_at khi sửa bản ghi mức phạt.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_violation_penalties_updated_at
BEFORE UPDATE ON public.violation_penalties
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();