import { GoogleGenAI, Type } from '@google/genai';
import type {
  ExtractedDocumentData,
  ComplianceReport,
  GovVerificationResult,
  MandatoryCriterion,
} from '@/types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'placeholder' });

// ─── Extraction System Prompt ─────────────────────────────────
export const EXTRACTION_SYSTEM_PROMPT = `
You are an expert procurement document parsing assistant for the Government of India's GeM (Government e-Marketplace) platform.
Extract structured information from the provided raw OCR text of official government/business documents.
Return ONLY valid JSON matching the requested schema. If a field is missing or illegible, set its value to null.
Do not hallucinate or guess. Be conservative and precise.
`.trim();

// ─── Compliance Evaluation Prompt ────────────────────────────
export const COMPLIANCE_EVALUATION_PROMPT = `
You are an expert AI Procurement Compliance Auditor evaluating a tender submission for the Government of India's GeM platform.
Compare the Extracted Document Data against the Official Government Database Data and Tender Mandatory Criteria.

Analyze for:
1. Exact or partial mismatches in Legal Name, Tax IDs, and Registration Status.
2. Inactive, expired, suspended, or cancelled registration statuses.
3. Unmet mandatory tender requirements (turnover, experience, certifications).
4. Cross-document consistency (same entity name across all documents).

Scoring:
- Start at 1.00. Deduct 0.30 for each CRITICAL flag, 0.10 for each WARNING.
- mandatory_passed = false if any CRITICAL flag exists or mandatory criteria unmet.

Produce a detailed step-by-step reasoning trace explaining how you evaluated each check.
`.trim();

// ─── Extraction Schema ────────────────────────────────────────
const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    document_category: {
      type: Type.STRING,
      enum: ['GST_CERTIFICATE', 'PAN_CARD', 'UDYAM_CERTIFICATE', 'FINANCIAL_STATEMENT', 'OTHER'],
    },
    legal_name: { type: Type.STRING, nullable: true },
    identification_number: { type: Type.STRING, nullable: true },
    registration_date: { type: Type.STRING, nullable: true },
    status_mentioned: { type: Type.STRING, nullable: true },
    extracted_fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field_key: { type: Type.STRING },
          field_value: { type: Type.STRING },
          confidence_explanation: { type: Type.STRING },
        },
        required: ['field_key', 'field_value', 'confidence_explanation'],
      },
    },
  },
  required: ['document_category', 'legal_name', 'identification_number'],
};

// ─── Compliance Schema ────────────────────────────────────────
const complianceSchema = {
  type: Type.OBJECT,
  properties: {
    overall_score: { type: Type.NUMBER },
    risk: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'] },
    mandatory_passed: { type: Type.BOOLEAN },
    flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ['CRITICAL', 'WARNING', 'INFO'] },
          field: { type: Type.STRING },
          pdf_value: { type: Type.STRING },
          gov_value: { type: Type.STRING },
          issue_description: { type: Type.STRING },
        },
        required: ['severity', 'field', 'pdf_value', 'gov_value', 'issue_description'],
      },
    },
    reasoning_trace: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step_number: { type: Type.INTEGER },
          check_name: { type: Type.STRING },
          finding: { type: Type.STRING },
          passed: { type: Type.BOOLEAN },
        },
        required: ['step_number', 'check_name', 'finding', 'passed'],
      },
    },
  },
  required: ['overall_score', 'risk', 'mandatory_passed', 'flags', 'reasoning_trace'],
};

// ─── Extract document fields from raw OCR text ───────────────
export async function extractDocumentFields(
  rawOcrText: string,
  category: string
): Promise<ExtractedDocumentData> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: EXTRACTION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: extractionSchema,
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Document Category Hint: ${category}\n\nRaw OCR Text:\n\`\`\`\n${rawOcrText}\n\`\`\`\n\nExtract all structured fields from this document.`,
          },
        ],
      },
    ],
  });

  const text = response.text ?? '{}';
  return JSON.parse(text) as ExtractedDocumentData;
}

// ─── Run compliance evaluation ────────────────────────────────
export async function evaluateCompliance(params: {
  extractedDocs: ExtractedDocumentData[];
  govRecords: Record<string, GovVerificationResult>;
  mandatoryCriteria: MandatoryCriterion[];
}): Promise<Omit<ComplianceReport, 'id' | 'bid_id' | 'created_at'>> {
  const { extractedDocs, govRecords, mandatoryCriteria } = params;

  const prompt = `
Evaluate the following tender bid for compliance.

## Extracted Document Data (from OCR + AI):
${JSON.stringify(extractedDocs, null, 2)}

## Official Government Database Records:
${JSON.stringify(govRecords, null, 2)}

## Mandatory Tender Criteria:
${JSON.stringify(mandatoryCriteria, null, 2)}

Perform a thorough compliance check and return your analysis.
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: COMPLIANCE_EVALUATION_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: complianceSchema,
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const text = response.text ?? '{}';
  const result = JSON.parse(text);

  return {
    overall_score: result.overall_score,
    risk: result.risk,
    mandatory_passed: result.mandatory_passed,
    flags: result.flags || [],
    reasoning_trace: result.reasoning_trace || [],
    gov_api_payload: govRecords,
  };
}
