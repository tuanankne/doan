-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  citizen_id character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  status character varying DEFAULT 'active'::character varying,
  last_login timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_citizen_id_fkey FOREIGN KEY (citizen_id) REFERENCES public.profiles(citizen_id)
);
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
CREATE TABLE public.driver_licenses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  citizen_id character varying NOT NULL,
  license_number character varying NOT NULL UNIQUE,
  license_class character varying NOT NULL,
  issued_date date NOT NULL,
  expiry_date date,
  issuing_authority character varying,
  points integer DEFAULT 12,
  status character varying DEFAULT 'Hoạt động'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_licenses_pkey PRIMARY KEY (id),
  CONSTRAINT driver_licenses_citizen_id_fkey FOREIGN KEY (citizen_id) REFERENCES public.profiles(citizen_id)
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
  license_plate character varying NOT NULL UNIQUE,
  vehicle_type character varying,
  brand character varying,
  color character varying,
  registered_at timestamp with time zone DEFAULT now(),
  citizen_id character varying NOT NULL,
  registration_number character varying UNIQUE,
  frame_number character varying,
  engine_number character varying,
  registration_date date,
  registration_expiry_date date,
  issuing_authority character varying,
  registration_status character varying DEFAULT 'Hoạt động'::character varying,
  CONSTRAINT vehicles_pkey PRIMARY KEY (id),
  CONSTRAINT vehicles_citizen_id_fkey FOREIGN KEY (citizen_id) REFERENCES public.profiles(citizen_id)
);
CREATE TABLE public.violation_penalties (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  violation_code character varying NOT NULL,
  violation_name character varying NOT NULL,
  fine_amount bigint NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  vehicle_type character varying CHECK (vehicle_type::text = ANY (ARRAY['Xe ô tô'::character varying, 'Xe gắn máy'::character varying, 'Xe thô sơ'::character varying]::text[])),
  CONSTRAINT violation_penalties_pkey PRIMARY KEY (id)
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
  vehicle_type character varying,
  CONSTRAINT violations_pkey PRIMARY KEY (id),
  CONSTRAINT violations_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id)
);