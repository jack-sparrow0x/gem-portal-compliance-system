import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GovBar, SiteHeader } from '@/components/layout/Header';
import type { Profile } from '@/types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <GovBar />
      <SiteHeader user={profile as Profile} />
      <main className="page-wrapper">
        {children}
      </main>
      <footer className="site-footer">
        <strong>Government e-Marketplace (GeM)</strong> | Bid Compliance Verification Platform
        <br />
        <span style={{ fontSize: '11px' }}>
          Powered by Gemini AI • AWS Textract • Supabase | Data secured as per IT Act 2000 | NIC India
        </span>
      </footer>
    </div>
  );
}
