import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Bookmark, Download, ExternalLink, Trash2 } from 'lucide-react';
import { apiFetch, getStoredToken } from '../api';
import type {
  AuthUser,
  DigitalOrder,
  JobAlert,
  JobCategory,
  JobItem,
  NotificationItem,
} from '../types';

interface SavedAndAlertsViewProps {
  user: AuthUser | null;
  onRequireAuth: () => void;
  onOpenJobPage: (slug: string) => void;
  onRemoveSavedJob: (jobId: number) => Promise<void>;
}

interface MyApplicationRow {
  id: number;
  job_title: string;
  company_name: string;
  location: string;
  slug: string;
  status: string;
  created_at: string;
}

export function SavedAndAlertsView({
  user,
  onRequireAuth,
  onOpenJobPage,
  onRemoveSavedJob,
}: SavedAndAlertsViewProps) {
  const [savedJobs, setSavedJobs] = useState<JobItem[]>([]);
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [applications, setApplications] = useState<MyApplicationRow[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Alert creation form state
  const [alertCategory, setAlertCategory] = useState('');
  const [alertLocation, setAlertLocation] = useState('');
  const [alertKeywords, setAlertKeywords] = useState('');
  const [alertOrigin, setAlertOrigin] = useState<'all' | 'external' | 'tatari'>('all');
  const [creatingAlert, setCreatingAlert] = useState(false);

  async function loadAll() {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [savedRes, alertsRes, notifRes, ordersRes, appsRes, catRes] = await Promise.all([
        apiFetch<{ savedJobs: JobItem[] }>('/api/saved-jobs'),
        apiFetch<{ alerts: JobAlert[] }>('/api/job-alerts'),
        apiFetch<{ notifications: NotificationItem[] }>('/api/notifications'),
        apiFetch<{ orders: DigitalOrder[] }>('/api/store/my-orders'),
        apiFetch<{ applications: MyApplicationRow[] }>('/api/my-applications'),
        apiFetch<{ categories: JobCategory[] }>('/api/categories'),
      ]);
      setSavedJobs(savedRes.savedJobs);
      setAlerts(alertsRes.alerts);
      setNotifications(notifRes.notifications);
      setOrders(ordersRes.orders);
      setApplications(appsRes.applications);
      setCategories(catRes.categories);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Sign in to access Saved Jobs, Alerts &amp; Orders</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Save Ethiopian vacancies across Ethiojobs, HaHuJobs, and Tatari, configure instant category/location alerts, and download approved Digital Store toolkits.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg"
          >
            Sign In or Register
          </button>
        </div>
      </div>
    );
  }

  async function handleCreateAlert(e: FormEvent) {
    e.preventDefault();
    setCreatingAlert(true);
    try {
      await apiFetch('/api/job-alerts', {
        method: 'POST',
        body: JSON.stringify({
          category_id: alertCategory ? Number(alertCategory) : null,
          location: alertLocation || null,
          keywords: alertKeywords || null,
          job_origin_pref: alertOrigin,
        }),
      });
      setAlertCategory('');
      setAlertLocation('');
      setAlertKeywords('');
      await loadAll();
    } finally {
      setCreatingAlert(false);
    }
  }

  async function handleDeleteAlert(id: number) {
    await apiFetch(`/api/job-alerts/${id}`, { method: 'DELETE' });
    await loadAll();
  }

  async function handleMarkNotificationsRead() {
    await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    await loadAll();
  }

  async function handleDownloadOrder(order: DigitalOrder) {
    const token = getStoredToken();
    const res = await fetch(`/api/store/orders/${order.id}/download`, {
      headers: token ? { 'x-tatari-token': token } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${order.product_title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Saved Jobs, Alerts &amp; Digital Orders</h1>
          <p className="text-sm text-slate-600">Signed in as {user.name} ({user.email})</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Alerts + Notifications + Saved Jobs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Job Alerts Section */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#164081]" />
                  Ethiopian Job Alerts
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">{alerts.length} active</span>
              </div>

              <form onSubmit={handleCreateAlert} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <select
                  aria-label="Alert Category"
                  value={alertCategory}
                  onChange={(e) => setAlertCategory(e.target.value)}
                  className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">Any Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="Alert Location"
                  value={alertLocation}
                  onChange={(e) => setAlertLocation(e.target.value)}
                  placeholder="City (e.g. Addis Ababa)"
                  className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  aria-label="Alert Keywords"
                  value={alertKeywords}
                  onChange={(e) => setAlertKeywords(e.target.value)}
                  placeholder="Keyword (e.g. Accountant)"
                  className="px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <div className="flex gap-2">
                  <select
                    aria-label="Alert Origin"
                    value={alertOrigin}
                    onChange={(e) => setAlertOrigin(e.target.value as 'all' | 'external' | 'tatari')}
                    className="px-2 py-2 text-xs bg-white border border-slate-300 rounded-lg flex-1"
                  >
                    <option value="all">All</option>
                    <option value="external">External</option>
                    <option value="tatari">Tatari</option>
                  </select>
                  <button
                    type="submit"
                    disabled={creatingAlert}
                    className="px-3 py-2 text-xs font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg whitespace-nowrap"
                  >
                    Add Alert
                  </button>
                </div>
              </form>

              {alerts.length > 0 && (
                <ul className="divide-y divide-slate-100 text-xs">
                  {alerts.map((a) => (
                    <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-slate-700">
                        <strong className="text-slate-900">{a.category_name || 'All Categories'}</strong>
                        {' · '}
                        {a.location || 'All Ethiopia'}
                        {a.keywords ? ` · "${a.keywords}"` : ''}
                        {' · '}
                        Origin: {a.job_origin_pref}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAlert(a.id)}
                        aria-label="Delete job alert"
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Notifications Feed */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">New Job Notifications</h2>
                {notifications.some((n) => n.is_read === 0) && (
                  <button
                    type="button"
                    onClick={handleMarkNotificationsRead}
                    className="text-xs font-medium text-[#164081] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No new notifications yet. Matching jobs from automated collections will notify you here.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <li key={n.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className={`text-xs font-semibold ${n.is_read ? 'text-slate-600' : 'text-slate-900'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500">{n.message}</p>
                      </div>
                      {n.link_slug && (
                        <button
                          type="button"
                          onClick={() => onOpenJobPage(n.link_slug!)}
                          className="text-xs font-semibold text-[#164081] hover:underline shrink-0"
                        >
                          View
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Saved Jobs */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#164081]" />
                Saved Jobs ({savedJobs.length})
              </h2>
              {savedJobs.length === 0 ? (
                <p className="text-xs text-slate-500">Bookmark any vacancy on the Job Board to track it here.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {savedJobs.map((job) => (
                    <li key={job.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                        <p className="text-xs text-slate-500">
                          {job.company_name} · {job.location} ·{' '}
                          {job.job_origin === 'external' ? `Source: ${job.source_name}` : 'Published on Tatari'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {job.job_origin === 'external' && job.original_job_url ? (
                          <a
                            href={job.original_job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                          >
                            Original
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenJobPage(job.slug)}
                            className="text-xs font-semibold text-[#164081] hover:underline"
                          >
                            View
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await onRemoveSavedJob(job.id);
                            await loadAll();
                          }}
                          aria-label={`Remove ${job.title}`}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Right Column: Digital Orders & Tatari Applications */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">Digital Store Orders ({orders.length})</h2>
              {orders.length === 0 ? (
                <p className="text-xs text-slate-500">You have not purchased any digital toolkits yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <li key={order.id} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{order.product_title}</p>
                          <p className="text-xs text-slate-500 font-mono tabular-nums">
                            {order.payment_method} · Ref: {order.payment_ref} · {order.amount_etb} ETB
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold capitalize ${
                            order.status === 'approved'
                              ? 'text-emerald-700'
                              : order.status === 'rejected'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      {order.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Toolkit
                        </button>
                      ) : order.status === 'rejected' ? (
                        <p className="text-xs text-red-700">
                          Rejected: {order.rejection_reason || 'Receipt could not be verified.'}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700">
                          Download locked pending Administrator receipt verification.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                My Tatari Job Applications ({applications.length})
              </h2>
              {applications.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Applications submitted directly to Tatari-published vacancies appear here.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {applications.map((app) => (
                    <li key={app.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{app.job_title}</p>
                        <p className="text-xs text-slate-500">
                          {app.company_name} · {app.location}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[#164081] capitalize">{app.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
