# GeM Bid Compliance & Technical Evaluation System 🇮🇳

> **AI-Powered Automated Tender Compliance Engine** built for Smart India Hackathon (SIH 2025).  
> Features dual-role authentication (Bidder / Officer), automated multi-document OCR extraction via AWS Textract, Gemini 2.0 Flash AI compliance evaluation, cross-reference triangulation against Government APIs (GST, MCA, MSME), and an interactive 3-column Officer Review Workspace with audit logging.

---

## 🎨 UI & Design System

Built using **UX4G (User Experience for Government) Design System 3.0**:
- **Official Color Palette**: Deep Navy (`#003580`), Saffron Accent (`#FF6600`), Emerald Success (`#0D8A54`), Crimson Alert (`#D32F2F`)
- **Typography**: Noto Sans / Inter
- **Accessibility**: High contrast ratio, WCAG 2.1 compliance indicators, standard Government of India header/footer bars

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14/15 (App Router, TypeScript, Server Components) |
| **Authentication & DB** | Supabase (PostgreSQL, Row Level Security, Auth, Realtime) |
| **Storage & OCR** | AWS S3 + AWS Textract (Form Analysis & Key-Value Pair Extraction) |
| **AI Evaluation Engine** | Google Gemini API (`gemini-2.0-flash` with Structured JSON Schema) |
| **Gov Data Verification** | Hybrid Government API Adapter (Sandbox API / Mock Data toggle) |
| **UI Components** | Custom UX4G Vanilla CSS Design System, Lucide Icons, Recharts |

---

## 🚀 Key Features

1. **Dual-Role Portal**:
   - **Bidder**: Interactive document checklist uploader per category (Financials, Technical Specs, Registrations), compliance readiness score indicator.
   - **Officer**: High-density tender submission table, risk level filtering, real-time audit logs.

2. **3-Column Officer Review Workspace**:
   - **Left Column**: PDF/Document viewer with tabbed document selector and S3 presigned URL support.
   - **Middle Column**: 3-Way Triangulation Table comparing **Bidder Submitted Data** vs **OCR Extracted Fields** vs **Official Gov Registry Records** (GSTIN, MCA, MSME). Displays Step-by-Step AI Reasoning Trace.
   - **Right Column**: Visual Compliance Gauge, Discrepancy & Flag List (High/Medium/Low priority), Executive Action Panel (Approve, Reject with mandatory justification, Request Clarification).

3. **Automated Verification Pipeline**:
   - Multi-document upload $\rightarrow$ AWS Textract OCR $\rightarrow$ Gemini 2.0 Flash Extraction $\rightarrow$ Govt Registry Verification $\rightarrow$ Gemini Compliance Analysis $\rightarrow$ Comprehensive Report Generation.

---

## 🗄️ Database Setup (Supabase)

1. Navigate to your Supabase project's **SQL Editor**.
2. Copy and execute the contents of [`supabase/schema.sql`](./supabase/schema.sql).
3. This sets up:
   - Tables: `profiles`, `tenders`, `bids`, `bid_documents`, `compliance_reports`, `discrepancy_flags`, `audit_logs`
   - Automated triggers for user profile creation on signup
   - Row Level Security (RLS) policies for Bidder and Officer access
   - Initial Seed Data for sample tenders and mock officers/bidders

---

## ⚙️ Environment Variables Setup

Copy `.env.local` or populate the following keys:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AWS S3 & Textract
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=gem-bid-compliance-docs

# Gemini AI API
GEMINI_API_KEY=your-gemini-api-key

# App & Mock Gov Data Settings
USE_MOCK_GOV_DATA=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
SANDBOX_API_KEY=
SANDBOX_ACCESS_TOKEN=
```

---

## 💻 Getting Started Locally

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

# 3. Open browser at
http://localhost:3000
```

---

## 📁 Project Structure

```
gem-bid-compliance/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── mock-gov/         # Mock GSTIN/MCA/MSME verification endpoint
│   │   │   ├── officer-action/   # Approve/Reject/Clarify logic + audit trail
│   │   │   ├── process-bid/      # Full OCR -> Gemini -> Gov -> Report pipeline
│   │   │   ├── tenders/          # Tender management API
│   │   │   └── upload-bid/       # AWS S3 document upload handler
│   │   ├── dashboard/
│   │   │   ├── bidder/           # Bidder dashboard & multi-doc upload UI
│   │   │   └── officer/          # Officer submission portal & 3-column review UI
│   │   ├── login/                # Dual-role signup & login page
│   │   ├── globals.css           # UX4G Design System 3.0 CSS tokens & styles
│   │   └── layout.tsx            # Global layout wrapper
│   ├── components/
│   │   ├── layout/               # UX4G Header, GovBar, Navigation
│   │   ├── BidUploader.tsx       # Document upload component
│   │   └── OfficerReviewPanel.tsx# 3-column interactive evaluation workspace
│   ├── lib/
│   │   ├── services/
│   │   │   ├── gemini.ts         # Gemini 2.0 Flash AI extraction & compliance engine
│   │   │   ├── govAdapter.ts     # GST/MCA/MSME verification service
│   │   │   └── textract.ts       # AWS Textract & S3 file management
│   │   └── supabase/             # Supabase client & server SDK instances
│   ├── middleware.ts             # Role-based route guard middleware
│   └── types/                    # TypeScript interfaces & types
├── supabase/
│   └── schema.sql                # Complete PostgreSQL DB Schema & Seed Data
└── README.md
```

---

## ⚖️ License & Credits

Developed for **Smart India Hackathon 2025** - Technical Evaluation & Compliance System for Government e-Marketplace (GeM).
