import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { uploadToS3, extractTextFromS3 } from '@/lib/services/textract';
import { extractDocumentFields, evaluateCompliance } from '@/lib/services/gemini';
import { verifyGovRecord } from '@/lib/services/govAdapter';
import type { BidDocument, ExtractedDocumentData, GovVerificationResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { bid_id } = await request.json();
    if (!bid_id) return NextResponse.json({ error: 'bid_id required' }, { status: 400 });

    const supabase = await createAdminClient();

    // ── Step 0: Load bid + documents + tender ─────────────────
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('*, tender:tenders(*), bid_documents(*)')
      .eq('id', bid_id)
      .single();

    if (bidError || !bid) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }

    // Mark as processing
    await supabase.from('bids').update({ status: 'OCR_PROCESSING' }).eq('id', bid_id);
    await supabase.from('audit_logs').insert({
      bid_id,
      actor_id: bid.bidder_id,
      action: 'PIPELINE_STARTED',
      payload: { bid_id },
    });

    const documents: BidDocument[] = bid.bid_documents || [];

    // ── Step 1: OCR each document ──────────────────────────────
    const extractedDocs: ExtractedDocumentData[] = [];
    const govRecords: Record<string, GovVerificationResult> = {};

    for (const doc of documents) {
      // 1a. Textract OCR
      const rawOcrText = await extractTextFromS3(doc.s3_key);

      await supabase
        .from('bid_documents')
        .update({ raw_ocr_text: rawOcrText })
        .eq('id', doc.id);

      // 1b. Gemini field extraction
      const extracted = await extractDocumentFields(rawOcrText, doc.category);

      await supabase
        .from('bid_documents')
        .update({ extracted_json: extracted })
        .eq('id', doc.id);

      extractedDocs.push(extracted);

      // ── Step 2: Gov record triangulation ────────────────────
      if (extracted.identification_number) {
        const idTypeMap: Record<string, string> = {
          GST_CERTIFICATE: 'GSTIN',
          PAN_CARD: 'PAN',
          UDYAM_CERTIFICATE: 'UDYAM',
        };
        const idType = idTypeMap[doc.category] ?? 'GSTIN';
        const govResult = await verifyGovRecord(idType, extracted.identification_number);
        govRecords[`${idType}:${extracted.identification_number}`] = govResult;
      }
    }

    // Update status
    await supabase.from('bids').update({ status: 'GOV_VERIFIED' }).eq('id', bid_id);

    // ── Step 3: Gemini compliance analysis ────────────────────
    const tender = bid.tender;
    const complianceResult = await evaluateCompliance({
      extractedDocs,
      govRecords,
      mandatoryCriteria: tender?.mandatory_criteria || [],
    });

    // Save compliance report
    const { data: report } = await supabase
      .from('compliance_reports')
      .upsert({
        bid_id,
        overall_score: complianceResult.overall_score,
        risk: complianceResult.risk,
        mandatory_passed: complianceResult.mandatory_passed,
        flags: complianceResult.flags,
        reasoning_trace: complianceResult.reasoning_trace,
        gov_api_payload: complianceResult.gov_api_payload,
      })
      .select()
      .single();

    // Mark as report ready
    await supabase.from('bids').update({ status: 'REPORT_READY' }).eq('id', bid_id);

    await supabase.from('audit_logs').insert({
      bid_id,
      actor_id: bid.bidder_id,
      action: 'PIPELINE_COMPLETED',
      payload: {
        score: complianceResult.overall_score,
        risk: complianceResult.risk,
        flags_count: complianceResult.flags.length,
      },
    });

    return NextResponse.json({ success: true, bid_id, report });
  } catch (error) {
    console.error('[process-bid] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
