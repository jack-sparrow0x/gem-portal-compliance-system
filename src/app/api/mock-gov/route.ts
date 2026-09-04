import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Mock gov records endpoint — returns data from Supabase mock_gov_records table
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idType = searchParams.get('id_type');
  const idValue = searchParams.get('id_value');

  if (!idType || !idValue) {
    return NextResponse.json({ error: 'id_type and id_value are required' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('mock_gov_records')
    .select('*')
    .eq('id_type', idType.toUpperCase())
    .eq('id_value', idValue.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json({
      id_type: idType,
      id_value: idValue,
      legal_name: 'RECORD_NOT_FOUND',
      status: 'UNVERIFIED',
      raw_payload: {},
    });
  }

  return NextResponse.json(data);
}
