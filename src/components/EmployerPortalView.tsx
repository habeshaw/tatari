import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../api';
import type { AuthUser, JobCategory, JobItem } from '../types';

interface EmployerPortalViewProps {
  user: AuthUser | null;
  onRequireAuth: () => void;
}

interface EmployerAppRow {
  id: number;
  job_title: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  cover_note: string;
  created_at: string;
}

export function EmployerPortalView({ user, onRequireAuth }: EmployerPortalViewProps) {
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [myJobs, setMyJobs] = useState<Array<JobItem & { applicant_count: number }>>([]);
  const [applications, setApplications] = useState<EmployerAppRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Post job form
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState(user?.company_name || '');
  const [location, setLocation] = useState('Addis Ababa');
  const [categoryId, setCategoryId] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [deadline, setDeadline] = useState('2026-12-20');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Telebirr');
  const [paymentRef, setPaymentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadEmployerData() {
    if (!user || (user.role !== 'employer' && user.role !== 'admin')) return;
    setLoading(true);
    try {
      const [catRes, empRes] = await Promise.all([
        apiFetch<{ categories: JobCategory[] }>('/api/categories'),
        apiFetch<{ jobs: Array<JobItem & { applicant_count: number }>; applications: EmployerAppRow[] }>(
          '/api/employer/jobs'
        ),
      ]);
      setCategories(catRes.categories);
      setMyJobs(empRes.jobs);
      setApplications(empRes.applications);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCompanyName(user?.company_name || '');
    loadEmployerData();
  }, [user]);

  if (!user || (user.role !== 'employer' && user.role !== 'admin')) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Employer Job Posting Portal</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Publish vacancies directly on TATARI (labeled &ldquo;Published on Tatari&rdquo;) with built-in applicant tracking. Sign in as a verified Employer or register with your Business TIN.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg"
          >
            Sign In as Employer
          </button>
        </div>
      </div>
    );
  }

  if (user.role === 'employer' && user.status !== 'approved') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-amber-200 rounded-xl p-8 space-y-2">
          <h1 className="text-lg font-bold text-slate-900">Employer TIN Verification Pending</h1>
          <p className="text-sm text-slate-600">
            Your company <strong>{user.company_name}</strong> ({user.business_tin}) is awaiting Administrator approval before posting vacancies.
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/employer/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title,
          company_name: companyName,
          location,
          category_id: categoryId ? Number(categoryId) : null,
          employment_type: employmentType,
          salary_min: salaryMin ? Number(salaryMin) : null,
          salary_max: salaryMax ? Number(salaryMax) : null,
          application_deadline: deadline,
          description,
          payment_method: paymentMethod,
          payment_ref: paymentRef,
        }),
      });
      setSuccessMsg(res.message);
      setTitle('');
      setDescription('');
      setPaymentRef('');
      await loadEmployerData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Employer Job Publishing Portal</h1>
        <p className="text-sm text-slate-600">
          {user.company_name || 'TATARI Employer'} · Verified Business TIN {user.business_tin || 'Approved'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Compose Tatari-Native Job Form */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Publish New Vacancy on Tatari</h2>
          {error && (
            <div role="alert" className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="emp-title" className="block text-xs font-medium text-slate-700 mb-1">
                Job Title
              </label>
              <input
                id="emp-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Frontend React Developer"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="emp-company" className="block text-xs font-medium text-slate-700 mb-1">
                  Company Name
                </label>
                <input
                  id="emp-company"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="emp-location" className="block text-xs font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  id="emp-location"
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="emp-cat" className="block text-xs font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  id="emp-cat"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">Auto-categorize</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="emp-type" className="block text-xs font-medium text-slate-700 mb-1">
                  Employment Type
                </label>
                <select
                  id="emp-type"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Internship">Internship</option>
                  <option value="Consultancy">Consultancy</option>
                </select>
              </div>
              <div>
                <label htmlFor="emp-deadline" className="block text-xs font-medium text-slate-700 mb-1">
                  Deadline
                </label>
                <input
                  id="emp-deadline"
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="emp-sal-min" className="block text-xs font-medium text-slate-700 mb-1">
                  Salary Min (ETB)
                </label>
                <input
                  id="emp-sal-min"
                  type="number"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                  placeholder="25000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="emp-sal-max" className="block text-xs font-medium text-slate-700 mb-1">
                  Salary Max (ETB)
                </label>
                <input
                  id="emp-sal-max"
                  type="number"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                  placeholder="45000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>

            <div>
              <label htmlFor="emp-desc" className="block text-xs font-medium text-slate-700 mb-1">
                Job Description &amp; Requirements
              </label>
              <textarea
                id="emp-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe responsibilities, qualifications, and experience..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            {user.role === 'employer' && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-slate-800">
                  Posting Fee Payment Receipt (500 ETB — Verified by Admin)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    aria-label="Posting Payment Method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Telebirr">Telebirr</option>
                    <option value="CBE Bank Transfer">CBE Bank Transfer</option>
                  </select>
                  <input
                    type="text"
                    required
                    aria-label="Posting Receipt Reference"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Receipt Ref (e.g. TB-550129)"
                    className="px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] disabled:opacity-60 rounded-lg"
            >
              {submitting ? 'Submitting...' : 'Submit Job Vacancy'}
            </button>
          </form>
        </section>

        {/* Published Vacancies & Applications */}
        <div className="lg:col-span-6 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Your Tatari Listings ({myJobs.length})</h2>
            {loading ? (
              <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />
            ) : myJobs.length === 0 ? (
              <p className="text-xs text-slate-500">No job postings submitted yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {myJobs.map((j) => (
                  <li key={j.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{j.title}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {j.location} · {j.applicant_count} applicants · Payment: {j.payment_status}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold capitalize ${
                        j.status === 'active'
                          ? 'text-emerald-700'
                          : j.status === 'pending_review'
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}
                    >
                      {j.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Incoming Applications ({applications.length})</h2>
            {applications.length === 0 ? (
              <p className="text-xs text-slate-500">No candidate applications received yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {applications.map((a) => (
                  <li key={a.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{a.applicant_name}</span>
                      <span className="text-slate-500">{a.job_title}</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {a.applicant_email} · {a.applicant_phone}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2">{a.cover_note}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
