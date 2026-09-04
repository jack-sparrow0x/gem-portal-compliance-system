'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/types';

interface GovBarProps {
  user: Profile;
}

export function GovBar() {
  return (
    <div className="gov-bar">
      <div className="gov-bar__emblem">
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="1.5" />
          <circle cx="14" cy="14" r="5" stroke="white" strokeWidth="1.5" />
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={14 + 5 * Math.cos(rad)} y1={14 + 5 * Math.sin(rad)}
                x2={14 + 13 * Math.cos(rad)} y2={14 + 13 * Math.sin(rad)}
                stroke="white" strokeWidth="0.5"
              />
            );
          })}
        </svg>
        <div>
          <div className="gov-bar__title">Government of India — भारत सरकार</div>
          <div className="gov-bar__subtitle">Ministry of Commerce and Industry</div>
        </div>
      </div>
      <div className="gov-bar__right">
        <span>Screen Reader</span>
        <span>|</span>
        <span>Skip Navigation</span>
        <span>|</span>
        <span>A A+ A-</span>
      </div>
    </div>
  );
}

export function SiteHeader({ user }: GovBarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="site-header">
      <div className="site-header__brand">
        <div style={{
          background: '#FF6600',
          color: '#fff',
          fontWeight: 800,
          fontSize: '16px',
          padding: '5px 10px',
          borderRadius: '5px',
          letterSpacing: '2px',
        }}>GeM</div>
        <div className="site-header__brand-text">
          <h1>Bid Compliance Verification Platform</h1>
          <p>AI-Powered Procurement Audit System</p>
        </div>
      </div>

      <nav className="site-header__nav">
        <div className="site-header__user">
          <div className="site-header__avatar">{initials}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>{user.full_name}</div>
            <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {user.role === 'officer' ? '🏛 Procurement Officer' : '🏢 Bidder'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-ghost btn-sm"
          style={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
        >
          Sign Out
        </button>
      </nav>
    </header>
  );
}
