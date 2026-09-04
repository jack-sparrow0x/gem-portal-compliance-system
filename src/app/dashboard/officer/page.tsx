import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Bid, Tender, Profile, ComplianceReport } from '@/types';
import { BID_STATUS_LABELS } from '@/types';

type BidRow = Bid & { tender: Tender; bidder: Profile; compliance_report: ComplianceReport | null };

function RiskBadge({ risk }: { risk: string }) {
  return <span className={`badge risk-${risk} badge-dot`}>{risk}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cm: Record<string, string> = {
    SUBMITTED: 'badge-info', OCR_PROCESSING: 'badge-warning', EXTRACTION_DONE: 'badge-warning',
    GOV_VERIFIED: 'badge-primary', REPORT_READY: 'badge-primary', APPROVED: 'badge-success',
    REJECTED: 'badge-danger', CLARIFICATION_REQUESTED: 'badge-warning',
  };
  return <span className={`badge badge-dot ${cm[status] ?? 'badge-gray'}`}>{BID_STATUS_LABELS[status as keyof typeof BID_STATUS_LABELS] ?? status}</span>;
}

export default async function OfficerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ risk?: string; tender?: string; status?: string; q?: string }>;
}) {
  const { risk, tender, status, q } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminSupabase = await createAdminClient();

  // Verify officer role
  const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'officer') redirect('/dashboard/bidder');

  // Load all bids with joined data
  let query = adminSupabase
    .from('bids')
    .select(`
      *,
      tender:tenders(id, tender_number, title, department),
      bidder:profiles(id, full_name, email, organization),
      compliance_report:compliance_reports(overall_score, risk, mandatory_passed, flags)
    `)
    .order('submitted_at', { ascending: false });

  if (risk) query = query.eq('compliance_report.risk', risk);
  if (status) query = query.eq('status', status);
  if (tender) query = query.ilike('tender.tender_number', `%${tender}%`);

  const { data: bids } = await query;
  const allBids: BidRow[] = (bids ?? []) as BidRow[];

  // Filter by search query client-side
  const filteredBids = q
    ? allBids.filter((b) =>
        b.bidder?.full_name?.toLowerCase().includes(q.toLowerCase()) ||
        b.tender?.tender_number?.toLowerCase().includes(q.toLowerCase()) ||
        b.bidder?.organization?.toLowerCase().includes(q.toLowerCase())
      )
    : allBids;

  // Stats
  const stats = {
    total: allBids.length,
    high_risk: allBids.filter((b) => b.compliance_report?.risk === 'HIGH').length,
    pending_review: allBids.filter((b) => b.status === 'REPORT_READY').length,
    approved: allBids.filter((b) => b.status === 'APPROVED').length,
  };

  return (
    <div>
      <nav className="breadcrumb">
        <Link href="/dashboard/officer">Dashboard</Link>
        <span className="breadcrumb__separator">›</span>
        <span className="breadcrumb__current">Procurement Officer Portal</span>
      </nav>

      <div className="page-header">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 className="page-header__title">Submission Overview</h2>
              <p className="page-header__subtitle">Review AI-analyzed bid compliance reports and take action</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link href="/dashboard/officer/tenders/new" className="btn btn-primary btn-sm">
                + Create Tender
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content container">
        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Submissions', value: stats.total, icon: '📋', bg: '#e8eef7' },
            { label: 'High Risk Bids', value: stats.high_risk, icon: '🔴', bg: '#f8d7da' },
            { label: 'Pending Review', value: stats.pending_review, icon: '⏳', bg: '#fff3cd' },
            { label: 'Approved', value: stats.approved, icon: '✅', bg: '#d4edda' },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card__icon" style={{ background: s.bg }}><span>{s.icon}</span></div>
              <div>
                <div className="stat-card__value">{s.value}</div>
                <div className="stat-card__label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="card" style={{ marginBottom: '0', borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
          <form className="filter-bar">
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ux4g-gray-700)' }}>Filter:</label>
            <input name="q" defaultValue={q} placeholder="🔍 Search bidder / tender..." style={{ minWidth: '200px' }} />
            <select name="risk" defaultValue={risk ?? ''}>
              <option value="">All Risk Levels</option>
              <option value="HIGH">🔴 High Risk</option>
              <option value="MEDIUM">🟡 Medium Risk</option>
              <option value="LOW">🟢 Low Risk</option>
            </select>
            <select name="status" defaultValue={status ?? ''}>
              <option value="">All Statuses</option>
              <option value="REPORT_READY">Report Ready</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CLARIFICATION_REQUESTED">Clarification Requested</option>
            </select>
            <button type="submit" className="btn btn-primary btn-sm">Apply</button>
            <a href="/dashboard/officer" className="btn btn-ghost btn-sm">Reset</a>
          </form>
        </div>

        {/* Submissions Table */}
        <div className="table-wrapper" style={{ borderRadius: '0 0 8px 8px' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Bidder Name</th>
                <th>Organization</th>
                <th>Tender Number</th>
                <th>Submitted</th>
                <th>AI Risk</th>
                <th>AI Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBids.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--ux4g-gray-500)' }}>
                    📭 No submissions found
                  </td>
                </tr>
              ) : (
                filteredBids.map((bid, idx) => {
                  const report = bid.compliance_report;
                  return (
                    <tr key={bid.id}>
                      <td style={{ color: 'var(--ux4g-gray-500)', fontWeight: 500 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{bid.bidder?.full_name ?? '—'}</td>
                      <td style={{ color: 'var(--ux4g-gray-600)', fontSize: '13px' }}>{bid.bidder?.organization ?? '—'}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ux4g-primary)' }}>{bid.tender?.tender_number}</div>
                        <div style={{ fontSize: '11px', color: 'var(--ux4g-gray-500)' }}>{bid.tender?.department}</div>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--ux4g-gray-600)' }}>
                        {new Date(bid.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        {report ? <RiskBadge risk={report.risk} /> : <span className="text-muted text-sm">—</span>}
                      </td>
                      <td>
                        {report ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              background: 'var(--ux4g-gray-200)',
                              borderRadius: '20px',
                              height: '6px',
                              width: '60px',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.round(report.overall_score * 100)}%`,
                                background: report.risk === 'LOW' ? 'var(--ux4g-success)' : report.risk === 'MEDIUM' ? 'var(--ux4g-warning)' : 'var(--ux4g-danger)',
                                borderRadius: '20px',
                              }} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{Math.round(report.overall_score * 100)}%</span>
                          </div>
                        ) : <span className="text-muted text-sm">—</span>}
                      </td>
                      <td><StatusBadge status={bid.status} /></td>
                      <td>
                        <Link
                          href={`/dashboard/officer/review/${bid.id}`}
                          className={`btn btn-sm ${bid.status === 'REPORT_READY' ? 'btn-primary' : 'btn-outline'}`}
                        >
                          {bid.status === 'REPORT_READY' ? 'Review Now' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--ux4g-gray-500)' }}>
          Showing {filteredBids.length} of {allBids.length} submissions
        </div>
      </div>
    </div>
  );
}
