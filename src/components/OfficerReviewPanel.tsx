'use client';

import { useState } from 'react';
import type { Bid, BidDocument, ComplianceReport, ComplianceFlag, ReasoningStep, GovVerificationResult, ExtractedDocumentData } from '@/types';
import { DOC_CATEGORY_LABELS } from '@/types';

// ─── Compliance Score Gauge ───────────────────────────────────
function ComplianceGauge({ score, risk }: { score: number; risk: string }) {
  const pct = Math.round(score * 100);
  const radius = 58;
  const circ = 2 * Math.PI * radius;
  const strokeDash = (pct / 100) * circ;

  const riskColor = risk === 'LOW' ? '#28A745' : risk === 'MEDIUM' ? '#FFC107' : '#DC3545';

  return (
    <div className="compliance-gauge-wrapper">
      <div className="gauge-circle" style={{ width: 150, height: 150 }}>
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#e9ecef" strokeWidth="12" />
          <circle
            cx="75" cy="75" r={radius} fill="none"
            stroke={riskColor} strokeWidth="12"
            strokeDasharray={`${strokeDash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="gauge-circle__value">
          <span className="gauge-score" style={{ color: riskColor }}>{pct}%</span>
          <span className="gauge-label">Compliance</span>
        </div>
      </div>
      <span className={`badge badge-dot risk-${risk}`} style={{ fontSize: '14px', padding: '6px 16px' }}>
        {risk} RISK
      </span>
    </div>
  );
}

// ─── Reasoning Trace List ─────────────────────────────────────
function ReasoningTrace({ steps }: { steps: ReasoningStep[] }) {
  return (
    <div className="trace-list">
      {steps.map((step) => (
        <div key={step.step_number} className={`trace-item ${step.passed ? 'passed' : 'failed'}`}>
          <div className="trace-item__step">{step.passed ? '✓' : '✗'}</div>
          <div>
            <div className="trace-item__check">Step {step.step_number}: {step.check_name}</div>
            <div className="trace-item__finding">{step.finding}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Flags List ───────────────────────────────────────────────
function FlagsList({ flags }: { flags: ComplianceFlag[] }) {
  if (flags.length === 0) {
    return (
      <div className="alert alert-success" style={{ fontSize: '13px' }}>
        ✅ No compliance flags detected. All checks passed.
      </div>
    );
  }

  return (
    <div className="flag-list">
      {flags.map((flag, i) => (
        <div key={i} className={`flag-card ${flag.severity}`}>
          <div className="flag-card__header">
            <span className="flag-card__field">⚠ {flag.field}</span>
            <span className={`badge ${flag.severity === 'CRITICAL' ? 'badge-danger' : flag.severity === 'WARNING' ? 'badge-warning' : 'badge-info'}`}>
              {flag.severity}
            </span>
          </div>
          <div className="flag-card__values">
            <span>📄 PDF: <strong>{flag.pdf_value}</strong></span>
            <span>🏛 Gov: <strong>{flag.gov_value}</strong></span>
          </div>
          <div className="flag-card__desc">{flag.issue_description}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Data Triangulation Table ─────────────────────────────────
function DataTriangulationTable({
  documents,
  report,
}: {
  documents: (BidDocument & { presigned_url: string | null })[];
  report: ComplianceReport | null;
}) {
  type MatchStatus = 'EXACT' | 'MINOR_DISCREPANCY' | 'CRITICAL_MISMATCH' | 'MISSING';

  if (!report) {
    return (
      <div className="doc-viewer-placeholder">
        <span style={{ fontSize: '36px' }}>⏳</span>
        <span style={{ fontWeight: 600 }}>Analysis Pending</span>
        <span style={{ fontSize: '13px', color: 'var(--ux4g-gray-500)' }}>
          The AI compliance report has not been generated yet.
        </span>
      </div>
    );
  }

  // Build triangulation rows from flags + gov payload
  type Row = {
    field_name: string;
    pdf_value: string;
    gov_value: string;
    match: MatchStatus;
  };

  const rows: Row[] = report.flags.map((f) => ({
    field_name: f.field,
    pdf_value: f.pdf_value,
    gov_value: f.gov_value,
    match: f.severity === 'CRITICAL' ? 'CRITICAL_MISMATCH' : 'MINOR_DISCREPANCY',
  }));

  // Add extracted fields that passed (not in flags)
  const flaggedFields = new Set(report.flags.map((f) => f.field));
  documents.forEach((doc) => {
    if (!doc.extracted_json) return;
    const ext = doc.extracted_json as ExtractedDocumentData;
    if (ext.legal_name && !flaggedFields.has('Legal Name')) {
      rows.push({ field_name: 'Legal Name', pdf_value: ext.legal_name, gov_value: ext.legal_name, match: 'EXACT' });
    }
    if (ext.identification_number && !flaggedFields.has(ext.document_category + ' ID')) {
      rows.push({ field_name: `${ext.document_category} ID`, pdf_value: ext.identification_number, gov_value: ext.identification_number, match: 'EXACT' });
    }
  });

  const matchIcon = (m: MatchStatus) => {
    if (m === 'EXACT') return <span className="match-exact">✔ Exact Match</span>;
    if (m === 'MINOR_DISCREPANCY') return <span className="match-minor">⚠ Minor Discrepancy</span>;
    if (m === 'CRITICAL_MISMATCH') return <span className="match-critical">✘ Critical Mismatch</span>;
    return <span className="match-missing">— Missing</span>;
  };

  return (
    <div className="table-wrapper triangulation-table">
      <table>
        <thead>
          <tr>
            <th>Field Name</th>
            <th>Extracted from PDF</th>
            <th>Gov. Database Record</th>
            <th>Match Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--ux4g-gray-500)' }}>
                No triangulation data available yet
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, fontSize: '13px' }}>{row.field_name}</td>
                <td style={{ fontSize: '13px' }}>{row.pdf_value || '—'}</td>
                <td style={{ fontSize: '13px' }}>{row.gov_value || '—'}</td>
                <td>{matchIcon(row.match)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Officer Decision Panel ───────────────────────────────────
function DecisionPanel({ bidId, officerId, currentStatus }: { bidId: string; officerId: string; currentStatus: string }) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState<'approve' | 'reject' | 'clarify' | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isFinal = ['APPROVED', 'REJECTED'].includes(currentStatus);

  const handleAction = async (action: 'approve' | 'reject' | 'clarify') => {
    if (!remarks.trim() && action !== 'approve') {
      setResult({ type: 'error', message: 'Remarks are required for this action.' });
      return;
    }
    setLoading(action);
    setResult(null);

    try {
      const res = await fetch('/api/officer-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_id: bidId, action, remarks, officer_id: officerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ type: 'success', message: `Bid ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'sent for Clarification'} successfully.` });
    } catch (err) {
      setResult({ type: 'error', message: String(err) });
    } finally {
      setLoading(null);
    }
  };

  if (isFinal) {
    return (
      <div className={`alert ${currentStatus === 'APPROVED' ? 'alert-success' : 'alert-danger'}`}>
        {currentStatus === 'APPROVED' ? '✅ This bid has been Approved.' : '❌ This bid has been Rejected.'}
      </div>
    );
  }

  return (
    <div>
      <div className="form-group">
        <label className="form-label">Officer Remarks <span className="required">*</span></label>
        <textarea
          className="form-control"
          placeholder="Provide your decision rationale, observations, or instructions for the bidder..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
        />
      </div>

      {result && (
        <div className={`alert ${result.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '12px', fontSize: '13px' }}>
          {result.type === 'success' ? '✅' : '❌'} {result.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-success"
          style={{ flex: 1 }}
          onClick={() => handleAction('approve')}
          disabled={!!loading}
        >
          {loading === 'approve' ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Approving...</> : '✅ Approve Bid'}
        </button>
        <button
          className="btn btn-warning"
          onClick={() => handleAction('clarify')}
          disabled={!!loading || !remarks.trim()}
          title="Request more information from bidder"
        >
          {loading === 'clarify' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '💬 Clarify'}
        </button>
        <button
          className="btn btn-danger"
          onClick={() => handleAction('reject')}
          disabled={!!loading || !remarks.trim()}
        >
          {loading === 'reject' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '❌ Reject'}
        </button>
      </div>
      <p style={{ fontSize: '11px', color: 'var(--ux4g-gray-500)', marginTop: '8px' }}>
        * Remarks are mandatory for Reject and Clarify actions.
      </p>
    </div>
  );
}

// ─── Document Viewer ──────────────────────────────────────────
function DocumentViewer({
  documents,
  activeCategory,
  onCategoryChange,
}: {
  documents: (BidDocument & { presigned_url: string | null })[];
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}) {
  const activeDoc = documents.find((d) => d.category === activeCategory);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Doc tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px', flexShrink: 0 }}>
        {documents.map((doc) => (
          <button
            key={doc.category}
            className={`btn btn-sm ${activeCategory === doc.category ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={() => onCategoryChange(doc.category)}
          >
            {DOC_CATEGORY_LABELS[doc.category as keyof typeof DOC_CATEGORY_LABELS] ?? doc.category}
          </button>
        ))}
      </div>

      {/* Document render */}
      <div style={{ flex: 1, overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--ux4g-gray-200)' }}>
        {activeDoc?.presigned_url ? (
          <iframe
            src={activeDoc.presigned_url}
            className="doc-viewer"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={DOC_CATEGORY_LABELS[activeDoc.category as keyof typeof DOC_CATEGORY_LABELS]}
          />
        ) : (
          <div className="doc-viewer-placeholder">
            <span style={{ fontSize: '36px' }}>📄</span>
            <span style={{ fontWeight: 600 }}>Document not available</span>
            <span style={{ fontSize: '13px', color: 'var(--ux4g-gray-500)' }}>
              {activeDoc ? 'Preview URL expired or unavailable' : 'Select a document category'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main OfficerReviewPanel ──────────────────────────────────
export function OfficerReviewPanel({
  bid,
  documents,
  report,
  officerId,
}: {
  bid: Bid & { tender: any; bidder: any };
  documents: (BidDocument & { presigned_url: string | null })[];
  report: ComplianceReport | null;
  officerId: string;
}) {
  const [activeCategory, setActiveCategory] = useState<string>(documents[0]?.category ?? '');
  const [centerTab, setCenterTab] = useState<'triangulation' | 'trace'>('triangulation');

  return (
    <div className="review-layout" style={{ height: '100%' }}>
      {/* ── LEFT: Document Viewer ──────────────────────────── */}
      <div className="review-panel">
        <div className="review-panel__header">
          📄 Document Viewer
        </div>
        <div className="review-panel__body" style={{ padding: '12px' }}>
          <DocumentViewer
            documents={documents}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>
      </div>

      {/* ── CENTER: Data Triangulation / Trace ────────────── */}
      <div className="review-panel">
        <div className="review-panel__header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <span>🔍 Data Analysis</span>
          <div className="tabs" style={{ width: '100%', borderBottom: 'none' }}>
            <button
              className={`tab-btn ${centerTab === 'triangulation' ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => setCenterTab('triangulation')}
            >
              Triangulation
            </button>
            <button
              className={`tab-btn ${centerTab === 'trace' ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => setCenterTab('trace')}
            >
              AI Reasoning Trace
            </button>
          </div>
        </div>
        <div className="review-panel__body">
          {centerTab === 'triangulation' ? (
            <DataTriangulationTable documents={documents} report={report} />
          ) : (
            <div>
              {report?.reasoning_trace?.length ? (
                <ReasoningTrace steps={report.reasoning_trace} />
              ) : (
                <div className="doc-viewer-placeholder" style={{ padding: '32px' }}>
                  <span>⏳</span>
                  <span>Reasoning trace not available</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Score + Flags + Decision ──────────────── */}
      <div className="review-panel">
        <div className="review-panel__header">
          🤖 AI Assessment & Decision
        </div>
        <div className="review-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Score Gauge */}
          {report ? (
            <>
              <ComplianceGauge score={report.overall_score} risk={report.risk} />

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <span className={`badge ${report.mandatory_passed ? 'badge-success' : 'badge-danger'} badge-dot`}>
                  {report.mandatory_passed ? 'Mandatory Criteria Met' : 'Mandatory Criteria Failed'}
                </span>
                <span className="badge badge-gray">
                  {report.flags.length} Flag{report.flags.length !== 1 ? 's' : ''}
                </span>
              </div>

              <hr className="divider" />

              {/* Flags */}
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ux4g-gray-700)', marginBottom: '8px' }}>
                  ⚠️ Compliance Flags
                </div>
                <FlagsList flags={report.flags} />
              </div>

              <hr className="divider" />
            </>
          ) : (
            <div className="doc-viewer-placeholder" style={{ padding: '24px' }}>
              <span>⏳</span>
              <span style={{ fontWeight: 600 }}>Report Pending</span>
              <span style={{ fontSize: '12px', color: 'var(--ux4g-gray-500)' }}>AI analysis in progress</span>
            </div>
          )}

          {/* Decision Action */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ux4g-gray-700)', marginBottom: '8px' }}>
              🏛 Officer Decision
            </div>
            <DecisionPanel bidId={bid.id} officerId={officerId} currentStatus={bid.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
