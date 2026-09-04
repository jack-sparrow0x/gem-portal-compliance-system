import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadToS3 } from '@/lib/services/textract';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const tender_id = formData.get('tender_id') as string;
    const existing_bid_id = formData.get('bid_id') as string | null;
    const is_clarification = formData.get('is_clarification') === 'true';

    if (!tender_id) return NextResponse.json({ error: 'tender_id required' }, { status: 400 });

    // Create or reuse bid
    let bid_id: string;

    if (existing_bid_id && is_clarification) {
      // Reset status for resubmission
      await supabase
        .from('bids')
        .update({ status: 'SUBMITTED', officer_remarks: null })
        .eq('id', existing_bid_id)
        .eq('bidder_id', user.id);
      bid_id = existing_bid_id;
    } else {
      const { data: newBid, error: bidError } = await supabase
        .from('bids')
        .insert({ tender_id, bidder_id: user.id, status: 'SUBMITTED' })
        .select('id')
        .single();

      if (bidError) return NextResponse.json({ error: bidError.message }, { status: 500 });
      bid_id = newBid.id;
    }

    // Upload each document to S3 and save to bid_documents
    const uploadedDocs: string[] = [];

    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('doc_') || !(value instanceof File)) continue;

      const category = key.replace('doc_', '');
      const file = value as File;
      const buffer = Buffer.from(await file.arrayBuffer());

      const s3Key = `bids/${bid_id}/${category}/${Date.now()}_${file.name}`;
      await uploadToS3(s3Key, buffer, file.type || 'application/pdf');

      // Delete existing doc for this category (resubmission)
      await supabase
        .from('bid_documents')
        .delete()
        .eq('bid_id', bid_id)
        .eq('category', category);

      await supabase.from('bid_documents').insert({
        bid_id,
        category,
        file_name: file.name,
        s3_key: s3Key,
        s3_bucket: process.env.AWS_S3_BUCKET!,
      });

      uploadedDocs.push(category);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      bid_id,
      actor_id: user.id,
      action: is_clarification ? 'DOCUMENTS_RESUBMITTED' : 'DOCUMENTS_UPLOADED',
      payload: { categories: uploadedDocs },
    });

    // Trigger the processing pipeline asynchronously
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/process-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bid_id }),
    }).catch(console.error);

    return NextResponse.json({ success: true, bid_id, uploaded: uploadedDocs });
  } catch (error) {
    console.error('[upload-bid] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
