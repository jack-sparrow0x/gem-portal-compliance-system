import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { OfficerReviewPanel } from '@/components/OfficerReviewPanel';
import type { Bid, Tender, Profile, ComplianceReport, BidDocument } from '@/types';

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ bidId: string }>;
}) {
  const { bidId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'officer') redirect('/dashboard/bidder');

  // Load full bid with all relations
  const { data: bid } = await supabase
    .from('bids')
    .select(`
      *,
      tender:tenders(*),
      bidder:profiles(*),
      bid_documents(*),
      compliance_report:compliance_reports(*)
    `)
    .eq('id', bidId)
    .single();

  if (!bid) notFound();

  const fullBid = bid as Bid & {
    tender: Tender;
    bidder: Profile;
    bid_documents: BidDocument[];
    compliance_report: ComplianceReport | null;
  };

  // Generate presigned URLs for documents
  const docsWithUrls = await Promise.all(
    (fullBid.bid_documents || []).map(async (doc) => {
      // Import here to avoid bundling AWS SDK on client
      const { getPresignedUrl } = await import('@/lib/services/textract');
      const url = await getPresignedUrl(doc.s3_key).catch(() => null);
      return { ...doc, presigned_url: url };
    })
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 104px)' }}>
      {/* Breadcrumb + Header */}
      <nav className="breadcrumb" style={{ flexShrink: 0 }}>
        <Link href="/dashboard/officer">Officer Dashboard</Link>
        <span className="breadcrumb__separator">›</span>
        <Link href="/dashboard/officer">Submissions</Link>
        <span className="breadcrumb__separator">›</span>
        <span className="breadcrumb__current">Review — {fullBid.tender?.tender_number}</span>
      </nav>

      <div style={{
        padding: '12px 24px',
        background: '#fff',
        borderBottom: '1px solid var(--ux4g-gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--ux4g-primary-dark)' }}>
            📋 {fullBid.tender?.title}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ux4g-gray-600)', marginTop: '2px' }}>
            Bidder: <strong>{fullBid.bidder?.full_name}</strong> ({fullBid.bidder?.organization}) &nbsp;|&nbsp;
            Submitted: {new Date(fullBid.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {fullBid.compliance_report && (
            <span className={`badge badge-dot risk-${fullBid.compliance_report.risk}`} style={{ fontSize: '13px', padding: '4px 12px' }}>
              {fullBid.compliance_report.risk} RISK
            </span>
          )}
          <span className="badge badge-gray" style={{ fontSize: '12px' }}>
            {fullBid.status}
          </span>
        </div>
      </div>

      {/* 3-Column Review Layout */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '16px' }}>
        <OfficerReviewPanel
          bid={fullBid}
          documents={docsWithUrls as (BidDocument & { presigned_url: string | null })[]}
          report={fullBid.compliance_report}
          officerId={user.id}
        />
      </div>
    </div>
  );
}
