-- ============================================================
-- GeM Bid Compliance Platform — Master Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 0. EXTENSIONS & CLEANUP ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.compliance_reports CASCADE;
DROP TABLE IF EXISTS public.bid_documents CASCADE;
DROP TABLE IF EXISTS public.bids CASCADE;
DROP TABLE IF EXISTS public.tenders CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.mock_gov_records CASCADE;

-- ─── 1. ENUMS ─────────────────────────────────────────────────────────────
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

-- ─── 2. TABLES ────────────────────────────────────────────────────────────

-- 2A. Profiles Table (Extends auth.users)
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  role          user_role NOT NULL DEFAULT 'bidder',
  organization  TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2B. Tenders Table
CREATE TABLE public.tenders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_number      TEXT UNIQUE NOT NULL,
  title              TEXT NOT NULL,
  department         TEXT NOT NULL,
  description        TEXT,
  required_docs      doc_category[] NOT NULL DEFAULT '{}',
  mandatory_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  closing_date       TIMESTAMPTZ NOT NULL,
  created_by         UUID REFERENCES public.profiles(id),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 2C. Bids Table
CREATE TABLE public.bids (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id       UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  bidder_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          bid_status NOT NULL DEFAULT 'SUBMITTED',
  officer_remarks TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tender_id, bidder_id)
);

-- 2D. Bid Documents Table
CREATE TABLE public.bid_documents (
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

-- 2E. Compliance Reports Table
CREATE TABLE public.compliance_reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id            UUID UNIQUE REFERENCES public.bids(id) ON DELETE CASCADE,
  overall_score     NUMERIC(3, 2),
  risk              risk_level NOT NULL DEFAULT 'HIGH',
  mandatory_passed  BOOLEAN NOT NULL DEFAULT FALSE,
  flags             JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasoning_trace   JSONB NOT NULL DEFAULT '[]'::jsonb,
  gov_api_payload   JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2F. Audit Logs Table
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_id      UUID REFERENCES public.bids(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES public.profiles(id),
  action      TEXT NOT NULL,
  payload     JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2G. Mock Government Registry Records Table
CREATE TABLE public.mock_gov_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_type           TEXT NOT NULL,
  id_value          TEXT NOT NULL,
  legal_name        TEXT NOT NULL,
  status            TEXT NOT NULL,
  registration_date DATE,
  additional_data   JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_type, id_value)
);

-- ─── 3. ROW LEVEL SECURITY (RLS) ──────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Non-recursive SECURITY DEFINER helper function
CREATE OR REPLACE FUNCTION public.is_officer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'officer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Officers read all profiles" ON public.profiles FOR SELECT USING (public.is_officer());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Tenders Policies
CREATE POLICY "Anyone can view active tenders" ON public.tenders FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Officers manage tenders" ON public.tenders FOR ALL USING (public.is_officer());

-- Bids Policies
CREATE POLICY "Bidders access own bids" ON public.bids FOR ALL USING (auth.uid() = bidder_id);
CREATE POLICY "Officers access all bids" ON public.bids FOR ALL USING (public.is_officer());

-- Bid Documents Policies
CREATE POLICY "Bidders access own bid documents" ON public.bid_documents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.bids WHERE id = bid_id AND bidder_id = auth.uid())
);
CREATE POLICY "Officers access all bid documents" ON public.bid_documents FOR SELECT USING (public.is_officer());

-- Compliance Reports Policies
CREATE POLICY "Officers view compliance reports" ON public.compliance_reports FOR SELECT USING (public.is_officer());

-- Audit Logs Policies
CREATE POLICY "Officers read audit logs" ON public.audit_logs FOR SELECT USING (public.is_officer());

-- ─── 4. TRIGGERS & FUNCTIONS ──────────────────────────────────────────────
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

-- Auto create profile on Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role public.user_role;
BEGIN
  BEGIN
    assigned_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    assigned_role := 'bidder'::public.user_role;
  END;

  IF assigned_role IS NULL THEN
    assigned_role := 'bidder'::public.user_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, organization)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
    assigned_role,
    NEW.raw_user_meta_data->>'organization'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    organization = EXCLUDED.organization;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.email, 'User'), 'bidder')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
