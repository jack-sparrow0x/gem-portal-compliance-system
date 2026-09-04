'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DOC_CATEGORY_LABELS } from '@/types';
import type { DocCategory } from '@/types';

const ALL_CATEGORIES: DocCategory[] = [
  'GST_CERTIFICATE',
  'PAN_CARD',
  'UDYAM_CERTIFICATE',
  'FINANCIAL_STATEMENT',
  'OTHER',
];

export default function NewTenderPage() {
  const [form, setForm] = useState({
    tender_number: '',
    title: '',
    department: '',
    description: '',
    closing_date: '',
  });
  const [selectedDocs, setSelectedDocs] = useState<DocCategory[]>(['GST_CERTIFICATE', 'PAN_CARD', 'UDYAM_CERTIFICATE']);
  const [criteria, setCriteria] = useState([{ key: '', label: '', required_value: '' }]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const toggleDoc = (cat: DocCategory) => {
    setSelectedDocs((prev) =>
      prev.includes(cat) ? prev.filter((d) => d !== cat) : [...prev, cat]
    );
  };

  const addCriterion = () => setCriteria((prev) => [...prev, { key: '', label: '', required_value: '' }]);

  const updateCriterion = (idx: number, field: string, value: string) => {
    setCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const removeCriterion = (idx: number) => setCriteria((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          required_docs: selectedDocs,
          mandatory_criteria: criteria.filter((c) => c.key && c.label),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Tender ${data.tender_number} created successfully!`);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <nav className="breadcrumb">
        <Link href="/dashboard/officer">Officer Dashboard</Link>
        <span className="breadcrumb__separator">›</span>
        <span className="breadcrumb__current">Create New Tender</span>
      </nav>

      <div className="page-header">
        <div className="container">
          <h2 className="page-header__title">🏛️ Create New Tender</h2>
          <p className="page-header__subtitle">Define tender details, required documents, and compliance criteria</p>
        </div>
      </div>

      <div className="page-content container" style={{ maxWidth: '800px' }}>
        {success ? (
          <div className="card animate-fadein">
            <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <h3 style={{ color: 'var(--ux4g-success)', marginBottom: '12px' }}>Tender Created!</h3>
              <p style={{ marginBottom: '20px', color: 'var(--ux4g-gray-700)' }}>{success}</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <Link href="/dashboard/officer" className="btn btn-primary">Back to Dashboard</Link>
                <button className="btn btn-outline" onClick={() => { setSuccess(''); setForm({ tender_number: '', title: '', department: '', description: '', closing_date: '' }); }}>
                  Create Another
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header"><span className="card-header__title">📋 Tender Details</span></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Tender Number <span className="required">*</span></label>
                    <input className="form-control" placeholder="e.g. GEM/2025/B/4512345" required
                      value={form.tender_number} onChange={(e) => setForm({ ...form, tender_number: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Closing Date <span className="required">*</span></label>
                    <input className="form-control" type="datetime-local" required
                      value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Tender Title <span className="required">*</span></label>
                  <input className="form-control" placeholder="e.g. Supply of IT Equipment — NIC Delhi" required
                    value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department <span className="required">*</span></label>
                  <input className="form-control" placeholder="e.g. National Informatics Centre" required
                    value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} placeholder="Detailed tender requirements..."
                    value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header"><span className="card-header__title">📁 Required Documents</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {ALL_CATEGORIES.map((cat) => (
                    <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', border: `1.5px solid ${selectedDocs.includes(cat) ? 'var(--ux4g-primary)' : 'var(--ux4g-gray-300)'}`, borderRadius: '6px', background: selectedDocs.includes(cat) ? 'var(--ux4g-primary-light)' : '#fff' }}>
                      <input type="checkbox" checked={selectedDocs.includes(cat)} onChange={() => toggleDoc(cat)} />
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{DOC_CATEGORY_LABELS[cat]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header">
                <span className="card-header__title">✅ Mandatory Criteria</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={addCriterion}>+ Add</button>
              </div>
              <div className="card-body">
                {criteria.map((c, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input className="form-control" placeholder="Key (e.g. turnover)" value={c.key} onChange={(e) => updateCriterion(i, 'key', e.target.value)} />
                    <input className="form-control" placeholder="Label (e.g. Minimum Annual Turnover)" value={c.label} onChange={(e) => updateCriterion(i, 'label', e.target.value)} />
                    <input className="form-control" placeholder="Required value" value={c.required_value} onChange={(e) => updateCriterion(i, 'required_value', e.target.value)} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeCriterion(i)} style={{ color: 'var(--ux4g-danger)' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="alert alert-danger" style={{ marginBottom: '16px' }}>❌ {error}</div>}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Link href="/dashboard/officer" className="btn btn-ghost">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating...</> : '🏛️ Publish Tender'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
