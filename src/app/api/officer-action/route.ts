import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { bid_id, action, remarks, officer_id } = await request.json();

    if (!bid_id || !action || !officer_id) {
      return NextResponse.json({ error: 'bid_id, action, and officer_id are required' }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Verify officer role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', officer_id)
      .single();

    if (profile?.role !== 'officer') {
      return NextResponse.json({ error: 'Unauthorized — not an officer' }, { status: 403 });
    }

    const statusMap: Record<string, string> = {
      approve: 'APPROVED',
      reject: 'REJECTED',
      clarify: 'CLARIFICATION_REQUESTED',
    };

    const newStatus = statusMap[action];
    if (!newStatus) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    // Update bid status + officer remarks
    const { error: updateError } = await supabase
      .from('bids')
      .update({ status: newStatus, officer_remarks: remarks || null })
      .eq('id', bid_id);

    if (updateError) throw updateError;

    // Audit log
    await supabase.from('audit_logs').insert({
      bid_id,
      actor_id: officer_id,
      action: `OFFICER_${action.toUpperCase()}`,
      payload: { new_status: newStatus, remarks },
    });

    return NextResponse.json({ success: true, bid_id, new_status: newStatus });
  } catch (error) {
    console.error('[officer-action] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
