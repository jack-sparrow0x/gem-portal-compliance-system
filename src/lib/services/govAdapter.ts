import { createAdminClient } from '@/lib/supabase/server';
import type { GovVerificationResult } from '@/types';

// ─── Hybrid Gov Record Adapter ────────────────────────────────
// Reads USE_MOCK_GOV_DATA env var to toggle between mock DB and live API.

export async function verifyGovRecord(
  idType: string,
  idValue: string
): Promise<GovVerificationResult> {
  const useMock = process.env.USE_MOCK_GOV_DATA === 'true';

  if (useMock) {
    return verifyFromMockDB(idType, idValue);
  } else {
    return verifyFromLiveAPI(idType, idValue);
  }
}

// ─── Mock: Query Supabase mock_gov_records table ──────────────
async function verifyFromMockDB(
  idType: string,
  idValue: string
): Promise<GovVerificationResult> {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('mock_gov_records')
    .select('*')
    .eq('id_type', idType.toUpperCase())
    .eq('id_value', idValue.trim().toUpperCase())
    .single();

  if (error || !data) {
    return {
      id_type: idType,
      id_value: idValue,
      legal_name: 'RECORD_NOT_FOUND',
      status: 'UNVERIFIED',
      raw_payload: { message: 'No record matching this ID in mock database.' },
    };
  }

  return {
    id_type: data.id_type,
    id_value: data.id_value,
    legal_name: data.legal_name,
    status: data.status,
    registration_date: data.registration_date,
    raw_payload: data,
  };
}

// ─── Live: Query Sandbox.co.in API ───────────────────────────
async function verifyFromLiveAPI(
  idType: string,
  idValue: string
): Promise<GovVerificationResult> {
  const endpointMap: Record<string, string> = {
    GSTIN: 'gst/v1/returns/gstr1',
    PAN: 'kyc/v1/pan',
    UDYAM: 'msme/v1/verify',
  };

  const endpoint = endpointMap[idType.toUpperCase()];
  if (!endpoint) {
    return {
      id_type: idType,
      id_value: idValue,
      legal_name: 'UNKNOWN_ID_TYPE',
      status: 'UNVERIFIED',
      raw_payload: {},
    };
  }

  try {
    const res = await fetch(
      `https://api.sandbox.co.in/${endpoint}?id=${encodeURIComponent(idValue)}`,
      {
        headers: {
          'x-api-key': process.env.SANDBOX_API_KEY!,
          authorization: process.env.SANDBOX_ACCESS_TOKEN!,
          'x-accept-cache': 'true',
        },
      }
    );

    if (!res.ok) throw new Error(`Sandbox API error: ${res.status}`);

    const payload = await res.json();

    return {
      id_type: idType,
      id_value: idValue,
      legal_name: payload?.data?.legal_name ?? 'N/A',
      status: payload?.data?.status ?? 'UNKNOWN',
      registration_date: payload?.data?.registration_date,
      raw_payload: payload,
    };
  } catch (err) {
    console.error('[govAdapter] Live API error:', err);
    return {
      id_type: idType,
      id_value: idValue,
      legal_name: 'API_ERROR',
      status: 'UNVERIFIED',
      raw_payload: { error: String(err) },
    };
  }
}
