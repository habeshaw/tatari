import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Lock,
  Search,
  Users,
  X,
} from 'lucide-react';
import { TRANSLATIONS } from '../lib/i18n';
import { formatCurrencyEtb, formatRelativeDays } from '../lib/storeLogic';
import {
  calculateCohortTrainingQuote,
  filterTrainingPrograms,
  ORGANIZATION_SECTORS,
  TRAINING_DELIVERY_MODES,
  type CreateTrainingRequestInput,
} from '../lib/trainingLogic';
import type {
  AggregatedOpportunity,
  Language,
  TrainingDeliveryMode,
  TrainingFilterCriteria,
  TrainingProgram,
  TrainingRequest,
  UserProfile,
} from '../types/domain';

interface TrainingServicesViewProps {
  programs: TrainingProgram[];
  requests: TrainingRequest[];
  externalCourses?: AggregatedOpportunity[];
  currentUser: UserProfile | null;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  onSubmitTrainingRequest: (input: CreateTrainingRequestInput) => string | null;
  onDownloadProposal: (request: TrainingRequest) => void;
  onRequireAuth: () => void;
}

export const TrainingServicesView: React.FC<TrainingServicesViewProps> = ({
  programs,
  requests,
  externalCourses = [],
  currentUser,
  language,
  onToggleLanguage,
  onSubmitTrainingRequest,
  onDownloadProposal,
  onRequireAuth,
}) => {
  const t = TRANSLATIONS[language];

  const [trainingSectionTab, setTrainingSectionTab] = useState<'academy' | 'external'>('academy');
  const [criteria, setCriteria] = useState<TrainingFilterCriteria>({
    query: '',
    category: 'all',
    deliveryMode: 'all',
  });
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    () => programs.find((p) => p.active)?.id || programs[0]?.id || ''
  );
  const [requestModalProgram, setRequestModalProgram] = useState<TrainingProgram | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Proposal request form state
  const [organizationName, setOrganizationName] = useState(currentUser?.companyName || '');
  const [organizationSector, setOrganizationSector] = useState(ORGANIZATION_SECTORS[0]);
  const [contactPerson, setContactPerson] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '+251911');
  const [teamSize, setTeamSize] = useState(15);
  const [deliveryMode, setDeliveryMode] = useState<TrainingDeliveryMode>('On-Site (Your Premises)');
  const [preferredDates, setPreferredDates] = useState('Next Month · Flexible Weekdays');
  const [locationCity, setLocationCity] = useState('Addis Ababa');
  const [customTopics, setCustomTopics] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const visiblePrograms = useMemo(
    () => filterTrainingPrograms(programs, criteria, false),
    [programs, criteria]
  );

  const selectedProgram = useMemo(
    () =>
      visiblePrograms.find((p) => p.id === selectedProgramId) || visiblePrograms[0] || null,
    [visiblePrograms, selectedProgramId]
  );

  const myRequests = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return requests;
    return requests.filter(
      (r) => r.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()
    );
  }, [requests, currentUser]);

  const openTailorModal = (program: TrainingProgram) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setOrganizationName(currentUser.companyName || '');
    setContactPerson(currentUser.fullName || '');
    setPhone(currentUser.phone || '+251911');
    setTeamSize(program.maxParticipants);
    setDeliveryMode(program.deliveryModes[0] || 'On-Site (Your Premises)');
    setCustomTopics('');
    setFormError(null);
    setRequestModalProgram(program);
  };

  const liveQuote = useMemo(() => {
    if (!requestModalProgram) return null;
    return calculateCohortTrainingQuote(
      requestModalProgram.feePerCohortEtb,
      requestModalProgram.maxParticipants,
      teamSize,
      deliveryMode
    );
  }, [requestModalProgram, teamSize, deliveryMode]);

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestModalProgram) return;
    setFormError(null);

    const err = onSubmitTrainingRequest({
      programId: requestModalProgram.id,
      organizationName,
      organizationSector,
      contactPerson,
      phone,
      teamSize,
      deliveryMode,
      preferredDates,
      locationCity,
      customTopics,
    });

    if (err) {
      setFormError(err);
      return;
    }

    setRequestModalProgram(null);
  };

  const renderProgramDetail = (program: TrainingProgram) => {
    const title = language === 'am' && program.titleAm ? program.titleAm : program.titleEn;
    return (
      <div className="flex flex-col">
        <div className="border-b border-slate-200 pb-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
            {program.category} · {program.durationLabel}
          </div>
          <h2 className="mt-1 font-display text-xl font-bold text-slate-900 sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 text-xs font-medium text-slate-600">
            Designed for: <strong className="text-slate-900">{program.targetAudience}</strong>
          </p>
          <p className="mt-2 font-mono text-sm font-bold text-[#164081] tabular-nums">
            {formatCurrencyEtb(program.feePerCohortEtb)} / cohort (up to {program.maxParticipants}{' '}
            participants)
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openTailorModal(program)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#102E61] whitespace-nowrap shrink-0"
            >
              <GraduationCap className="h-4 w-4" />
              <span>Tailor &amp; Request Proposal</span>
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-5 text-sm leading-relaxed text-slate-700">
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500">
              Curriculum Overview
            </h3>
            <p className="mt-2 text-slate-700">{program.summaryEn}</p>
          </div>

          <dl className="grid grid-cols-1 gap-3 border-y border-slate-100 py-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Delivery Formats</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {program.deliveryModes.join(' · ')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Industry / Org Focus</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {program.sectorFocus.join(' · ')}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Core Syllabus Modules (Tailored to Your Org Data)
            </h3>
            <ul className="mt-2 space-y-2 text-xs text-slate-700">
              {program.syllabusModules.map((mod, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[#0F766E] shrink-0" />
                  <span>{mod}</span>
                </li>
              ))}
            </ul>
          </div>

          {program.deliverables.length > 0 && (
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Included Deliverables
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-700">
                {program.deliverables.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#F7F8FA]">
      {/* Hero Banner */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                TATARI Academy · Organizational Capacity Building
              </div>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {t.trainingHeroTitle}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">{t.trainingHeroSubtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              <div
                role="group"
                aria-label="Language switch"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
              >
                <button
                  type="button"
                  onClick={() => onToggleLanguage('en')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    language === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLanguage('am')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    language === 'am'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  አማ
                </button>
              </div>

              {selectedProgram && (
                <button
                  type="button"
                  onClick={() => openTailorModal(selectedProgram)}
                  className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#102E61] whitespace-nowrap shrink-0"
                >
                  Request Custom Training
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={criteria.query}
                onChange={(e) => setCriteria((prev) => ({ ...prev, query: e.target.value }))}
                placeholder="Search curriculum, sector (NGO, Banking), or skill..."
                aria-label="Search corporate training programs"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter training by category"
              value={criteria.category}
              onChange={(e) => setCriteria((prev) => ({ ...prev, category: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none"
            >
              <option value="all">Category: All Tracks</option>
              <option value="Data & Power BI">Data &amp; Power BI</option>
              <option value="Payroll & HR Systems">Payroll &amp; HR Systems</option>
              <option value="Finance & IFRS">Finance &amp; IFRS</option>
              <option value="Leadership & Org Design">Leadership &amp; Org Design</option>
              <option value="Digital Transformation">Digital Transformation</option>
            </select>

            <select
              aria-label="Filter training by delivery mode"
              value={criteria.deliveryMode}
              onChange={(e) => setCriteria((prev) => ({ ...prev, deliveryMode: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none"
            >
              <option value="all">Delivery: All Formats</option>
              {TRAINING_DELIVERY_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {(criteria.query || criteria.category !== 'all' || criteria.deliveryMode !== 'all') && (
              <button
                type="button"
                onClick={() => setCriteria({ query: '', category: 'all', deliveryMode: 'all' })}
                className="text-xs font-semibold text-[#164081] hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Master-Detail Training Catalog */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Section Mode Tabs: TATARI Tailored Cohorts vs External Verified Bootcamps & Scholarships */}
        <div
          role="tablist"
          aria-label="Training & Courses Sections"
          className="mb-5 inline-flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={trainingSectionTab === 'academy'}
            onClick={() => setTrainingSectionTab('academy')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              trainingSectionTab === 'academy'
                ? 'bg-white text-[#164081] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            TATARI Academy Organizational Cohorts ({visiblePrograms.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={trainingSectionTab === 'external'}
            onClick={() => setTrainingSectionTab('external')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              trainingSectionTab === 'external'
                ? 'bg-white text-[#164081] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            External Courses, Bootcamps &amp; Scholarships ({externalCourses.length})
          </button>
        </div>

        {trainingSectionTab === 'external' ? (
          <section className="space-y-4" data-testid="external-training-list">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-lg font-bold text-slate-900">
                External Verified Scholarships, Fellowships &amp; Training Calls
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Collected directly from verified public Ethiopian and African educational feeds.
                Program fees and formal accreditation must always be confirmed on the original
                provider’s page — TATARI never assumes or fabricates accreditation.
              </p>
            </div>

            {externalCourses.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <GraduationCap className="mx-auto h-9 w-9 text-slate-400" />
                <h3 className="mt-3 font-display text-base font-bold text-slate-900">
                  No external courses or scholarship announcements loaded yet
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Wait a moment for live Ethiopian &amp; African feeds to finish syncing or visit the
                  Opportunities tab to refresh verified sources.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {externalCourses.map((course) => (
                  <article
                    key={course.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <div>
                      <div className="text-[11px] font-semibold text-[#0F766E]">
                        {course.sourceName} · {course.eligibilityOrCoverage}
                      </div>
                      <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                        {course.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
                        {course.summary}
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-600 tabular-nums">
                        <div>
                          <dt className="text-slate-400">Fee / Funding</dt>
                          <dd className="font-semibold text-slate-800">{course.priceOrFunding}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Accreditation</dt>
                          <dd className="font-semibold text-slate-800">
                            Verify on original provider
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="font-mono text-[11px] text-slate-500">
                        {course.publishedAt
                          ? `Published ${new Date(course.publishedAt).toLocaleDateString()}`
                          : 'Published date not provided'}
                      </span>
                      <a
                        href={course.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#164081] hover:underline"
                      >
                        <span>Original Provider</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums font-medium">
            Showing {visiblePrograms.length} tailored organizational{' '}
            {visiblePrograms.length === 1 ? 'program' : 'programs'}
          </span>
          <span>Live Virtual sessions include a 15% delivery discount</span>
        </div>

        {visiblePrograms.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              No matching training programs
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Clear filters or select any base track to request a 100% custom curriculum for your
              organization.
            </p>
            <button
              type="button"
              onClick={() => setCriteria({ query: '', category: 'all', deliveryMode: 'all' })}
              className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              Show All Training Tracks
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-3 lg:col-span-5" data-testid="training-program-list">
              {visiblePrograms.map((program) => {
                const isSelected = selectedProgram?.id === program.id;
                const title =
                  language === 'am' && program.titleAm ? program.titleAm : program.titleEn;

                return (
                  <article
                    key={program.id}
                    className={`rounded-xl border bg-white p-5 transition-colors ${
                      isSelected
                        ? 'border-[#164081] bg-[#F5F8FD] shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProgramId(program.id);
                        setMobileDetailOpen(true);
                      }}
                      className="w-full text-left focus-visible:outline-2 focus-visible:outline-[#164081]"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
                        {program.category}
                      </div>
                      <h3 className="mt-0.5 font-display text-base font-bold text-slate-900 hover:text-[#164081]">
                        {title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-600 tabular-nums">
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrencyEtb(program.feePerCohortEtb)} / cohort
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{program.durationLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>Up to {program.maxParticipants} seats</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {program.summaryEn}
                      </p>
                    </button>

                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                      <span className="min-w-0 truncate text-slate-500">
                        {program.deliveryModes[0]}
                        {program.deliveryModes.length > 1
                          ? ` +${program.deliveryModes.length - 1} more`
                          : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => openTailorModal(program)}
                        className="font-semibold text-[#164081] hover:underline whitespace-nowrap shrink-0"
                      >
                        Request Tailored Proposal →
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="hidden lg:sticky lg:top-22 lg:col-span-7 lg:block">
              {selectedProgram && (
                <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                  {renderProgramDetail(selectedProgram)}
                </div>
              )}
            </aside>
          </div>
        )}

        {/* Organizational Training Proposal Tracker */}
        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                {currentUser?.role === 'admin'
                  ? `All Organizational Training Proposals (${myRequests.length})`
                  : `Your Organization’s Training Proposals (${myRequests.length})`}
              </h2>
              <p className="text-xs text-slate-600">
                Track Trainer assignment, Administrator pricing review, and download tailored HTML
                proposals for executive approval.
              </p>
            </div>
            {!currentUser && (
              <button
                type="button"
                onClick={onRequireAuth}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In / Register Organization
              </button>
            )}
          </div>

          {!currentUser ? (
            <p className="mt-4 text-xs text-slate-600">
              Sign in or register an account to submit custom team training requests and download
              tailored curriculum proposals.
            </p>
          ) : myRequests.length === 0 ? (
            <p className="mt-4 text-xs text-slate-600">
              No training requests submitted under <strong>{currentUser.email}</strong> yet. Select
              any program above and click <strong>Tailor &amp; Request Proposal</strong>.
            </p>
          ) : (
            <div className="mt-4 space-y-3" data-testid="training-requests-list">
              {myRequests.map((req) => (
                <article
                  key={req.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums">
                      <span className="font-semibold text-[#164081]">{req.status}</span>
                      <span aria-hidden="true">·</span>
                      <span>{req.organizationName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{req.teamSize} participants</span>
                      <span aria-hidden="true">·</span>
                      <span>{req.deliveryMode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeDays(req.createdAt)}</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      {req.programTitle}
                    </h3>
                    <p className="text-xs text-slate-600">
                      Tailoring focus: {req.customTopics}
                    </p>
                    <div className="text-xs text-slate-600 tabular-nums">
                      Estimated Cohort Fee:{' '}
                      <strong className="font-mono text-slate-900">
                        {formatCurrencyEtb(req.estimatedFeeEtb)}
                      </strong>
                      {req.trainerAssigned && (
                        <span> · Assigned Facilitator: {req.trainerAssigned}</span>
                      )}
                    </div>
                    {req.proposalNotes && (
                      <p className="text-xs text-[#0F766E]">Academy Note: {req.proposalNotes}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDownloadProposal(req)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#164081] hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Download Proposal
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
          </>
        )}
      </main>

      {/* Mobile Detail Drawer */}
      {mobileDetailOpen && selectedProgram && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={selectedProgram.titleEn}
        >
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Training Curriculum
              </span>
              <button
                type="button"
                aria-label="Close curriculum details"
                onClick={() => setMobileDetailOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderProgramDetail(selectedProgram)}
          </div>
        </div>
      )}

      {/* Tailored Organizational Training Request Modal */}
      {requestModalProgram && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Tailor ${requestModalProgram.titleEn}`}
        >
          <form
            onSubmit={handleRequestSubmit}
            className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#0F766E]">
                  Custom Organization Training Request
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900">
                  {requestModalProgram.titleEn}
                </h2>
                <p className="text-xs text-slate-500">
                  {requestModalProgram.durationLabel} · Up to {requestModalProgram.maxParticipants}{' '}
                  included seats
                </p>
              </div>
              <button
                type="button"
                aria-label="Close training request modal"
                onClick={() => setRequestModalProgram(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
              >
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Organization / Institution Name *
                <div className="relative mt-1">
                  <Building2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="e.g. Dashen Bank S.C. / Mercy Corps"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </div>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Organization Sector *
                <select
                  value={organizationSector}
                  onChange={(e) => setOrganizationSector(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                >
                  {ORGANIZATION_SECTORS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Contact Person *
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Phone Number *
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Participants (Team Size) *
                <div className="relative mt-1">
                  <Users className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="number"
                    min={1}
                    max={250}
                    required
                    value={teamSize}
                    onChange={(e) => setTeamSize(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 tabular-nums focus:border-[#164081] focus:outline-none"
                  />
                </div>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Delivery Format *
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value as TrainingDeliveryMode)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                >
                  {TRAINING_DELIVERY_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                City / Venue *
                <input
                  type="text"
                  required
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g. Addis Ababa / Hawassa / Adama"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Preferred Schedule *
                <div className="relative mt-1">
                  <Calendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={preferredDates}
                    onChange={(e) => setPreferredDates(e.target.value)}
                    placeholder="e.g. Dec 15–16, 2026"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </div>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              How should we tailor this training to your organization? *
              <textarea
                rows={3}
                required
                value={customTopics}
                onChange={(e) => setCustomTopics(e.target.value)}
                placeholder="Describe your department workflows, software (Peachtree, SAP, Excel, Kobo), and specific outcomes expected..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>

            {liveQuote && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs tabular-nums">
                <div className="font-bold text-slate-900">
                  Instant Commercial Cohort Estimate
                </div>
                <dl className="mt-2 space-y-1 text-slate-700">
                  <div className="flex justify-between">
                    <dt>Base Cohort Fee (up to {liveQuote.includedSeats} seats)</dt>
                    <dd className="font-mono">{formatCurrencyEtb(liveQuote.baseCohortFeeEtb)}</dd>
                  </div>
                  {liveQuote.extraParticipants > 0 && (
                    <div className="flex justify-between">
                      <dt>
                        Extra Seats ({liveQuote.extraParticipants} × ETB 1,200)
                      </dt>
                      <dd className="font-mono">{formatCurrencyEtb(liveQuote.extraSeatFeeEtb)}</dd>
                    </div>
                  )}
                  {liveQuote.virtualDiscountEtb > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Live Virtual Delivery Discount (15%)</dt>
                      <dd className="font-mono">
                        -{formatCurrencyEtb(liveQuote.virtualDiscountEtb)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-[#10243B]">
                    <dt>Estimated Tailored Cohort Quote</dt>
                    <dd className="font-mono">{formatCurrencyEtb(liveQuote.estimatedTotalEtb)}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setRequestModalProgram(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-5 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                <Clock className="h-3.5 w-3.5" />
                Submit Tailored Training Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
