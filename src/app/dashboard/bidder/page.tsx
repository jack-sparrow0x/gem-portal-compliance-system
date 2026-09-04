import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BID_STATUS_LABELS, DOC_CATEGORY_LABELS } from '@/types';
import type { Bid, Tender } from '@/types';

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    SUBMITTED: 'badge-info',
    OCR_PROCESSING: 'badge-warning',
    EXTRACTION_DONE: 'badge-warning',
    GOV_VERIFIED: 'badge-primary',
    REPORT_READY: 'badge-primary',
    APPROVED: 'badge-success',
    REJECTED: 'badge-danger',
    CLARIFICATION_REQUESTED: 'badge-warning',
  };
  return (
    <span className={`badge badge-dot ${colorMap[status] ?? 'badge-gray'}`}>
      {BID_STATUS_LABELS[status as keyof typeof BID_STATUS_LABELS] ?? status}
    </span>
  );
}

export default async function BidderDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Load tenders + user's bids
  const [{ data: tenders }, { data: bids }] = await Promise.all([
    supabase.from('tenders').select('*').eq('is_active', true).order('closing_date', { ascending: true }),
    supabase
      .from('bids')
      .select('*, tender:tenders(*), compliance_report:compliance_reports(overall_score,risk)')
      .eq('bidder_id', user.id)
      .order('submitted_at', { ascending: false }),
  ]);

  const activeTenders: Tender[] = tenders ?? [];
  const myBids: Bid[] = bids ?? [];

  // Stats
  const stats = {
    total: myBids.length,
    approved: myBids.filter((b) => b.status === 'APPROVED').length,
    pending: myBids.filter((b) => ['SUBMITTED', 'OCR_PROCESSING', 'EXTRACTION_DONE', 'GOV_VERIFIED', 'REPORT_READY'].includes(b.status)).length,
    clarification: myBids.filter((b) => b.status === 'CLARIFICATION_REQUESTED').length,
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link href="/dashboard/bidder">Dashboard</Link>
        <span className="breadcrumb__separator">›</span>
        <span className="breadcrumb__current">Bidder Portal</span>
      </nav>

      <div className="page-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className="page-header__title">My Bid Submissions</h2>
              <p className="page-header__subtitle">Track your tender applications and compliance status</p>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content container">
        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Submissions', value: stats.total, icon: '📋', bg: '#e8eef7', iconBg: '#003580', color: '#fff' },
            { label: 'Approved', value: stats.approved, icon: '✅', bg: '#d4edda', iconBg: '#28A745', color: '#fff' },
            { label: 'In Progress', value: stats.pending, icon: '⏳', bg: '#d1ecf1', iconBg: '#17A2B8', color: '#fff' },
            { label: 'Clarification Needed', value: stats.clarification, icon: '⚠️', bg: '#fff3cd', iconBg: '#FFC107', color: '#212529' },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card__icon" style={{ background: s.bg }}>
                <span>{s.icon}</span>
              </div>
              <div>
                <div className="stat-card__value">{s.value}</div>
                <div className="stat-card__label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Clarification Alerts */}
        {myBids.filter((b) => b.status === 'CLARIFICATION_REQUESTED').map((bid) => (
          <div key={bid.id} className="alert alert-warning" style={{ marginBottom: '12px' }}>
            <div>
              <strong>⚠️ Clarification Required — {(bid.tender as Tender)?.tender_number}</strong>
              <p style={{ margin: '4px 0 8px', fontSize: '13px' }}>
                {bid.officer_remarks || 'Officer has requested additional clarification. Please review and resubmit documents.'}
              </p>
              <Link href={`/dashboard/bidder/upload/${bid.tender_id}?bid_id=${bid.id}&clarify=true`} className="btn btn-warning btn-sm">
                Respond to Clarification
              </Link>
            </div>
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
          {/* Active Tenders */}
          <div className="card">
            <div className="card-header">
              <span className="card-header__title">🏛️ Active Tenders</span>
              <span className="badge badge-success">{activeTenders.length} Open</span>
            </div>
            <div style={{ padding: 0 }}>
              {activeTenders.length === 0 ? (
                <div className="doc-viewer-placeholder" style={{ padding: '32px' }}>
                  <span>📭</span>
                  <span>No active tenders at this time</span>
                </div>
              ) : (
                activeTenders.map((tender) => {
                  const alreadyApplied = myBids.find((b) => b.tender_id === tender.id);
                  return (
                    <div key={tender.id} style={{
                      padding: '16px',
                      borderBottom: '1px solid var(--ux4g-gray-200)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ux4g-primary-dark)', marginBottom: '4px' }}>
                          {tender.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ux4g-gray-600)', marginBottom: '6px' }}>
                          🏷️ {tender.tender_number} &nbsp;|&nbsp; 🏢 {tender.department}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--ux4g-gray-500)', marginBottom: '8px' }}>
                          📅 Closes: {new Date(tender.closing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(tender.required_docs || []).map((doc) => (
                            <span key={doc} className="badge badge-primary" style={{ fontSize: '10px' }}>
                              {DOC_CATEGORY_LABELS[doc as keyof typeof DOC_CATEGORY_LABELS]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {alreadyApplied ? (
                          <StatusBadge status={alreadyApplied.status} />
                        ) : (
                          <Link href={`/dashboard/bidder/upload/${tender.id}`} className="btn btn-primary btn-sm">
                            Apply Now
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* My Submissions */}
          <div className="card">
            <div className="card-header">
              <span className="card-header__title">📋 My Submissions</span>
              <span className="badge badge-gray">{myBids.length} Total</span>
            </div>
            <div style={{ padding: 0 }}>
              {myBids.length === 0 ? (
                <div className="doc-viewer-placeholder" style={{ padding: '32px' }}>
                  <span>📭</span>
                  <span>No submissions yet. Apply to a tender above.</span>
                </div>
              ) : (
                myBids.map((bid) => {
                  const tender = bid.tender as Tender;
                  const report = bid.compliance_report as { overall_score: number; risk: string } | null;
                  return (
                    <div key={bid.id} style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid var(--ux4g-gray-200)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ux4g-primary-dark)' }}>
                          {tender?.tender_number ?? 'Unknown'}
                        </div>
                        <StatusBadge status={bid.status} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ux4g-gray-600)', marginBottom: '6px' }}>
                        {tender?.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: 'var(--ux4g-gray-500)' }}>
                          🕐 {new Date(bid.submitted_at).toLocaleDateString('en-IN')}
                        </span>
                        {report && (
                          <span className={`badge risk-${report.risk}`} style={{ fontSize: '10px' }}>
                            {report.risk} RISK • {Math.round(report.overall_score * 100)}%
                          </span>
                        )}
                      </div>
                      {bid.status === 'CLARIFICATION_REQUESTED' && bid.officer_remarks && (
                        <div className="alert alert-warning" style={{ marginTop: '8px', padding: '8px 10px', fontSize: '12px' }}>
                          💬 Officer: {bid.officer_remarks}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
