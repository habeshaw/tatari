import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Mic,
  MicOff,
  Sparkles,
  Target,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  buildCandidateProfileCorpus,
  rankJobsForCandidate,
} from '../lib/aiRecruitment';
import { downloadResumeAsPdf } from '../lib/pdfExport';
import type {
  AiEngineStatusResponse,
  AiInterviewEvaluation,
  AiInterviewQuestion,
  AiInterviewSession,
  AiJobMatchResult,
  AiJobRecommendation,
  AiResumeAnalysisResult,
  CandidateResumeFile,
  JobListing,
  UserProfile,
} from '../types/domain';

interface AiCareerStudioViewProps {
  currentUser: UserProfile | null;
  jobs: JobListing[];
  preselectedJobId?: string | null;
  interviewSessions: AiInterviewSession[];
  onSaveResumeToProfile: (resume: CandidateResumeFile) => void;
  onSaveInterviewSession: (session: AiInterviewSession) => void;
  onApplyJob: (job: JobListing) => void;
  onOpenAuth: () => void;
  onGoToProfile: () => void;
}

type StudioTab = 'recommendations' | 'analyzer' | 'matcher' | 'interview';

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const AiCareerStudioView: React.FC<AiCareerStudioViewProps> = ({
  currentUser,
  jobs,
  preselectedJobId = null,
  interviewSessions,
  onSaveResumeToProfile,
  onSaveInterviewSession,
  onApplyJob,
  onOpenAuth,
  onGoToProfile,
}) => {
  const [tab, setTab] = useState<StudioTab>(preselectedJobId ? 'matcher' : 'recommendations');
  const [engineStatus, setEngineStatus] = useState<AiEngineStatusResponse | null>(null);

  // Shared CV Workspace State
  const defaultCvText = useMemo(() => {
    if (!currentUser) return '';
    const primary = currentUser.resumes?.find((r) => r.isPrimary) || currentUser.resumes?.[0];
    return primary?.extractedText || buildCandidateProfileCorpus(currentUser);
  }, [currentUser]);

  const [cvText, setCvText] = useState<string>(defaultCvText);
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{
    fileName: string;
    fileType: 'pdf' | 'docx' | 'txt';
    fileSizeBytes: number;
  } | null>(null);
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  // Analyzer State
  const [targetRoleInput, setTargetRoleInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiResumeAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Matcher State
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'approved' && !j.isExpired),
    [jobs]
  );
  const [selectedMatchJobId, setSelectedMatchJobId] = useState<string>(
    preselectedJobId || activeJobs[0]?.id || ''
  );
  const [customJobTitle, setCustomJobTitle] = useState('');
  const [customJobDesc, setCustomJobDesc] = useState('');
  const [useCustomJobDesc, setUseCustomJobDesc] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<AiJobMatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<AiJobRecommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Mock Interview Coach State
  const [interviewJobId, setInterviewJobId] = useState<string>(
    preselectedJobId || activeJobs[0]?.id || ''
  );
  const [interviewQuestions, setInterviewQuestions] = useState<AiInterviewQuestion[]>([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [answersByQId, setAnswersByQId] = useState<Record<string, string>>({});
  const [evaluationsByQId, setEvaluationsByQId] = useState<Record<string, AiInterviewEvaluation>>({});
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isEvaluatingAnswer, setIsEvaluatingAnswer] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [sessionSavedBanner, setSessionSavedBanner] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const supportsVoice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (preselectedJobId) {
      setSelectedMatchJobId(preselectedJobId);
      setInterviewJobId(preselectedJobId);
      setTab('matcher');
    }
  }, [preselectedJobId]);

  useEffect(() => {
    if (!cvText && defaultCvText) {
      setCvText(defaultCvText);
    }
  }, [defaultCvText, cvText]);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AiEngineStatusResponse | null) => {
        if (data) setEngineStatus(data);
      })
      .catch(() => {});
  }, []);

  // Recompute / refresh recommendations dynamically when user profile or jobs update
  useEffect(() => {
    if (!currentUser || activeJobs.length === 0) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    const localRecs = rankJobsForCandidate(currentUser, activeJobs, 12);
    setRecommendations(localRecs);

    setIsLoadingRecs(true);
    fetch('/api/ai/recommendations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: currentUser, jobs: activeJobs }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { recommendations?: AiJobRecommendation[] } | null) => {
        if (!cancelled && data?.recommendations && data.recommendations.length > 0) {
          setRecommendations(data.recommendations);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingRecs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, activeJobs]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors
        }
      }
    };
  }, []);

  const handleCvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCvError(null);

    if (file.size > 5 * 1024 * 1024) {
      setCvError('Resume file exceeds the 5 MB upload limit.');
      return;
    }

    setIsParsingCv(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Read failed'));
        reader.onerror = () => reject(new Error('Unable to read uploaded file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/ai/parse-cv', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, base64Data }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        fileName?: string;
        fileType?: 'pdf' | 'docx' | 'txt';
        fileSizeBytes?: number;
        extractedText?: string;
      };
      if (!res.ok || !data.extractedText) {
        setCvError(data.error || 'Could not extract readable text from file.');
        return;
      }
      setCvText(data.extractedText);
      setUploadedFileMeta({
        fileName: data.fileName || file.name,
        fileType: data.fileType || 'txt',
        fileSizeBytes: data.fileSizeBytes || file.size,
      });
    } catch (err) {
      setCvError(err instanceof Error ? err.message : 'Failed to process CV file.');
    } finally {
      setIsParsingCv(false);
    }
  };

  const handleSaveParsedCv = () => {
    if (!currentUser || !cvText.trim()) return;
    const resume: CandidateResumeFile = {
      id: `cv-${Date.now()}`,
      fileName: uploadedFileMeta?.fileName || `CV_${currentUser.fullName.replace(/\s+/g, '_')}.txt`,
      fileType: uploadedFileMeta?.fileType || 'txt',
      fileSizeBytes: uploadedFileMeta?.fileSizeBytes || cvText.length,
      uploadedAt: new Date().toISOString(),
      extractedText: cvText.trim(),
      isPrimary: (currentUser.resumes || []).length === 0,
    };
    onSaveResumeToProfile(resume);
    setUploadedFileMeta(null);
  };

  const handleRunResumeAnalysis = async () => {
    setAnalysisError(null);
    if (cvText.trim().length < 25) {
      setAnalysisError('Upload a PDF/DOCX/TXT resume or paste at least 25 characters of CV text.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cvText, targetRole: targetRoleInput }),
      });
      const data = (await res.json()) as AiResumeAnalysisResult & { error?: string };
      if (!res.ok) {
        setAnalysisError(data.error || 'Resume analysis failed.');
        return;
      }
      setAnalysisResult(data);
    } catch {
      setAnalysisError('Could not connect to AI Resume Analyzer endpoint.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunJobMatch = async () => {
    setMatchError(null);
    if (cvText.trim().length < 25) {
      setMatchError('Provide your resume text or upload a CV file before running a match.');
      return;
    }

    let targetJob: JobListing | undefined;
    if (useCustomJobDesc) {
      if (customJobTitle.trim().length < 3 || customJobDesc.trim().length < 20) {
        setMatchError('Enter both a target job title and full description.');
        return;
      }
      targetJob = {
        id: 'custom-job',
        employerEmail: 'custom@tatari.et',
        titleEn: customJobTitle.trim(),
        companyName: 'Custom Target Employer',
        companyRating: 4.5,
        location: 'Ethiopia',
        remoteType: 'On-site',
        category: 'General',
        jobType: 'Full-time',
        experienceLevel: 'Mid-Level',
        salaryMin: 0,
        salaryMax: 0,
        salaryDisplay: 'Market Rate',
        deadline: '2026-12-31',
        summaryEn: customJobDesc.slice(0, 140),
        descriptionEn: customJobDesc,
        requirements: customJobDesc
          .split(/\n|[.;]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 10)
          .slice(0, 10),
        benefits: [],
        easyApply: false,
        postingFeeEtb: 0,
        status: 'approved',
        createdAt: new Date().toISOString(),
      };
    } else {
      targetJob = activeJobs.find((j) => j.id === selectedMatchJobId) || activeJobs[0];
    }

    if (!targetJob) {
      setMatchError('Select a job vacancy to compare against.');
      return;
    }

    setIsMatching(true);
    try {
      const res = await fetch('/api/ai/match-job', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cvText, job: targetJob }),
      });
      const data = (await res.json()) as AiJobMatchResult & { error?: string };
      if (!res.ok) {
        setMatchError(data.error || 'Resume-to-job matching failed.');
        return;
      }
      setMatchResult(data);
    } catch {
      setMatchError('Unable to reach AI Job Matcher service.');
    } finally {
      setIsMatching(false);
    }
  };

  const handleGenerateInterviewQuestions = async () => {
    setInterviewError(null);
    setSessionSavedBanner(false);
    const job = activeJobs.find((j) => j.id === interviewJobId) || activeJobs[0];
    if (!job) {
      setInterviewError('Select a target vacancy to start an AI mock interview.');
      return;
    }
    setIsGeneratingQuestions(true);
    try {
      const res = await fetch('/api/ai/interview/questions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.titleEn,
          jobDescription: job.descriptionEn,
          requirements: job.requirements,
        }),
      });
      const data = (await res.json()) as {
        questions?: AiInterviewQuestion[];
        error?: string;
      };
      if (!res.ok || !data.questions?.length) {
        setInterviewError(data.error || 'Could not generate interview questions.');
        return;
      }
      setInterviewQuestions(data.questions);
      setActiveQuestionIdx(0);
      setAnswersByQId({});
      setEvaluationsByQId({});
    } catch {
      setInterviewError('Unable to reach AI Interview Coach endpoint.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleEvaluateActiveAnswer = async () => {
    const q = interviewQuestions[activeQuestionIdx];
    const job = activeJobs.find((j) => j.id === interviewJobId) || activeJobs[0];
    if (!q) return;
    const ans = (answersByQId[q.id] || '').trim();
    if (ans.length < 5) {
      setInterviewError('Enter or dictate an answer (at least a few words) to evaluate.');
      return;
    }
    setInterviewError(null);
    setIsEvaluatingAnswer(true);
    try {
      const res = await fetch('/api/ai/interview/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: q,
          answer: ans,
          jobTitle: job?.titleEn || 'Target Role',
          requirements: job?.requirements || [],
        }),
      });
      const data = (await res.json()) as AiInterviewEvaluation & { error?: string };
      if (!res.ok || typeof data.overallScore !== 'number') {
        setInterviewError(data.error || 'Answer evaluation failed.');
        return;
      }
      setEvaluationsByQId((prev) => ({ ...prev, [q.id]: data }));
    } catch {
      setInterviewError('Unable to reach AI Interview evaluation endpoint.');
    } finally {
      setIsEvaluatingAnswer(false);
    }
  };

  const toggleVoiceRecording = () => {
    if (!supportsVoice) return;
    const q = interviewQuestions[activeQuestionIdx];
    if (!q) return;

    if (isRecordingVoice && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecordingVoice(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechCtor) return;

    const rec = new SpeechCtor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0]?.transcript ? `${event.results[i][0].transcript} ` : '';
      }
      const clean = transcript.trim();
      if (clean) {
        setAnswersByQId((prev) => ({
          ...prev,
          [q.id]: prev[q.id] ? `${prev[q.id].trim()} ${clean}` : clean,
        }));
      }
    };
    rec.onerror = () => setIsRecordingVoice(false);
    rec.onend = () => setIsRecordingVoice(false);

    recognitionRef.current = rec;
    rec.start();
    setIsRecordingVoice(true);
  };

  const handleSaveInterviewPractice = () => {
    const evaluatedList = Object.values(evaluationsByQId) as AiInterviewEvaluation[];
    if (evaluatedList.length === 0) return;
    const job = activeJobs.find((j) => j.id === interviewJobId) || activeJobs[0];
    const avg = Math.round(
      evaluatedList.reduce((sum, ev) => sum + ev.overallScore, 0) / evaluatedList.length
    );
    const session: AiInterviewSession = {
      id: `isess-${Date.now()}`,
      userEmail: currentUser?.email || 'guest@tatari.et',
      jobId: job?.id,
      jobTitle: job?.titleEn || 'Mock Interview Practice',
      questions: interviewQuestions,
      answers: answersByQId,
      evaluations: evaluationsByQId,
      averageScore: avg,
      completedAt: new Date().toISOString(),
    };
    onSaveInterviewSession(session);
    setSessionSavedBanner(true);
  };

  const myInterviewHistory = useMemo(
    () =>
      currentUser
        ? interviewSessions.filter(
            (s) => s.userEmail.toLowerCase() === currentUser.email.toLowerCase()
          )
        : interviewSessions.slice(0, 5),
    [interviewSessions, currentUser]
  );

  const activeQuestion = interviewQuestions[activeQuestionIdx] || null;
  const activeEvaluation = activeQuestion ? evaluationsByQId[activeQuestion.id] : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#164081]">
              <Sparkles className="h-4 w-4" />
              <span>TATARI AI Recruitment &amp; Career Studio</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Intelligent CV Scanner, Job Matching &amp; Interview Coach
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Evidence-based career matching, PDF/DOCX resume diagnostics, tailored CV generation, and
              interactive mock interviews—strictly grounded in your real experience.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs">
            <div className="font-semibold text-slate-500">Active AI Analysis Engine</div>
            <div className="mt-0.5 flex items-center gap-1.5 font-bold text-slate-900">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  engineStatus?.openAiConfigured ? 'bg-emerald-600' : 'bg-[#164081]'
                }`}
              />
              <span>
                {engineStatus?.openAiConfigured
                  ? `OpenAI API · ${engineStatus.model}`
                  : 'TATARI Evidence NLP Engine'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="AI Career Studio tools"
          className="mt-6 inline-flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recommendations'}
            onClick={() => setTab('recommendations')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'recommendations'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Job Recommendations
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'analyzer'}
            onClick={() => setTab('analyzer')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'analyzer'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Resume Analyzer &amp; Scanner
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'matcher'}
            onClick={() => setTab('matcher')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'matcher'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Resume-to-Job Matcher
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'interview'}
            onClick={() => setTab('interview')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'interview'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Mock Interview Coach
          </button>
        </div>
      </div>

      {/* TAB 1: Smart AI Job Recommendations */}
      {tab === 'recommendations' && (
        <section className="mt-6 space-y-5">
          {!currentUser ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <UserCheck className="mx-auto h-10 w-10 text-[#164081]" />
              <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
                Sign In to Unlock Personalized AI Job Recommendations
              </h2>
              <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
                Create or sign in to a candidate profile with your skills, experience, location, and
                uploaded CV to receive ranked job compatibility matches and skill-gap insights. You
                can also test the Resume Analyzer, Matcher, or Interview Coach directly.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
                >
                  Sign In / Register Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setTab('analyzer')}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Try AI Resume Analyzer
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Personalized Matches for {currentUser.fullName}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Profile signals: {(currentUser.skills || []).length} tracked skills ·{' '}
                    {(currentUser.resumes || []).length} stored CV(s) · Location:{' '}
                    {currentUser.location || 'Ethiopia'}
                    {isLoadingRecs ? ' · Updating rankings...' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onGoToProfile}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#164081] hover:bg-slate-50"
                >
                  Update Profile Skills &amp; CVs
                </button>
              </div>

              {recommendations.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                  Add skills, experience, or upload a CV in your profile to generate job
                  recommendations.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {recommendations.map((rec) => {
                    const job = activeJobs.find((j) => j.id === rec.jobId);
                    if (!job) return null;
                    return (
                      <article
                        key={rec.jobId}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                {job.category} · {job.location} ({job.remoteType})
                              </div>
                              <h3 className="mt-0.5 font-display text-base font-bold text-slate-900">
                                {job.titleEn}
                              </h3>
                              <p className="text-xs font-medium text-slate-600">
                                {job.companyName} · {job.salaryDisplay}
                              </p>
                            </div>
                            <div className="shrink-0 rounded-lg border border-[#164081]/20 bg-[#F0F5FF] px-3 py-1.5 text-center">
                              <div className="font-mono text-lg font-extrabold text-[#164081] tabular-nums">
                                {rec.compatibilityScore}%
                              </div>
                              <div className="text-[10px] font-semibold uppercase text-slate-600">
                                Match
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                            {rec.matchReasons.map((reason, idx) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>

                          {rec.missingSkillsToLearn.length > 0 && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                              <span className="font-semibold">Skills to develop: </span>
                              {rec.missingSkillsToLearn.join(', ')}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                          {job.sourceType === 'external' && job.sourceUrl ? (
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-[#164081] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                            >
                              Apply on {job.sourceSite || 'Source Site'}
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onApplyJob(job)}
                              className="rounded-lg bg-[#164081] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                            >
                              Apply Now
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMatchJobId(job.id);
                              setUseCustomJobDesc(false);
                              setTab('matcher');
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Tailor CV for Role
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInterviewJobId(job.id);
                              setTab('interview');
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Practice Interview
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* TAB 2 & 3 Shared CV Input Box */}
      {(tab === 'analyzer' || tab === 'matcher') && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                Candidate Resume / CV Source (PDF, DOCX, TXT or Text)
              </h2>
              <p className="text-xs text-slate-500">
                Upload a resume (up to 5 MB), select one of your saved profile CVs, or paste text
                directly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentUser?.resumes && currentUser.resumes.length > 0 && (
                <select
                  aria-label="Load saved resume"
                  defaultValue=""
                  onChange={(e) => {
                    const picked = currentUser.resumes?.find((r) => r.id === e.target.value);
                    if (picked) {
                      setCvText(picked.extractedText);
                      setUploadedFileMeta(null);
                    }
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="" disabled>
                    Load Saved Profile CV ({currentUser.resumes.length})
                  </option>
                  {currentUser.resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fileName}
                    </option>
                  ))}
                </select>
              )}

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#164081] bg-[#F0F5FF] px-3.5 py-1.5 text-xs font-semibold text-[#164081] hover:bg-blue-100">
                <Upload className="h-3.5 w-3.5" />
                <span>{isParsingCv ? 'Extracting CV...' : 'Upload PDF / DOCX / TXT'}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleCvFileUpload}
                  className="sr-only"
                />
              </label>

              {currentUser && uploadedFileMeta && (
                <button
                  type="button"
                  onClick={handleSaveParsedCv}
                  className="rounded-lg bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0D625C]"
                >
                  Save "{uploadedFileMeta.fileName}" to Profile
                </button>
              )}
            </div>
          </div>

          {cvError && (
            <div
              role="alert"
              className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{cvError}</span>
            </div>
          )}

          <textarea
            rows={6}
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder="Paste your CV / resume content here or upload a PDF/DOCX file above..."
            aria-label="Candidate resume text"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-800 focus:border-[#164081] focus:outline-none"
          />
        </div>
      )}

      {/* TAB 2: AI Resume Analyzer & CV Scanner */}
      {tab === 'analyzer' && (
        <section className="mt-6 space-y-5">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <label className="min-w-[240px] flex-1 text-xs font-semibold text-slate-700">
              Target Job Role for Keyword Gap Check (Optional)
              <input
                type="text"
                value={targetRoleInput}
                onChange={(e) => setTargetRoleInput(e.target.value)}
                placeholder="e.g. Senior React Engineer, Payroll & Tax Officer, M&E Specialist"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleRunResumeAnalysis}
              className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61] disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isAnalyzing ? 'Analyzing Resume...' : 'Run AI Resume Audit'}</span>
            </button>
          </div>

          {analysisError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
            >
              {analysisError}
            </div>
          )}

          {analysisResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Overall CV Quality Score
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-extrabold text-[#164081] tabular-nums">
                      {analysisResult.overallScore}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">/ 100</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Evaluated by {analysisResult.modelLabel}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Section Breakdown
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {Object.entries(analysisResult.sectionScores).map(([key, val]) => (
                      <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                        <div className="text-[11px] font-semibold capitalize text-slate-600">
                          {key}
                        </div>
                        <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
                          {val}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-sm font-bold text-emerald-800">
                    Verified Strengths &amp; Extracted Skills
                  </h3>
                  <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-xs text-slate-700">
                    {analysisResult.strengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                  {analysisResult.extractedSkills.length > 0 && (
                    <div className="mt-3 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Detected skills: </span>
                      {analysisResult.extractedSkills.join(', ')}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-sm font-bold text-amber-800">
                    Weaknesses, Missing Information &amp; Keywords
                  </h3>
                  <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-xs text-slate-700">
                    {analysisResult.weaknesses.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                    {analysisResult.missingInfo.map((m, idx) => (
                      <li key={`mi-${idx}`}>Missing section/detail: {m}</li>
                    ))}
                  </ul>
                  {analysisResult.missingKeywords.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <span className="font-semibold">Target role keywords absent from CV: </span>
                      {analysisResult.missingKeywords.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      ATS-Normalized Improved Resume Draft
                    </h3>
                    <p className="text-xs text-slate-500">
                      Built exclusively from verified facts extracted from your CV without invented
                      history.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadResumeAsPdf(
                        'TATARI_Improved_Resume.pdf',
                        'Improved Candidate Resume (TATARI AI Studio)',
                        analysisResult.improvedResumeText
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D625C]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Improved Resume (.pdf)
                  </button>
                </div>
                <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
                  {analysisResult.improvedResumeText}
                </pre>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: AI Resume-to-Job Matcher */}
      {tab === 'matcher' && (
        <section className="mt-6 space-y-5">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#164081]">
                <Target className="h-4 w-4" />
                <span>Select Target Vacancy or Paste Job Description</span>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={useCustomJobDesc}
                  onChange={(e) => setUseCustomJobDesc(e.target.checked)}
                />
                <span>Compare against a custom job description</span>
              </label>
            </div>

            {!useCustomJobDesc ? (
              <select
                aria-label="Select job vacancy for matching"
                value={selectedMatchJobId}
                onChange={(e) => setSelectedMatchJobId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              >
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.titleEn} — {j.companyName} ({j.location})
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={customJobTitle}
                  onChange={(e) => setCustomJobTitle(e.target.value)}
                  placeholder="Target Job Title (e.g. Finance & Grants Manager)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
                <textarea
                  rows={4}
                  value={customJobDesc}
                  onChange={(e) => setCustomJobDesc(e.target.value)}
                  placeholder="Paste full job description & key requirements..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={isMatching}
                onClick={handleRunJobMatch}
                className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61] disabled:opacity-60"
              >
                <Target className="h-4 w-4" />
                <span>{isMatching ? 'Computing Compatibility...' : 'Match CV & Tailor Resume'}</span>
              </button>
            </div>
          </div>

          {matchError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
            >
              {matchError}
            </div>
          )}

          {matchResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Job Compatibility Score
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-extrabold text-[#164081] tabular-nums">
                      {matchResult.compatibilityScore}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">/ 100</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    {matchResult.jobTitle} · {matchResult.companyName}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Evidence-Based Assessment
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-700">
                    {matchResult.explanation}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                      <div className="font-bold text-emerald-900">Matching Skills Found in CV</div>
                      <div className="mt-1 text-emerald-800">
                        {matchResult.matchingSkills.length > 0
                          ? matchResult.matchingSkills.join(', ')
                          : 'No direct lexicon overlaps detected.'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs">
                      <div className="font-bold text-amber-900">Missing or Under-Demonstrated</div>
                      <div className="mt-1 text-amber-900">
                        {matchResult.missingSkills.length > 0
                          ? matchResult.missingSkills.join(', ')
                          : 'All detected role skills are covered.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {matchResult.relevantExperience.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Relevant Verbatim Evidence from Your CV
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                    {matchResult.relevantExperience.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Role-Tailored Resume ({matchResult.jobTitle})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Re-ordered to highlight verified experience aligned to {matchResult.companyName}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadResumeAsPdf(
                        `Tailored_CV_${matchResult.jobTitle.replace(/\s+/g, '_')}.pdf`,
                        `Tailored Resume — ${matchResult.jobTitle}`,
                        matchResult.tailoredResumeText
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D625C]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Tailored CV (.pdf)
                  </button>
                </div>
                <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
                  {matchResult.tailoredResumeText}
                </pre>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: AI Mock Interview Coach */}
      {tab === 'interview' && (
        <section className="mt-6 space-y-5">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <label className="min-w-[260px] flex-1 text-xs font-semibold text-slate-700">
              Choose Target Vacancy for Mock Interview
              <select
                value={interviewJobId}
                onChange={(e) => setInterviewJobId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              >
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.titleEn} — {j.companyName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={isGeneratingQuestions}
              onClick={handleGenerateInterviewQuestions}
              className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61] disabled:opacity-60"
            >
              <Briefcase className="h-4 w-4" />
              <span>
                {isGeneratingQuestions ? 'Preparing Questions...' : 'Generate Mock Interview'}
              </span>
            </button>
          </div>

          {interviewError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
            >
              {interviewError}
            </div>
          )}

          {interviewQuestions.length > 0 && activeQuestion && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Interview Questions ({interviewQuestions.length})
                  </div>
                  <div className="mt-3 space-y-2">
                    {interviewQuestions.map((q, idx) => {
                      const done = Boolean(evaluationsByQId[q.id]);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setActiveQuestionIdx(idx)}
                          className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                            idx === activeQuestionIdx
                              ? 'border-[#164081] bg-[#F0F5FF]'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#164081]">
                              Q{idx + 1} · {q.category}
                            </span>
                            {done && (
                              <span className="font-mono font-bold text-emerald-700">
                                {evaluationsByQId[q.id].overallScore}/100
                              </span>
                            )}
                          </div>
                          <div className="mt-1 line-clamp-2 text-slate-700">{q.question}</div>
                        </button>
                      );
                    })}
                  </div>

                  {Object.keys(evaluationsByQId).length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveInterviewPractice}
                      className="mt-4 w-full rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D625C]"
                    >
                      Save Practice Session Report
                    </button>
                  )}
                  {sessionSavedBanner && (
                    <p className="mt-2 text-center text-xs font-semibold text-emerald-700">
                      Session saved to your Interview History below.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4 lg:col-span-8">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#164081]">
                    {activeQuestion.category} Question {activeQuestionIdx + 1} of{' '}
                    {interviewQuestions.length}
                  </div>
                  <h3 className="mt-1.5 font-display text-lg font-bold text-slate-900">
                    {activeQuestion.question}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Interviewer focus: {activeQuestion.focusTip}
                  </p>

                  <textarea
                    rows={5}
                    value={answersByQId[activeQuestion.id] || ''}
                    onChange={(e) =>
                      setAnswersByQId((prev) => ({ ...prev, [activeQuestion.id]: e.target.value }))
                    }
                    placeholder="Type your response using concrete examples (STAR method), or use voice dictation if supported..."
                    aria-label="Mock interview response"
                    className="mt-4 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    {supportsVoice ? (
                      <button
                        type="button"
                        onClick={toggleVoiceRecording}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold ${
                          isRecordingVoice
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isRecordingVoice ? (
                          <>
                            <MicOff className="h-3.5 w-3.5" />
                            Stop Voice Input
                          </>
                        ) : (
                          <>
                            <Mic className="h-3.5 w-3.5" />
                            Answer via Microphone
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Text interview mode active
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={isEvaluatingAnswer}
                      onClick={handleEvaluateActiveAnswer}
                      className="rounded-lg bg-[#164081] px-5 py-2 text-xs font-semibold text-white hover:bg-[#102E61] disabled:opacity-60"
                    >
                      {isEvaluatingAnswer ? 'Evaluating Answer...' : 'Evaluate Answer with AI'}
                    </button>
                  </div>
                </div>

                {activeEvaluation && (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500">
                          Coaching Feedback Summary
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-800">
                          {activeEvaluation.feedbackSummary}
                        </p>
                      </div>
                      <div className="font-mono text-2xl font-extrabold text-[#164081] tabular-nums">
                        {activeEvaluation.overallScore}/100
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <div className="rounded-lg bg-slate-50 p-2.5 text-xs">
                        <div className="text-slate-500">Communication</div>
                        <div className="font-mono font-bold text-slate-900">
                          {activeEvaluation.scores.communication}%
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5 text-xs">
                        <div className="text-slate-500">Relevance</div>
                        <div className="font-mono font-bold text-slate-900">
                          {activeEvaluation.scores.relevance}%
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5 text-xs">
                        <div className="text-slate-500">Clarity</div>
                        <div className="font-mono font-bold text-slate-900">
                          {activeEvaluation.scores.clarity}%
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5 text-xs">
                        <div className="text-slate-500">Technical Depth</div>
                        <div className="font-mono font-bold text-slate-900">
                          {activeEvaluation.scores.technicalKnowledge}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                      <div>
                        <div className="font-bold text-emerald-800">Strengths</div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                          {activeEvaluation.strengths.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-bold text-amber-800">How to Improve</div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                          {activeEvaluation.improvements.map((im, idx) => (
                            <li key={idx}>{im}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-[#F0F5FF] p-3.5 text-xs text-slate-800">
                      <div className="font-bold text-[#10243B]">Stronger Model Answer Structure</div>
                      <p className="mt-1 whitespace-pre-line">
                        {activeEvaluation.suggestedStrongerAnswer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {myInterviewHistory.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <FileText className="h-4 w-4 text-[#164081]" />
                <span>Saved Mock Interview Practice Reports ({myInterviewHistory.length})</span>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {myInterviewHistory.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{sess.jobTitle}</span> ·{' '}
                      <span className="text-slate-500">
                        {Object.keys(sess.evaluations).length} evaluated question(s) ·{' '}
                        {new Date(sess.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#164081]">
                      Avg Score: {sess.averageScore}/100
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
