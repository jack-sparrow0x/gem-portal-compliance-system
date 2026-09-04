'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Role = 'bidder' | 'officer';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeRole, setActiveRole] = useState<Role>('bidder');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (mode === 'register') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: activeRole,
            organization,
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess('Registration successful! Please check your email to confirm your account, then login.');
        setMode('login');
      }
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Verify role matches selected tab
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        setError('Could not load your profile. Please contact support.');
        setLoading(false);
        return;
      }

      if (profile.role !== activeRole) {
        setError(
          `This account is registered as a "${profile.role}". Please select the correct portal tab.`
        );
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      router.push(`/dashboard/${profile.role}`);
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Background pattern */}
      <div className="login-bg-pattern" />

      {/* Gov Top Bar */}
      <div className="gov-bar" style={{ position: 'relative', zIndex: 10 }}>
        <div className="gov-bar__emblem">
          {/* Ashoka Chakra SVG placeholder */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="5" stroke="white" strokeWidth="1.5" />
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 360) / 24;
              const rad = (angle * Math.PI) / 180;
              const x1 = 14 + 5 * Math.cos(rad);
              const y1 = 14 + 5 * Math.sin(rad);
              const x2 = 14 + 13 * Math.cos(rad);
              const y2 = 14 + 13 * Math.sin(rad);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.5" />;
            })}
          </svg>
          <div>
            <div className="gov-bar__title">Government of India</div>
            <div className="gov-bar__subtitle">भारत सरकार</div>
          </div>
        </div>
        <div className="gov-bar__right">
          <span>🌐 Skip to Main Content</span>
          <span>| Screen Reader Access</span>
        </div>
      </div>

      {/* Login Container */}
      <div className="login-container">
        <div className="login-card animate-fadein">
          {/* Card Header */}
          <div className="login-card__header">
            {/* GeM Logo Text */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                background: '#FF6600',
                color: '#fff',
                fontWeight: 800,
                fontSize: '20px',
                padding: '6px 12px',
                borderRadius: '6px',
                letterSpacing: '2px',
              }}>GeM</div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', textAlign: 'left' }}>
                Government<br />e-Marketplace
              </div>
            </div>
            <div className="login-card__title">Bid Compliance Verification Platform</div>
            <div className="login-card__subtitle">
              AI-Powered Procurement Audit System | SIH 2025
            </div>
          </div>

          {/* Card Body */}
          <div className="login-card__body">
            {/* Role Switcher Tabs */}
            <div className="tabs" style={{ marginBottom: '20px' }}>
              <button
                className={`tab-btn ${activeRole === 'bidder' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { setActiveRole('bidder'); setError(''); }}
              >
                🏢 Bidder Portal
              </button>
              <button
                className={`tab-btn ${activeRole === 'officer' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { setActiveRole('officer'); setError(''); }}
              >
                🏛️ Officer Portal
              </button>
            </div>

            {/* Role info banner */}
            <div className={`alert ${activeRole === 'bidder' ? 'alert-info' : 'alert-warning'}`}
              style={{ marginBottom: '16px', fontSize: '12px', padding: '8px 12px' }}>
              {activeRole === 'bidder'
                ? 'ℹ️ For registered vendors submitting bids on GeM tenders.'
                : '⚠️ Restricted access. For authorized Procurement Officers only.'}
            </div>

            {/* Mode toggle */}
            {activeRole === 'bidder' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => { setMode('login'); setError(''); }}
                >Login</button>
                <button
                  className={`btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => { setMode('register'); setError(''); }}
                >Register</button>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '12px', fontSize: '13px' }}>
                ❌ {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success" style={{ marginBottom: '12px', fontSize: '13px' }}>
                ✅ {success}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {mode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Organization / Company</label>
                    <input
                      className="form-control"
                      type="text"
                      placeholder="Company name"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Email Address <span className="required">*</span></label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="your@email.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password <span className="required">*</span></label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ marginTop: '8px', padding: '11px' }}
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 16, height: 16 }} /> Processing...</>
                ) : (
                  mode === 'login'
                    ? `Sign In as ${activeRole === 'bidder' ? 'Bidder' : 'Officer'}`
                    : 'Create Bidder Account'
                )}
              </button>
            </form>

            <div className="divider" />

            {/* Demo credentials */}
            <div style={{ fontSize: '11px', color: 'var(--ux4g-gray-500)', textAlign: 'center' }}>
              <strong>Demo:</strong> Fill in your Supabase credentials and create test accounts.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="site-footer">
        <strong>Government of India</strong> | Ministry of Commerce and Industry | GeM Portal
        <br />© 2025 GeM. All rights reserved. | Data is processed in compliance with IT Act 2000.
      </div>
    </div>
  );
}
