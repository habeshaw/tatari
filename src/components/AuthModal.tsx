import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { apiFetch, setStoredToken } from '../api';
import type { AuthUser } from '../types';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'seeker' | 'employer'>('seeker');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessTin, setBusinessTin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setStoredToken(res.token);
        onSuccess(res.user);
        onClose();
      } else {
        const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            password,
            role,
            company_name: role === 'employer' ? companyName : null,
            business_tin: role === 'employer' ? businessTin : null,
          }),
        });
        setStoredToken(res.token);
        onSuccess(res.user);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoAccount(demoEmail: string, demoPass: string) {
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900">
            {mode === 'login' ? 'Sign in to TATARI' : 'Create TATARI Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <span className="block text-xs font-medium text-slate-700 mb-1.5">Account Role</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('seeker')}
                      className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg border ${
                        role === 'seeker'
                          ? 'border-[#164081] bg-[#164081]/5 text-[#164081]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Job Seeker
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('employer')}
                      className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg border ${
                        role === 'employer'
                          ? 'border-[#164081] bg-[#164081]/5 text-[#164081]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Employer (TIN Verified)
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Abebe Kebede"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#164081]"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.et"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#164081]"
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#164081]"
              />
            </div>

            {mode === 'register' && role === 'employer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="auth-company" className="block text-xs font-medium text-slate-700 mb-1">
                    Company Name
                  </label>
                  <input
                    id="auth-company"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="EthioTech PLC"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#164081]"
                  />
                </div>
                <div>
                  <label htmlFor="auth-tin" className="block text-xs font-medium text-slate-700 mb-1">
                    Business TIN / License
                  </label>
                  <input
                    id="auth-tin"
                    type="text"
                    required
                    value={businessTin}
                    onChange={(e) => setBusinessTin(e.target.value)}
                    placeholder="TIN-00928174"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#164081]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] disabled:opacity-60 rounded-lg transition-colors"
            >
              {submitting ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2">Quick-fill evaluation accounts:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoAccount('abebe@tatari.et', 'Seeker@2026')}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Job Seeker
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('hr@addistech.et', 'Employer@2026')}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  Employer
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('admin@tatari.et', 'TatariAdmin#2026')}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#164081] bg-[#164081]/10 hover:bg-[#164081]/15 rounded-md"
                >
                  Administrator
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
