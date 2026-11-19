import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { apiFetch, setStoredToken } from '../api';
import type { AuthUser, JobItem } from '../types';

interface ApplyModalProps {
  job: JobItem | null;
  user: AuthUser | null;
  onClose: () => void;
  onApplied: (newUser?: AuthUser) => void;
}

export function ApplyModal({ job, user, onClose, onApplied }: ApplyModalProps) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('+251 9');
  const [password, setPassword] = useState('');
  const [cvSummary, setCvSummary] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!job) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!job) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        message: string;
        token: string | null;
        user: AuthUser | null;
      }>(`/api/jobs/${job.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          applicant_name: user ? user.name : name,
          applicant_email: user ? user.email : email,
          applicant_phone: phone,
          password: user ? undefined : password,
          cv_summary: cvSummary,
          cover_note: coverNote,
        }),
      });
      if (res.token && res.user) {
        setStoredToken(res.token);
      }
      onApplied(res.user || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="apply-modal-title" className="text-lg font-bold text-slate-900">
              Apply on Tatari
            </h2>
            <p className="text-xs text-slate-500">
              {job.title} · {job.company_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close application dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {!user && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
              Applying directly registers your Job Seeker account on TATARI so you can track application status.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="apply-name" className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="apply-name"
                type="text"
                required
                value={user ? user.name : name}
                disabled={Boolean(user)}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tigist Alemu"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>
            <div>
              <label htmlFor="apply-email" className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="apply-email"
                type="email"
                required
                value={user ? user.email : email}
                disabled={Boolean(user)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tigist@example.et"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="apply-phone" className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                id="apply-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 911 223344"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            {!user && (
              <div>
                <label htmlFor="apply-password" className="block text-xs font-medium text-slate-700 mb-1">
                  Create Account Password
                </label>
                <input
                  id="apply-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="apply-cv" className="block text-xs font-medium text-slate-700 mb-1">
              Experience &amp; CV Summary / Portfolio Link
            </label>
            <input
              id="apply-cv"
              type="text"
              value={cvSummary}
              onChange={(e) => setCvSummary(e.target.value)}
              placeholder="5 years software engineering, BSc AAU, GitHub/LinkedIn URL"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label htmlFor="apply-cover" className="block text-xs font-medium text-slate-700 mb-1">
              Cover Note to Employer
            </label>
            <textarea
              id="apply-cover"
              rows={4}
              required
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="Briefly explain why you are a strong fit for this vacancy..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] disabled:opacity-60 rounded-lg"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
