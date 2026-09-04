'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { DocCategory } from '@/types';
import { DOC_CATEGORY_LABELS } from '@/types';

interface DocUploaderProps {
  category: DocCategory;
  onFileSelected: (category: DocCategory, file: File) => void;
  uploaded: boolean;
  fileName?: string;
}

function DocUploader({ category, onFileSelected, uploaded, fileName }: DocUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelected(category, acceptedFiles[0]);
      }
    },
    [category, onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'active' : ''} ${uploaded ? 'uploaded' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="dropzone__icon">
        {uploaded ? '✅' : isDragActive ? '📂' : '📄'}
      </div>
      <div className="dropzone__title" style={{ color: uploaded ? 'var(--ux4g-success)' : undefined }}>
        {uploaded ? fileName : `Upload ${DOC_CATEGORY_LABELS[category]}`}
      </div>
      <div className="dropzone__hint">
        {uploaded
          ? 'Click or drag to replace'
          : 'Drag & drop PDF or image here, or click to browse (max 10MB)'}
      </div>
    </div>
  );
}

interface BidUploaderProps {
  tenderId: string;
  tenderTitle: string;
  tenderNumber: string;
  requiredDocs: DocCategory[];
  existingBidId?: string;
  isClarification?: boolean;
}

export function BidUploader({
  tenderId,
  tenderTitle,
  tenderNumber,
  requiredDocs,
  existingBidId,
  isClarification = false,
}: BidUploaderProps) {
  const [files, setFiles] = useState<Record<DocCategory, File | null>>(
    () => Object.fromEntries(requiredDocs.map((d) => [d, null])) as Record<DocCategory, File | null>
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submittedBidId, setSubmittedBidId] = useState<string | null>(null);

  const handleFileSelected = (category: DocCategory, file: File) => {
    setFiles((prev) => ({ ...prev, [category]: file }));
  };

  const allRequired = requiredDocs.every((doc) => files[doc] !== null);

  const handleSubmit = async () => {
    if (!allRequired) {
      setError('Please upload all required documents before submitting.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('tender_id', tenderId);
      if (existingBidId) formData.append('bid_id', existingBidId);
      formData.append('is_clarification', String(isClarification));

      requiredDocs.forEach((cat) => {
        if (files[cat]) formData.append(`doc_${cat}`, files[cat]!);
      });

      const res = await fetch('/api/upload-bid', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setSubmittedBidId(data.bid_id);
      setSuccess('Documents uploaded successfully! Processing has started. You will be notified once the AI compliance audit is complete.');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="card animate-fadein" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="card-body" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
          <h3 style={{ color: 'var(--ux4g-success)', fontSize: '20px', marginBottom: '12px' }}>
            Submission Successful!
          </h3>
          <p style={{ color: 'var(--ux4g-gray-700)', marginBottom: '20px', lineHeight: '1.6' }}>
            {success}
          </p>
          <div className="alert alert-info" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <div>
              <strong>📋 Bid ID: <code style={{ fontSize: '13px' }}>{submittedBidId}</code></strong>
              <br />
              <span style={{ fontSize: '12px' }}>Track your status on the Dashboard</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Pipeline Progress */}
            <div className="step-progress">
              {['Submitted', 'OCR', 'Extraction', 'Gov. Check', 'AI Audit', 'Officer Review'].map((label, i) => (
                <div key={label} className="step-item">
                  <div className="step-inner">
                    <div className={`step-dot ${i === 0 ? 'completed' : i === 1 ? 'active' : 'pending'}`}>
                      {i === 0 ? '✓' : i + 1}
                    </div>
                    <div className="step-label">{label}</div>
                  </div>
                  {i < 5 && <div className={`step-line ${i === 0 ? 'completed' : ''}`} />}
                </div>
              ))}
            </div>
            <a href="/dashboard/bidder" className="btn btn-primary">
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card animate-fadein">
      <div className="card-header">
        <span className="card-header__title">
          📁 Document Submission — {tenderNumber}
        </span>
        {isClarification && (
          <span className="badge badge-warning badge-dot">Resubmission</span>
        )}
      </div>
      <div className="card-body">
        <div className="alert alert-info" style={{ marginBottom: '20px' }}>
          <div>
            <strong>ℹ️ {tenderTitle}</strong><br />
            <span style={{ fontSize: '12px' }}>
              Upload all required documents below. All files will be processed through AWS Textract OCR
              and Gemini AI for automated compliance verification.
            </span>
          </div>
        </div>

        {/* Mandatory checklist */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ux4g-gray-700)', marginBottom: '10px' }}>
            📋 Required Documents Checklist
          </h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {requiredDocs.map((doc) => (
              <span
                key={doc}
                className={`badge ${files[doc] ? 'badge-success' : 'badge-danger'} badge-dot`}
              >
                {DOC_CATEGORY_LABELS[doc]}
              </span>
            ))}
          </div>
        </div>

        <hr className="divider" />

        {/* Upload dropzones */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {requiredDocs.map((doc) => (
            <div key={doc}>
              <label className="form-label">
                {DOC_CATEGORY_LABELS[doc]} <span className="required">*</span>
              </label>
              <DocUploader
                category={doc}
                onFileSelected={handleFileSelected}
                uploaded={!!files[doc]}
                fileName={files[doc]?.name}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <a href="/dashboard/bidder" className="btn btn-ghost">Cancel</a>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !allRequired}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 16, height: 16 }} /> Uploading...</>
            ) : (
              `Submit ${isClarification ? 'Clarification' : 'Bid Application'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
