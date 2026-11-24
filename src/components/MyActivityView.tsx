import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bookmark,
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { formatCurrencyEtb, formatRelativeDays, canDownloadMaterial } from '../lib/storeLogic';
import type { SelfProfileUpdateInput } from '../lib/security';
import type {
  AggregatedOpportunity,
  CandidateEducationItem,
  CandidateExperienceItem,
  CandidateResumeFile,
  DigitalProduct,
  JobAlertConfig,
  JobApplication,
  JobListing,
  MaterialOrder,
  PaymentReceipt,
  PlatformNotification,
  TrainingRequest,
  UserProfile,
} from '../types/domain';

interface MyActivityViewProps {
  currentUserEmail: string;
  currentUser?: UserProfile | null;
  requestedTab?: 'orders' | 'applications' | 'saved' | 'training' | 'profile' | 'alerts';
  jobs: JobListing[];
  savedJobIds: string[];
  opportunities?: AggregatedOpportunity[];
  savedOpportunityIds?: string[];
  applications: JobApplication[];
  orders: MaterialOrder[];
  products: DigitalProduct[];
  receipts: PaymentReceipt[];
  trainingRequests: TrainingRequest[];
  jobAlerts?: JobAlertConfig[];
  notifications?: PlatformNotification[];
  onToggleSaveJob: (jobId: string) => void;
  onToggleSaveOpportunity?: (oppId: string) => void;
  onApplyJob: (job: JobListing) => void;
  onDownloadMaterial: (product: DigitalProduct, order: MaterialOrder) => void;
  onDownloadInvoice: (receipt: PaymentReceipt) => void;
  onDownloadTrainingProposal: (request: TrainingRequest) => void;
  onUpdateProfile?: (updates: SelfProfileUpdateInput) => string | null;
  onCreateJobAlert?: (alert: Omit<JobAlertConfig, 'id' | 'email' | 'createdAt'>) => void;
  onToggleJobAlert?: (alertId: string, patch: Partial<JobAlertConfig>) => void;
  onDeleteJobAlert?: (alertId: string) => void;
  onMarkNotificationRead?: (notifId: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onOpenAiStudio?: () => void;
  onBrowseJobs: () => void;
  onBrowseOpportunities?: () => void;
  onBrowseStore: () => void;
  onBrowseTraining: () => void;
  onRequireAuth: () => void;
}

const APPLICATION_TIMELINE_STAGES = [
  'Submitted',
  'Under Review',
  'Shortlisted',
  'Interview',
  'Offered',
  'Hired',
] as const;

export const MyActivityView: React.FC<MyActivityViewProps> = ({
  currentUserEmail,
  currentUser = null,
  requestedTab,
  jobs,
  savedJobIds,
  opportunities = [],
  savedOpportunityIds = [],
  applications,
  orders,
  products,
  receipts,
  trainingRequests,
  jobAlerts = [],
  notifications = [],
  onToggleSaveJob,
  onToggleSaveOpportunity,
  onApplyJob,
  onDownloadMaterial,
  onDownloadInvoice,
  onDownloadTrainingProposal,
  onUpdateProfile,
  onCreateJobAlert,
  onToggleJobAlert,
  onDeleteJobAlert,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenAiStudio,
  onBrowseJobs,
  onBrowseOpportunities,
  onBrowseStore,
  onBrowseTraining,
  onRequireAuth,
}) => {
  const [tab, setTab] = useState<
    'orders' | 'applications' | 'saved' | 'training' | 'profile' | 'alerts'
  >(requestedTab || 'orders');

  useEffect(() => {
    if (requestedTab) setTab(requestedTab);
  }, [requestedTab]);

  // Candidate Profile Editor State
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '+251911');
  const [headline, setHeadline] = useState(currentUser?.headline || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [yearsExp, setYearsExp] = useState(currentUser?.yearsExperience ?? 0);
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(currentUser?.avatarDataUrl);
  const [skillsText, setSkillsText] = useState((currentUser?.skills || []).join(', '));
  const [languagesText, setLanguagesText] = useState((currentUser?.languages || []).join(', '));
  const [certsText, setCertsText] = useState((currentUser?.certifications || []).join(', '));
  const [interestsText, setInterestsText] = useState(
    (currentUser?.careerInterests || []).join(', ')
  );
  const [experiences, setExperiences] = useState<CandidateExperienceItem[]>(
    currentUser?.experience || []
  );
  const [educations, setEducations] = useState<CandidateEducationItem[]>(
    currentUser?.education || []
  );
  const [resumes, setResumes] = useState<CandidateResumeFile[]>(currentUser?.resumes || []);
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError?: boolean } | null>(
    null
  );
  const [isUploadingCv, setIsUploadingCv] = useState(false);

  // Add Experience sub-form
  const [expTitle, setExpTitle] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expLoc, setExpLoc] = useState('Addis Ababa');
  const [expStart, setExpStart] = useState('2023-01');
  const [expEnd, setExpEnd] = useState('Present');
  const [expSummary, setExpSummary] = useState('');

  // Add Education sub-form
  const [eduDegree, setEduDegree] = useState('');
  const [eduInst, setEduInst] = useState('');
  const [eduField, setEduField] = useState('');
  const [eduYear, setEduYear] = useState('2022');

  // Job Alert Builder
  const [alertKeywords, setAlertKeywords] = useState('');
  const [alertLocation, setAlertLocation] = useState('Addis Ababa');
  const [alertCategory, setAlertCategory] = useState('all');
  const [alertRemote, setAlertRemote] = useState('all');
  const [alertMinSalary, setAlertMinSalary] = useState(0);
  const [alertEmailPref, setAlertEmailPref] = useState(true);
  const [alertInAppPref, setAlertInAppPref] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.fullName || '');
    setPhone(currentUser.phone || '+251911');
    setHeadline(currentUser.headline || '');
    setLocation(currentUser.location || '');
    setYearsExp(currentUser.yearsExperience ?? 0);
    setBio(currentUser.bio || '');
    setAvatarDataUrl(currentUser.avatarDataUrl);
    setSkillsText((currentUser.skills || []).join(', '));
    setLanguagesText((currentUser.languages || []).join(', '));
    setCertsText((currentUser.certifications || []).join(', '));
    setInterestsText((currentUser.careerInterests || []).join(', '));
    setExperiences(currentUser.experience || []);
    setEducations(currentUser.education || []);
    setResumes(currentUser.resumes || []);
  }, [currentUser]);

  if (!currentUserEmail) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
          <Lock className="mx-auto h-10 w-10 text-[#164081]" />
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900">
            Registration Required for Profile, Saved Jobs &amp; Orders
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in or register an account to manage your professional profile, upload CVs, configure
            job alerts, save jobs, manage digital store downloads, and track your applications.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRequireAuth}
              className="rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              Sign In / Register
            </button>
            <button
              type="button"
              onClick={onBrowseJobs}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Browse Jobs &amp; Apply
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myOrders = orders.filter(
    (o) => o.buyerEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const myApplications = applications.filter(
    (a) => a.applicantEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const myTrainingRequests = trainingRequests.filter(
    (r) => r.requesterEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const savedJobs = jobs.filter(
    (j) => savedJobIds.includes(j.id) && j.status === 'approved'
  );
  const savedOpportunities = opportunities.filter((o) =>
    savedOpportunityIds.includes(o.id)
  );
  const totalSavedCount = savedJobs.length + savedOpportunities.length;

  const myAlerts = jobAlerts.filter(
    (a) => a.email.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const myNotifications = notifications.filter(
    (n) => n.recipientEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  const parseCsvList = (val: string) =>
    val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage({ text: 'Profile picture must be under 2 MB.', isError: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadProfileCv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProfileMessage(null);
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ text: 'CV file exceeds 5 MB upload limit.', isError: true });
      return;
    }
    setIsUploadingCv(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Read error'));
        reader.onerror = () => reject(new Error('Unable to read file.'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/ai/parse-cv', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });
      const data = (await res.json()) as {
        error?: string;
        fileName?: string;
        fileType?: 'pdf' | 'docx' | 'txt';
        fileSizeBytes?: number;
        extractedText?: string;
      };
      if (!res.ok || !data.extractedText) {
        setProfileMessage({
          text: data.error || 'Could not extract readable text from CV.',
          isError: true,
        });
        return;
      }
      const nextResume: CandidateResumeFile = {
        id: `cv-${Date.now()}`,
        fileName: data.fileName || file.name,
        fileType: data.fileType || 'pdf',
        fileSizeBytes: data.fileSizeBytes || file.size,
        uploadedAt: new Date().toISOString(),
        extractedText: data.extractedText,
        isPrimary: resumes.length === 0,
      };
      const nextResumes = [nextResume, ...resumes];
      setResumes(nextResumes);
      if (onUpdateProfile) {
        onUpdateProfile({
          fullName: fullName || currentUser?.fullName || 'Candidate',
          phone: phone || currentUser?.phone || '+251911',
          resumes: nextResumes,
        });
      }
      setProfileMessage({
        text: `Uploaded & indexed "${nextResume.fileName}" cleanly into your profile.`,
      });
    } catch {
      setProfileMessage({ text: 'Failed to upload CV document.', isError: true });
    } finally {
      setIsUploadingCv(false);
    }
  };

  const handleSaveFullProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateProfile) return;
    setProfileMessage(null);
    const err = onUpdateProfile({
      fullName,
      phone,
      companyName: currentUser?.companyName,
      tinNumber: currentUser?.tinNumber,
      headline,
      location,
      bio,
      avatarDataUrl,
      yearsExperience: Number(yearsExp),
      skills: parseCsvList(skillsText),
      languages: parseCsvList(languagesText),
      certifications: parseCsvList(certsText),
      careerInterests: parseCsvList(interestsText),
      experience: experiences,
      education: educations,
      resumes,
    });
    if (err) {
      setProfileMessage({ text: err, isError: true });
      return;
    }
    setProfileMessage({
      text: 'Professional profile & career credentials saved. AI recommendations have updated.',
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {currentUser?.avatarDataUrl ? (
              <img
                src={currentUser.avatarDataUrl}
                alt={currentUser.fullName}
                className="h-12 w-12 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#164081] font-display text-base font-bold text-white">
                {(currentUser?.fullName || currentUserEmail).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
                Candidate Dashboard, Saved Activity &amp; Profile
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                Signed in as <span className="font-semibold text-slate-900">{currentUserEmail}</span>
                {currentUser?.headline ? ` · ${currentUser.headline}` : ''}
              </p>
            </div>
          </div>

          {onOpenAiStudio && (
            <button
              type="button"
              onClick={onOpenAiStudio}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open AI Career Studio
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Activity sections"
          className="mt-5 inline-flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'profile'}
            onClick={() => setTab('profile')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'profile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Profile &amp; CVs ({resumes.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'applications'}
            onClick={() => setTab('applications')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'applications'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Applications ({myApplications.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'alerts'}
            onClick={() => setTab('alerts')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'alerts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Job Alerts &amp; Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'saved'}
            onClick={() => setTab('saved')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'saved'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saved ({totalSavedCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'orders'}
            onClick={() => setTab('orders')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'orders'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchased Materials ({myOrders.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'training'}
            onClick={() => setTab('training')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'training'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Training Proposals ({myTrainingRequests.length})
          </button>
        </div>
      </div>

      {/* Tab: Candidate Profile, Experience, Education & Multiple CVs */}
      {tab === 'profile' && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveFullProfile}
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Professional Candidate Profile
                </h2>
                <p className="text-xs text-slate-500">
                  Powers your Easy Apply details and personalized AI Job Recommendations.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Photo</span>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="sr-only" />
              </label>
            </div>

            {profileMessage && (
              <div
                role="status"
                className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                  profileMessage.isError
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {profileMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Full Name *
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Phone Number *
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Professional Headline
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Full-Stack React & Node.js Engineer"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                City / Location
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Addis Ababa, Ethiopia"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Total Years of Experience
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={yearsExp}
                  onChange={(e) => setYearsExp(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 tabular-nums"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Career Interests / Target Sectors
                <input
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="IT & Data, Finance, NGO & Development"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Executive Bio / Career Summary
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Summarize your core expertise, achievements, and target roles..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Verified Skills (comma-separated)
              <input
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="TypeScript, React, SQL, Ethiopian Payroll, IFRS, Power BI"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Languages (comma-separated)
                <input
                  type="text"
                  value={languagesText}
                  onChange={(e) => setLanguagesText(e.target.value)}
                  placeholder="Amharic, English, Afaan Oromo"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Certifications (comma-separated)
                <input
                  type="text"
                  value={certsText}
                  onChange={(e) => setCertsText(e.target.value)}
                  placeholder="ACCA, PMP, Microsoft PL-300"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            {/* Work Experience List + Quick Add */}
            <div className="space-y-2.5 border-t border-slate-100 pt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Work Experience ({experiences.length})
              </div>
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {exp.title} · {exp.company}
                    </div>
                    <div className="text-slate-500">
                      {exp.location} · {exp.startDate} – {exp.endDate}
                    </div>
                    {exp.summary && <p className="mt-1 text-slate-700">{exp.summary}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExperiences((prev) => prev.filter((x) => x.id !== exp.id))}
                    className="rounded p-1 text-rose-600 hover:bg-rose-50"
                    aria-label={`Remove ${exp.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-slate-300 p-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Role title (e.g. Accountant)"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={expCompany}
                  onChange={(e) => setExpCompany(e.target.value)}
                  placeholder="Organization"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={expStart}
                  onChange={(e) => setExpStart(e.target.value)}
                  placeholder="Start (2022-01)"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={expEnd}
                  onChange={(e) => setExpEnd(e.target.value)}
                  placeholder="End (Present)"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={expSummary}
                  onChange={(e) => setExpSummary(e.target.value)}
                  placeholder="Key measurable outcome..."
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs sm:col-span-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!expTitle.trim() || !expCompany.trim()) return;
                    setExperiences((prev) => [
                      ...prev,
                      {
                        id: `exp-${Date.now()}`,
                        title: expTitle.trim(),
                        company: expCompany.trim(),
                        location: expLoc.trim() || 'Addis Ababa',
                        startDate: expStart.trim() || '2022',
                        endDate: expEnd.trim() || 'Present',
                        summary: expSummary.trim(),
                      },
                    ]);
                    setExpTitle('');
                    setExpCompany('');
                    setExpSummary('');
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded border border-[#164081] px-3 py-1.5 text-xs font-semibold text-[#164081] hover:bg-[#F0F5FF] sm:col-span-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Work Experience Entry
                </button>
              </div>
            </div>

            {/* Education List + Quick Add */}
            <div className="space-y-2.5 border-t border-slate-100 pt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Education ({educations.length})
              </div>
              {educations.map((ed) => (
                <div
                  key={ed.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {ed.degree} in {ed.fieldOfStudy}
                    </div>
                    <div className="text-slate-500">
                      {ed.institution} · Class of {ed.graduationYear}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEducations((prev) => prev.filter((x) => x.id !== ed.id))}
                    className="rounded p-1 text-rose-600 hover:bg-rose-50"
                    aria-label={`Remove ${ed.degree}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-slate-300 p-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={eduDegree}
                  onChange={(e) => setEduDegree(e.target.value)}
                  placeholder="Degree (e.g. BSc, MBA)"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={eduField}
                  onChange={(e) => setEduField(e.target.value)}
                  placeholder="Field of Study"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={eduInst}
                  onChange={(e) => setEduInst(e.target.value)}
                  placeholder="University / Institution"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={eduYear}
                  onChange={(e) => setEduYear(e.target.value)}
                  placeholder="Graduation Year"
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!eduDegree.trim() || !eduInst.trim()) return;
                    setEducations((prev) => [
                      ...prev,
                      {
                        id: `edu-${Date.now()}`,
                        degree: eduDegree.trim(),
                        institution: eduInst.trim(),
                        fieldOfStudy: eduField.trim() || 'General',
                        graduationYear: eduYear.trim() || '2024',
                      },
                    ]);
                    setEduDegree('');
                    setEduInst('');
                    setEduField('');
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded border border-[#164081] px-3 py-1.5 text-xs font-semibold text-[#164081] hover:bg-[#F0F5FF] sm:col-span-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Education Entry
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              <UserCheck className="h-4 w-4" />
              Save Full Candidate Profile
            </button>
          </form>

          {/* Right Column: Multiple CVs Manager */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Uploaded CVs &amp; Resumes ({resumes.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Upload PDF, DOCX, or TXT resumes (max 5 MB) for instant Easy Apply and AI review.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#164081] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102E61]">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isUploadingCv ? 'Parsing...' : 'Upload CV'}</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleUploadProfileCv}
                    className="sr-only"
                  />
                </label>
              </div>

              {resumes.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500">
                  No uploaded CV files stored yet. Upload a PDF or DOCX resume to unlock one-click
                  applying and AI CV scanning.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {resumes.map((cv) => (
                    <div
                      key={cv.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <FileText className="h-3.5 w-3.5 text-[#164081]" />
                            <span>{cv.fileName}</span>
                            {cv.isPrimary && (
                              <span className="rounded bg-[#0F766E] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {cv.fileType.toUpperCase()} · {Math.max(1, Math.round(cv.fileSizeBytes / 1024))} KB · Uploaded{' '}
                            {new Date(cv.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!cv.isPrimary && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = resumes.map((r) => ({
                                  ...r,
                                  isPrimary: r.id === cv.id,
                                }));
                                setResumes(updated);
                                onUpdateProfile?.({
                                  fullName: fullName || currentUser?.fullName || 'Candidate',
                                  phone: phone || currentUser?.phone || '+251911',
                                  resumes: updated,
                                });
                              }}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = resumes.filter((r) => r.id !== cv.id);
                              setResumes(updated);
                              onUpdateProfile?.({
                                fullName: fullName || currentUser?.fullName || 'Candidate',
                                phone: phone || currentUser?.phone || '+251911',
                                resumes: updated,
                              });
                            }}
                            className="rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                            aria-label={`Delete ${cv.fileName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-3 font-mono text-[11px] text-slate-600">
                        {cv.extractedText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tab: Job Alerts & Notifications */}
      {tab === 'alerts' && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Configure Job Alerts ({myAlerts.length})
              </h2>
              <p className="text-xs text-slate-500">
                Automatically receive alerts when matching jobs are approved or synced.
              </p>
            </div>

            {onCreateJobAlert && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onCreateJobAlert({
                    keywords: alertKeywords.trim(),
                    location: alertLocation.trim(),
                    category: alertCategory,
                    remoteType: alertRemote,
                    minSalaryEtb: Number(alertMinSalary) || 0,
                    emailEnabled: alertEmailPref,
                    inAppEnabled: alertInAppPref,
                    active: true,
                  });
                  setAlertKeywords('');
                }}
                className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block font-semibold text-slate-700">
                    Keywords / Role
                    <input
                      type="text"
                      required
                      value={alertKeywords}
                      onChange={(e) => setAlertKeywords(e.target.value)}
                      placeholder="e.g. React, Payroll, M&E"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block font-semibold text-slate-700">
                    Location
                    <input
                      type="text"
                      value={alertLocation}
                      onChange={(e) => setAlertLocation(e.target.value)}
                      placeholder="Addis Ababa, Remote"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                    />
                  </label>
                  <label className="block font-semibold text-slate-700">
                    Category
                    <select
                      value={alertCategory}
                      onChange={(e) => setAlertCategory(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                    >
                      <option value="all">All Categories</option>
                      <option value="IT & Data">IT &amp; Data</option>
                      <option value="HR & Admin">HR &amp; Admin</option>
                      <option value="Finance">Finance</option>
                      <option value="Engineering">Engineering</option>
                      <option value="NGO & Development">NGO &amp; Development</option>
                    </select>
                  </label>
                  <label className="block font-semibold text-slate-700">
                    Min Salary (ETB)
                    <input
                      type="number"
                      min={0}
                      value={alertMinSalary}
                      onChange={(e) => setAlertMinSalary(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={alertInAppPref}
                      onChange={(e) => setAlertInAppPref(e.target.checked)}
                    />
                    In-platform notifications
                  </label>
                  <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={alertEmailPref}
                      onChange={(e) => setAlertEmailPref(e.target.checked)}
                    />
                    Email digest notifications
                  </label>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 font-semibold text-white hover:bg-[#102E61]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Job Alert
                </button>
              </form>
            )}

            <div className="space-y-2.5">
              {myAlerts.length === 0 ? (
                <p className="text-xs text-slate-500">No saved job alerts yet.</p>
              ) : (
                myAlerts.map((al) => (
                  <div
                    key={al.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {al.keywords || 'Any Role'} · {al.location || 'Ethiopia'}
                      </div>
                      <div className="text-slate-500">
                        {al.category === 'all' ? 'All sectors' : al.category} ·{' '}
                        {al.emailEnabled ? 'Email ON' : 'Email OFF'} ·{' '}
                        {al.inAppEnabled ? 'In-App ON' : 'In-App OFF'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onToggleJobAlert && (
                        <button
                          type="button"
                          onClick={() => onToggleJobAlert(al.id, { active: !al.active })}
                          className={`rounded border px-2.5 py-1 font-semibold ${
                            al.active
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-300 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {al.active ? 'Active' : 'Paused'}
                        </button>
                      )}
                      {onDeleteJobAlert && (
                        <button
                          type="button"
                          onClick={() => onDeleteJobAlert(al.id)}
                          className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50"
                          aria-label="Delete alert"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notifications Inbox */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#164081]" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Notifications ({myNotifications.length})
                </h2>
              </div>
              {unreadCount > 0 && onMarkAllNotificationsRead && (
                <button
                  type="button"
                  onClick={onMarkAllNotificationsRead}
                  className="text-xs font-semibold text-[#164081] hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {myNotifications.length === 0 ? (
              <p className="text-xs text-slate-500">
                No notifications yet. Application stage changes and matching job alerts appear here.
              </p>
            ) : (
              <div className="space-y-2.5">
                {myNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-lg border p-3.5 text-xs ${
                      n.read ? 'border-slate-200 bg-white' : 'border-[#164081]/30 bg-[#F0F5FF]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900">{n.title}</div>
                      <span className="text-[11px] text-slate-500">
                        {formatRelativeDays(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700">{n.message}</p>
                    {!n.read && onMarkNotificationRead && (
                      <button
                        type="button"
                        onClick={() => onMarkNotificationRead(n.id)}
                        className="mt-2 font-semibold text-[#164081] hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 1: Purchased Digital Materials */}
      {tab === 'orders' && (
        <section className="mt-6">
          {myOrders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Download className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No material purchases yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Browse the Digital Store to purchase payroll engines, HR packs, or BI dashboards.
              </p>
              <button
                type="button"
                onClick={onBrowseStore}
                className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Explore Digital Store
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map((order) => {
                const product = products.find((p) => p.id === order.productId);
                const receipt = receipts.find((r) => r.id === order.paymentReceiptId);
                const unlocked = canDownloadMaterial(order);

                return (
                  <article
                    key={order.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-500 tabular-nums">
                        Order {order.id} · Receipt {receipt?.transactionRef || 'Pending'} ·{' '}
                        {receipt?.paymentMethod || 'Telebirr'} · {formatCurrencyEtb(order.amountEtb)}
                      </div>
                      <h2 className="mt-1 font-display text-base font-bold text-slate-900">
                        {order.productTitle}
                      </h2>
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        {unlocked ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Payment Verified &amp; Download Unlocked
                          </span>
                        ) : order.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                            <XCircle className="h-3.5 w-3.5" />
                            Rejected: {order.rejectionReason || 'Receipt verification failed'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <Clock className="h-3.5 w-3.5" />
                            Pending Administrator Payment Approval
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {unlocked && product ? (
                        <>
                          {receipt && (
                            <button
                              type="button"
                              onClick={() => onDownloadInvoice(receipt)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="h-4 w-4 text-[#164081]" />
                              Download Invoice
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDownloadMaterial(product, order)}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0D625C]"
                          >
                            <Download className="h-4 w-4" />
                            Download Material
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500 cursor-not-allowed"
                        >
                          <Lock className="h-4 w-4" />
                          {order.status === 'rejected'
                            ? 'Download Locked (Rejected)'
                            : 'Locked Until Admin Approval'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Applications with Stage Timeline */}
      {tab === 'applications' && (
        <section className="mt-6">
          {myApplications.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Briefcase className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No job applications yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Search open roles and submit an Easy Apply application.
              </p>
              <button
                type="button"
                onClick={onBrowseJobs}
                className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Find Jobs
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myApplications.map((app) => {
                const currentIdx = APPLICATION_TIMELINE_STAGES.indexOf(
                  app.status as (typeof APPLICATION_TIMELINE_STAGES)[number]
                );
                return (
                  <article
                    key={app.id}
                    className="rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-bold text-slate-900">
                          {app.jobTitle}
                        </h3>
                        <p className="text-xs text-slate-600">
                          {app.companyName} · Applied {formatRelativeDays(app.createdAt)}
                          {app.resumeFileName ? ` · CV: ${app.resumeFileName}` : ''}
                        </p>
                      </div>
                      <span
                        className={`rounded-lg px-3 py-1 text-xs font-bold ${
                          app.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : app.status === 'Hired' || app.status === 'Offered'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-[#F0F5FF] text-[#164081]'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    {app.status !== 'Rejected' && (
                      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {APPLICATION_TIMELINE_STAGES.map((st, idx) => {
                          const reached = currentIdx >= idx;
                          return (
                            <div
                              key={st}
                              className={`rounded border px-2 py-1.5 text-center text-[11px] font-semibold ${
                                reached
                                  ? 'border-[#164081] bg-[#F0F5FF] text-[#164081]'
                                  : 'border-slate-200 bg-slate-50 text-slate-400'
                              }`}
                            >
                              {st}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Saved Jobs & Opportunities */}
      {tab === 'saved' && (
        <section className="mt-6 space-y-6">
          {totalSavedCount === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Bookmark className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No saved jobs or opportunities
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Bookmark jobs, tenders, scholarships, or grants to review and act on them later.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onBrowseJobs}
                  className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                >
                  Browse Jobs
                </button>
                {onBrowseOpportunities && (
                  <button
                    type="button"
                    onClick={onBrowseOpportunities}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Browse Tenders &amp; Grants
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {savedJobs.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-600">
                    Saved Jobs ({savedJobs.length})
                  </h2>
                  {savedJobs.map((job) => {
                    const isExternal = job.sourceType === 'external' && Boolean(job.sourceUrl);
                    const sourceName = job.sourceSite || 'Ethiopian Job Portal';
                    return (
                      <article
                        key={job.id}
                        className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                      >
                        <div>
                          {isExternal && (
                            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#164081]">
                              Source · {sourceName} ({job.sourceDomain})
                            </div>
                          )}
                          <h3 className="font-display text-base font-bold text-slate-900">
                            {job.titleEn}
                          </h3>
                          <p className="mt-1 text-xs text-slate-600 tabular-nums">
                            {job.companyName} · {job.location} · {job.salaryDisplay}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onToggleSaveJob(job.id)}
                            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                          {isExternal ? (
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] whitespace-nowrap shrink-0"
                            >
                              <span>View on {sourceName}</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onApplyJob(job)}
                              className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                            >
                              Apply now
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {savedOpportunities.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-600">
                    Saved Tenders, Scholarships &amp; Grants ({savedOpportunities.length})
                  </h2>
                  {savedOpportunities.map((opp) => (
                    <article
                      key={opp.id}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#164081]">
                          {opp.category} · Source: {opp.sourceName} ({opp.sourceDomain}) ·{' '}
                          {opp.verificationStatus}
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900">
                          {opp.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 tabular-nums">
                          {opp.organization} · {opp.location} · Deadline: {opp.deadline}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {onToggleSaveOpportunity && (
                          <button
                            type="button"
                            onClick={() => onToggleSaveOpportunity(opp.id)}
                            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        )}
                        <a
                          href={opp.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] whitespace-nowrap shrink-0"
                        >
                          <span>View on {opp.sourceName}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Tab 4: Organizational Training Proposals */}
      {tab === 'training' && (
        <section className="mt-6">
          {myTrainingRequests.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <GraduationCap className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No organizational training requests yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Browse TATARI Academy tracks to request a tailored corporate or NGO training
                proposal.
              </p>
              <button
                type="button"
                onClick={onBrowseTraining}
                className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Explore Training Services
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myTrainingRequests.map((req) => (
                <article
                  key={req.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 tabular-nums">
                      <strong className="text-[#164081]">{req.status}</strong> ·{' '}
                      {req.organizationName} · {req.teamSize} participants · {req.deliveryMode}
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {req.programTitle}
                    </h2>
                    <div className="text-xs text-slate-600 tabular-nums">
                      Quoted Cohort Fee:{' '}
                      <strong className="font-mono text-slate-900">
                        {formatCurrencyEtb(req.estimatedFeeEtb)}
                      </strong>
                      {req.trainerAssigned && ` · Facilitator: ${req.trainerAssigned}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDownloadTrainingProposal(req)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#164081] hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Download Proposal
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
