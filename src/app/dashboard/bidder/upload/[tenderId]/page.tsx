import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { BidUploader } from '@/components/BidUploader';
import type { Tender, DocCategory } from '@/types';

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenderId: string }>;
  searchParams: Promise<{ bid_id?: string; clarify?: string }>;
}) {
  const { tenderId } = await params;
  const { bid_id, clarify } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tender } = await supabase
    .from('tenders')
    .select('*')
    .eq('id', tenderId)
    .single();

  if (!tender) notFound();

  // Check if bid already exists (and not a clarification)
  if (!clarify) {
    const { data: existingBid } = await supabase
      .from('bids')
      .select('id, status')
      .eq('tender_id', tenderId)
      .eq('bidder_id', user.id)
      .single();

    if (existingBid && existingBid.status !== 'CLARIFICATION_REQUESTED') {
      redirect('/dashboard/bidder');
    }
  }

  const t = tender as Tender;

  return (
    <div>
      <nav className="breadcrumb">
        <Link href="/dashboard/bidder">Dashboard</Link>
        <span className="breadcrumb__separator">›</span>
        <span className="breadcrumb__current">Submit Bid — {t.tender_number}</span>
      </nav>

      <div className="page-header">
        <div className="container">
          <h2 className="page-header__title">
            {clarify ? '🔄 Resubmit Documents' : '📤 Submit Bid Application'}
          </h2>
          <p className="page-header__subtitle">{t.title} | {t.department}</p>
        </div>
      </div>

      <div className="page-content container" style={{ maxWidth: '900px' }}>
        <BidUploader
          tenderId={tenderId}
          tenderTitle={t.title}
          tenderNumber={t.tender_number}
          requiredDocs={t.required_docs as DocCategory[]}
          existingBidId={bid_id}
          isClarification={clarify === 'true'}
        />
      </div>
    </div>
  );
}
