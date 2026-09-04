-- ============================================================
-- GeM Bid Compliance Platform — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('bidder', 'officer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE bid_status AS ENUM (
    'SUBMITTED',
    'OCR_PROCESSING',
    'EXTRACTION_DONE',
    'GOV_VERIFIED',
    'REPORT_READY',
    'APPROVED',
    'REJECTED',
    'CLARIFICATION_REQUESTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE doc_category AS ENUM (
    'GST_CERTIFICATE',
    'PAN_CARD',
    'UDYAM_CERTIFICATE',
    'FINANCIAL_STATEMENT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 2. PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  role          user_role NOT NULL DEFAULT 'bidder',
  organization  TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TENDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_number     TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  department        TEXT NOT NULL,
  description       TEXT,
  required_docs     doc_category[] NOT NULL DEFAULT '{}',
  mandatory_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  closing_date      TIMESTAMPTZ NOT NULL,
  created_by        UUID REFERENCES public.profiles(id),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. BIDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bids (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id     UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  bidder_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        bid_status NOT NULL DEFAULT 'SUBMITTED',
  officer_remarks TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, bidder_id)
);

-- ============================================================
-- 5. BID DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bid_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id          UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  category        doc_category NOT NULL,
  file_name       TEXT NOT NULL,
  s3_key          TEXT NOT NULL,
  s3_bucket       TEXT NOT NULL,
  raw_ocr_text    TEXT,
  extracted_json  JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. COMPLIANCE REPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compliance_reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id            UUID UNIQUE REFERENCES public.bids(id) ON DELETE CASCADE,
  overall_score     NUMERIC(3, 2),          -- e.g., 0.85
  risk              risk_level NOT NULL DEFAULT 'HIGH',
  mandatory_passed  BOOLEAN NOT NULL DEFAULT FALSE,
  flags             JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasoning_trace   JSONB NOT NULL DEFAULT '[]'::jsonb,
  gov_api_payload   JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id      UUID REFERENCES public.bids(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  payload     JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. MOCK GOVERNMENT RECORDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mock_gov_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_type           TEXT NOT NULL,   -- 'GSTIN', 'PAN', 'UDYAM'
  id_value          TEXT NOT NULL,
  legal_name        TEXT NOT NULL,
  status            TEXT NOT NULL,   -- 'Active', 'Cancelled', 'Suspended'
  registration_date DATE,
  additional_data   JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_type, id_value)
);

-- ============================================================
-- 9. ROW-LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tenders (public read, officer write)
CREATE POLICY "Anyone can view active tenders" ON public.tenders
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Officers manage tenders" ON public.tenders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- Bids (bidders see own, officers see all)
CREATE POLICY "Bidders access own bids" ON public.bids
  FOR ALL USING (auth.uid() = bidder_id);
CREATE POLICY "Officers access all bids" ON public.bids
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- Bid Documents
CREATE POLICY "Bidders access own bid documents" ON public.bid_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.bids WHERE id = bid_id AND bidder_id = auth.uid())
  );
CREATE POLICY "Officers access all bid documents" ON public.bid_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- Compliance Reports (officers only)
CREATE POLICY "Officers view compliance reports" ON public.compliance_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- Audit Logs (officers read)
CREATE POLICY "Officers read audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'officer')
  );

-- ============================================================
-- 10. SEED MOCK GOV RECORDS
-- ============================================================
INSERT INTO public.mock_gov_records (id_type, id_value, legal_name, status, registration_date) VALUES
  ('GSTIN', '07AAAAA0000A1Z5', 'Acme Enterprises Private Limited', 'Active', '2018-04-01'),
  ('GSTIN', '27BBBBB1111B2Z6', 'Tech Solutions India Pvt Ltd', 'Active', '2019-06-15'),
  ('GSTIN', '29CCCCC2222C3Z7', 'BuildRight Construction Co', 'Cancelled', '2017-01-10'),
  ('GSTIN', '06DDDDD3333D4Z8', 'GreenTech Innovations LLP', 'Suspended', '2020-03-22'),
  ('PAN', 'AAAAA0000A', 'Acme Enterprises Private Limited', 'Active', '2015-08-12'),
  ('PAN', 'BBBBB1111B', 'Tech Solutions India Pvt Ltd', 'Active', '2016-05-30'),
  ('PAN', 'CCCCC2222C', 'BuildRight Construction Co', 'Active', '2014-11-20'),
  ('UDYAM', 'UDYAM-DL-01-0001234', 'Acme Enterprises Private Limited', 'Active', '2020-07-01'),
  ('UDYAM', 'UDYAM-MH-02-0005678', 'Tech Solutions India Pvt Ltd', 'Active', '2021-02-14'),
  ('UDYAM', 'UDYAM-KA-03-0009012', 'BuildRight Construction Co', 'Expired', '2019-09-05')
ON CONFLICT (id_type, id_value) DO NOTHING;

-- ============================================================
-- 11. SEED SAMPLE TENDERS
-- ============================================================
-- (Tenders are created by officers; sample data for dev purposes)
-- Note: Replace officer_uuid with actual officer user UUID after first login

-- ============================================================
-- 12. TRIGGERS for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_updated_at BEFORE UPDATE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 13. AUTO-CREATE PROFILE on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'bidder')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
