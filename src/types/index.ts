// ============================================================
// GeM Bid Compliance Platform — Shared TypeScript Types
// ============================================================

export type UserRole = 'bidder' | 'officer';
export type BidStatus =
  | 'SUBMITTED'
  | 'OCR_PROCESSING'
  | 'EXTRACTION_DONE'
  | 'GOV_VERIFIED'
  | 'REPORT_READY'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLARIFICATION_REQUESTED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type DocCategory =
  | 'GST_CERTIFICATE'
  | 'PAN_CARD'
  | 'UDYAM_CERTIFICATE'
  | 'FINANCIAL_STATEMENT'
  | 'OTHER';

export type FlagSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

// ============================================================
// Database Row Types
// ============================================================

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  organization?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Tender {
  id: string;
  tender_number: string;
  title: string;
  department: string;
  description?: string;
  required_docs: DocCategory[];
  mandatory_criteria: MandatoryCriterion[];
  closing_date: string;
  created_by?: string;
  is_active: boolean;
  created_at: string;
}

export interface MandatoryCriterion {
  key: string;
  label: string;
  required_value?: string;
}

export interface Bid {
  id: string;
  tender_id: string;
  bidder_id: string;
  status: BidStatus;
  officer_remarks?: string;
  submitted_at: string;
  updated_at: string;
  // Joined
  tender?: Tender;
  bidder?: Profile;
  compliance_report?: ComplianceReport;
}

export interface BidDocument {
  id: string;
  bid_id: string;
  category: DocCategory;
  file_name: string;
  s3_key: string;
  s3_bucket: string;
  raw_ocr_text?: string;
  extracted_json?: ExtractedDocumentData;
  created_at: string;
}

export interface ExtractedDocumentData {
  document_category: DocCategory;
  legal_name: string | null;
  identification_number: string | null;
  registration_date: string | null;
  status_mentioned: string | null;
  extracted_fields: ExtractedField[];
}

export interface ExtractedField {
  field_key: string;
  field_value: string;
  confidence_explanation: string;
}

export interface ComplianceFlag {
  severity: FlagSeverity;
  field: string;
  pdf_value: string;
  gov_value: string;
  issue_description: string;
}

export interface ReasoningStep {
  step_number: number;
  check_name: string;
  finding: string;
  passed: boolean;
}

export interface ComplianceReport {
  id: string;
  bid_id: string;
  overall_score: number;
  risk: RiskLevel;
  mandatory_passed: boolean;
  flags: ComplianceFlag[];
  reasoning_trace: ReasoningStep[];
  gov_api_payload: Record<string, GovVerificationResult>;
  created_at: string;
}

// ============================================================
// Service Types
// ============================================================

export interface GovVerificationResult {
  id_type: string;
  id_value: string;
  legal_name: string;
  status: string;
  registration_date?: string;
  raw_payload: Record<string, unknown>;
}

export interface DataTriangulationRow {
  field_name: string;
  pdf_value: string;
  gov_value: string;
  match_status: 'EXACT' | 'MINOR_DISCREPANCY' | 'CRITICAL_MISMATCH' | 'MISSING';
}

// ============================================================
// API Payload Types
// ============================================================

export interface ProcessBidPayload {
  bid_id: string;
}

export interface ProcessBidResponse {
  success: boolean;
  bid_id: string;
  report?: ComplianceReport;
  error?: string;
}

// ============================================================
// UI State Types
// ============================================================

export interface UploadedFile {
  category: DocCategory;
  file: File;
  preview_url: string;
}

export const BID_STATUS_LABELS: Record<BidStatus, string> = {
  SUBMITTED: 'Submitted',
  OCR_PROCESSING: 'OCR Processing',
  EXTRACTION_DONE: 'Extraction Done',
  GOV_VERIFIED: 'Gov. Verified',
  REPORT_READY: 'Report Ready',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CLARIFICATION_REQUESTED: 'Clarification Required',
};

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  GST_CERTIFICATE: 'GST Certificate',
  PAN_CARD: 'PAN Card',
  UDYAM_CERTIFICATE: 'Udyam Registration Certificate',
  FINANCIAL_STATEMENT: 'Financial Statement',
  OTHER: 'Other Document',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#28A745',
  MEDIUM: '#FFC107',
  HIGH: '#DC3545',
};
