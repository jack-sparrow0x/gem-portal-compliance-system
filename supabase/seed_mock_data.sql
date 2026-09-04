-- ============================================================
-- GeM Bid Compliance Platform — Fresh Mock Data Seed Script
-- Run this in: Supabase Dashboard → SQL Editor (AFTER schema.sql)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  officer_id UUID := '11111111-1111-1111-1111-111111111111';
  bidder1_id UUID := '22222222-2222-2222-2222-222222222222';
  bidder2_id UUID := '33333333-3333-3333-3333-333333333333';
  tender1_id UUID := 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  tender2_id UUID := 'b2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  tender3_id UUID := 'e5555555-eeee-eeee-eeee-eeeeeeeeeeee';
  bid1_id    UUID := 'c3333333-cccc-cccc-cccc-cccccccccccc';
  bid2_id    UUID := 'd4444444-dddd-dddd-dddd-dddddddddddd';
  bid3_id    UUID := 'f6666666-ffff-ffff-ffff-ffffffffffff';
BEGIN

  -- ─── 0. CLEANUP PREVIOUS TEST ACCOUNTS ────────────────────────────────────
  DELETE FROM auth.identities WHERE provider_id IN ('officer@gem.gov.in', 'bidder@acme.com', 'bidder@techsolutions.in');
  DELETE FROM auth.users WHERE email IN ('officer@gem.gov.in', 'bidder@acme.com', 'bidder@techsolutions.in');

  -- ─── 1. TEST ACCOUNTS (auth.users & auth.identities) ──────────────────────

  -- 1A. Officer Account (officer@gem.gov.in / Password123!)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    officer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'officer@gem.gov.in', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dr. Rajesh Kumar","role":"officer","organization":"Ministry of Commerce & Industry"}',
    NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    officer_id, officer_id, jsonb_build_object('sub', officer_id::text, 'email', 'officer@gem.gov.in'),
    'email', NOW(), NOW(), NOW(), 'officer@gem.gov.in'
  );

  -- 1B. Bidder 1 Account (bidder@acme.com / Password123!)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    bidder1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bidder@acme.com', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Suresh Sharma","role":"bidder","organization":"Acme Enterprises Private Limited"}',
    NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    bidder1_id, bidder1_id, jsonb_build_object('sub', bidder1_id::text, 'email', 'bidder@acme.com'),
    'email', NOW(), NOW(), NOW(), 'bidder@acme.com'
  );

  -- 1C. Bidder 2 Account (bidder@techsolutions.in / Password123!)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    bidder2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bidder@techsolutions.in', crypt('Password123!', gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Priya Patel","role":"bidder","organization":"Tech Solutions India Pvt Ltd"}',
    NOW(), NOW()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    bidder2_id, bidder2_id, jsonb_build_object('sub', bidder2_id::text, 'email', 'bidder@techsolutions.in'),
    'email', NOW(), NOW(), NOW(), 'bidder@techsolutions.in'
  );

  -- ─── 2. USER PROFILES ───────────────────────────────────────────────────
  INSERT INTO public.profiles (id, email, full_name, role, organization) VALUES
    (officer_id, 'officer@gem.gov.in', 'Dr. Rajesh Kumar', 'officer', 'Ministry of Commerce & Industry (GeM)'),
    (bidder1_id, 'bidder@acme.com', 'Suresh Sharma', 'bidder', 'Acme Enterprises Private Limited'),
    (bidder2_id, 'bidder@techsolutions.in', 'Priya Patel', 'bidder', 'Tech Solutions India Pvt Ltd')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, role = EXCLUDED.role, organization = EXCLUDED.organization;

  -- ─── 3. MOCK GOVERNMENT VERIFICATION RECORDS ──────────────────────────────
  INSERT INTO public.mock_gov_records (id_type, id_value, legal_name, status, registration_date) VALUES
    ('GSTIN', '07AAAAA0000A1Z5', 'Acme Enterprises Private Limited', 'Active', '2018-04-01'),
    ('GSTIN', '27BBBBB1111B2Z6', 'Tech Solutions India Pvt Ltd', 'Suspended', '2019-06-15'),
    ('PAN', 'AAAAA0000A', 'Acme Enterprises Private Limited', 'Active', '2015-08-12'),
    ('PAN', 'BBBBB1111B', 'Tech Solutions India Pvt Ltd', 'Active', '2016-05-30'),
    ('UDYAM', 'UDYAM-DL-01-0001234', 'Acme Enterprises Private Limited', 'Active', '2020-07-01'),
    ('UDYAM', 'UDYAM-MH-02-0005678', 'Tech Solutions India Pvt Ltd', 'Expired', '2021-02-14')
  ON CONFLICT (id_type, id_value) DO NOTHING;

  -- ─── 4. TENDERS ──────────────────────────────────────────────────────────
  INSERT INTO public.tenders (
    id, tender_number, title, department, description, required_docs, mandatory_criteria, closing_date, created_by, is_active
  ) VALUES (
    tender1_id, 'GEM/2025/B/9823401',
    'Procurement of High-Performance Laptops & Desktop Workstations',
    'Ministry of Electronics & IT',
    'Supply, installation, and 3-year warranty for 500 laptops and 200 workstations for Central Ministries across New Delhi.',
    ARRAY['GST_CERTIFICATE', 'PAN_CARD', 'UDYAM_CERTIFICATE', 'FINANCIAL_STATEMENT']::doc_category[],
    '[
      {"category": "GST_CERTIFICATE", "requirement": "Must have an Active GSTIN registration in Delhi NCR or relevant state."},
      {"category": "PAN_CARD", "requirement": "Valid Company PAN matching bidder legal name."},
      {"category": "UDYAM_CERTIFICATE", "requirement": "Valid MSME/Udyam Certificate for Class I/II Local Supplier preference."},
      {"category": "FINANCIAL_STATEMENT", "requirement": "Minimum average annual turnover of Rs. 1.5 Crores for the last 3 financial years."}
    ]'::jsonb,
    NOW() + INTERVAL '15 days', officer_id, TRUE
  ), (
    tender2_id, 'GEM/2025/B/9824105',
    'Supply, Installation & Maintenance of 100 kW Solar Rooftop System',
    'Ministry of New & Renewable Energy',
    'Turnkey contract for design, supply, testing, and 5-year comprehensive AMC of 100 kW Grid-Connected Solar Rooftop PV System.',
    ARRAY['GST_CERTIFICATE', 'PAN_CARD', 'FINANCIAL_STATEMENT']::doc_category[],
    '[
      {"category": "GST_CERTIFICATE", "requirement": "Active GSTIN registration."},
      {"category": "PAN_CARD", "requirement": "Company PAN card."},
      {"category": "FINANCIAL_STATEMENT", "requirement": "Audited balance sheet showing net positive worth for last 3 years."}
    ]'::jsonb,
    NOW() + INTERVAL '30 days', officer_id, TRUE
  ), (
    tender3_id, 'GEM/2025/B/9825590',
    'Annual Maintenance Contract (AMC) for Central Data Center Infrastructure',
    'National Informatics Centre (NIC)',
    'Comprehensive 24/7 technical support and maintenance of server Racks, UPS units, and cooling systems.',
    ARRAY['GST_CERTIFICATE', 'PAN_CARD', 'OTHER']::doc_category[],
    '[
      {"category": "GST_CERTIFICATE", "requirement": "Active GSTIN registration."},
      {"category": "OTHER", "requirement": "OEM Authorization Certificate for Data Center Hardware."}
    ]'::jsonb,
    NOW() + INTERVAL '45 days', officer_id, TRUE
  ) ON CONFLICT (id) DO NOTHING;

  -- ─── 5. BIDS ─────────────────────────────────────────────────────────────
  INSERT INTO public.bids (id, tender_id, bidder_id, status, officer_remarks, submitted_at) VALUES
  (
    bid1_id, tender1_id, bidder1_id, 'REPORT_READY', 'All documents submitted and verified.', NOW() - INTERVAL '2 days'
  ),
  (
    bid2_id, tender1_id, bidder2_id, 'REPORT_READY', 'GST Status flagged as Suspended on GSTIN portal.', NOW() - INTERVAL '1 day'
  ),
  (
    bid3_id, tender2_id, bidder1_id, 'SUBMITTED', 'Bid submitted by bidder, awaiting review.', NOW() - INTERVAL '3 hours'
  ) ON CONFLICT (id) DO NOTHING;

  -- ─── 6. BID DOCUMENTS ───────────────────────────────────────────────────
  INSERT INTO public.bid_documents (bid_id, category, file_name, s3_key, s3_bucket, raw_ocr_text, extracted_json) VALUES
  (
    bid1_id, 'GST_CERTIFICATE', 'Acme_GST_Registration_Certificate.pdf', 'demo/acme_gst.pdf', 'gem-bid-compliance-docs',
    'GOVERNMENT OF INDIA - GOODS AND SERVICES TAX REGISTRATION CERTIFICATE. GSTIN: 07AAAAA0000A1Z5. Legal Name: Acme Enterprises Private Limited. Status: Active. Date of Issue: 01/04/2018.',
    '{"document_category": "GST_CERTIFICATE", "legal_name": "Acme Enterprises Private Limited", "identification_number": "07AAAAA0000A1Z5", "issue_date": "2018-04-01", "confidence_score": 0.98}'::jsonb
  ),
  (
    bid1_id, 'PAN_CARD', 'Acme_Company_PAN.pdf', 'demo/acme_pan.pdf', 'gem-bid-compliance-docs',
    'INCOME TAX DEPARTMENT - GOVT OF INDIA. Permanent Account Number: AAAAA0000A. Name: Acme Enterprises Private Limited. Date of Incorporation: 12/08/2015.',
    '{"document_category": "PAN_CARD", "legal_name": "Acme Enterprises Private Limited", "identification_number": "AAAAA0000A", "issue_date": "2015-08-12", "confidence_score": 0.99}'::jsonb
  ),
  (
    bid1_id, 'UDYAM_CERTIFICATE', 'Acme_Udyam_MSME_Certificate.pdf', 'demo/acme_udyam.pdf', 'gem-bid-compliance-docs',
    'UDYAM REGISTRATION CERTIFICATE. Udyam Registration Number: UDYAM-DL-01-0001234. Enterprise Name: Acme Enterprises Private Limited.',
    '{"document_category": "UDYAM_CERTIFICATE", "legal_name": "Acme Enterprises Private Limited", "identification_number": "UDYAM-DL-01-0001234", "issue_date": "2020-07-01", "confidence_score": 0.96}'::jsonb
  ),
  (
    bid2_id, 'GST_CERTIFICATE', 'TechSolutions_GST_Cert.pdf', 'demo/tech_gst.pdf', 'gem-bid-compliance-docs',
    'GOODS AND SERVICES TAX REGISTRATION. GSTIN: 27BBBBB1111B2Z6. Legal Name: Tech Solutions India Pvt Ltd. Status: Active on Doc.',
    '{"document_category": "GST_CERTIFICATE", "legal_name": "Tech Solutions India Pvt Ltd", "identification_number": "27BBBBB1111B2Z6", "issue_date": "2019-06-15", "confidence_score": 0.94}'::jsonb
  ),
  (
    bid2_id, 'PAN_CARD', 'TechSolutions_PAN.pdf', 'demo/tech_pan.pdf', 'gem-bid-compliance-docs',
    'INCOME TAX DEPARTMENT. Permanent Account Number: BBBBB1111B. Name: Tech Solutions India Pvt Ltd.',
    '{"document_category": "PAN_CARD", "legal_name": "Tech Solutions India Pvt Ltd", "identification_number": "BBBBB1111B", "issue_date": "2016-05-30", "confidence_score": 0.97}'::jsonb
  );

  -- ─── 7. COMPLIANCE REPORTS ───────────────────────────────────────────────
  INSERT INTO public.compliance_reports (bid_id, overall_score, risk, mandatory_passed, flags, reasoning_trace, created_at) VALUES (
    bid1_id, 0.92, 'LOW', TRUE,
    '[
      {"category": "GST_CERTIFICATE", "field": "Legal Name", "pdf_value": "Acme Enterprises Private Limited", "gov_value": "Acme Enterprises Private Limited", "severity": "LOW", "explanation": "Legal name matches official GST database record exactly."},
      {"category": "GST_CERTIFICATE", "field": "GST Status", "pdf_value": "Active", "gov_value": "Active", "severity": "LOW", "explanation": "GSTIN 07AAAAA0000A1Z5 is Active in Government registry."}
    ]'::jsonb,
    '[
      {"step_number": 1, "check_name": "GSTIN Legal Name Matching", "finding": "Extracted name Acme Enterprises Private Limited matches Gov GSTIN database record exactly.", "passed": true},
      {"step_number": 2, "check_name": "GSTIN Active Status Check", "finding": "GSTIN 07AAAAA0000A1Z5 status is ACTIVE in Government portal.", "passed": true},
      {"step_number": 3, "check_name": "PAN Verification", "finding": "PAN AAAAA0000A verified active and linked to legal entity.", "passed": true},
      {"step_number": 4, "check_name": "MSME Udyam Status", "finding": "Udyam Certificate UDYAM-DL-01-0001234 is active.", "passed": true}
    ]'::jsonb,
    NOW() - INTERVAL '2 days'
  ) ON CONFLICT (bid_id) DO NOTHING;

  INSERT INTO public.compliance_reports (bid_id, overall_score, risk, mandatory_passed, flags, reasoning_trace, created_at) VALUES (
    bid2_id, 0.58, 'HIGH', FALSE,
    '[
      {"category": "GST_CERTIFICATE", "field": "GST Registration Status", "pdf_value": "Active", "gov_value": "Suspended", "severity": "CRITICAL", "explanation": "GSTIN 27BBBBB1111B2Z6 is currently SUSPENDED on the official GST portal due to non-filing."},
      {"category": "UDYAM_CERTIFICATE", "field": "Udyam Expiry", "pdf_value": "UDYAM-MH-02-0005678", "gov_value": "Expired", "severity": "MEDIUM", "explanation": "Udyam certificate registration has expired in the MSME registry."}
    ]'::jsonb,
    '[
      {"step_number": 1, "check_name": "GSTIN Legal Name Matching", "finding": "Extracted legal name matches PAN record.", "passed": true},
      {"step_number": 2, "check_name": "GSTIN Active Status Check", "finding": "CRITICAL MISMATCH: GSTIN 27BBBBB1111B2Z6 status is SUSPENDED on Government GST portal.", "passed": false},
      {"step_number": 3, "check_name": "MSME Udyam Validity Check", "finding": "Udyam registration is listed as EXPIRED in MSME database.", "passed": false}
    ]'::jsonb,
    NOW() - INTERVAL '1 day'
  ) ON CONFLICT (bid_id) DO NOTHING;

END $$;
