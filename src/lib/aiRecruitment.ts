import type {
  AiApplicantScreeningItem,
  AiInterviewEvaluation,
  AiInterviewQuestion,
  AiJobMatchResult,
  AiJobRecommendation,
  AiResumeAnalysisResult,
  JobAlertConfig,
  JobApplication,
  JobListing,
  UserProfile,
} from '../types/domain.ts';

export const MAX_CV_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const SKILL_LEXICON: string[] = [
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Node.js',
  'Express',
  'Python',
  'Java',
  'C#',
  'SQL',
  'PostgreSQL',
  'Supabase',
  'MongoDB',
  'Docker',
  'AWS',
  'Tailwind CSS',
  'REST API',
  'Git',
  'Microsoft Excel',
  'Excel',
  'Power BI',
  'Power Query',
  'DAX',
  'Tableau',
  'SPSS',
  'Stata',
  'KoboToolbox',
  'IFRS',
  'GAAP',
  'Peachtree',
  'QuickBooks',
  'SAP',
  'Odoo',
  'ERP',
  'Ethiopian Payroll',
  'Ethiopian Tax',
  'VAT',
  'Withholding Tax',
  'Pension Compliance',
  'Labor Proclamation 1156/2019',
  'HR Administration',
  'Recruitment',
  'Talent Acquisition',
  'Financial Modeling',
  'Cost Accounting',
  'Auditing',
  'Budgeting',
  'Project Management',
  'Monitoring & Evaluation',
  'MEL',
  'Donor Reporting',
  'Grant Management',
  'Supply Chain',
  'Procurement',
  'Logistics',
  'PLC Diagnostics',
  'Preventive Maintenance',
  'Electrical Engineering',
  'AutoCAD',
  'Quality Assurance',
  'Customer Service',
  'Sales',
  'Digital Marketing',
  'Communication',
  'Leadership',
  'Amharic',
  'English',
  'Afaan Oromo',
];

const STOPWORDS = new Set([
  'with',
  'that',
  'this',
  'from',
  'your',
  'have',
  'will',
  'work',
  'team',
  'experience',
  'years',
  'year',
  'skills',
  'ability',
  'strong',
  'good',
  'knowledge',
  'working',
  'ethiopia',
  'addis',
  'ababa',
  'plus',
  'degree',
  'related',
  'field',
  'including',
  'across',
  'ensure',
  'manage',
  'support',
  'using',
  'role',
  'position',
  'company',
  'required',
  'preferred',
  'month',
  'monthly',
]);

export function sanitizeResumePlainText(raw: string): string {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function validateUploadedCvBinary(
  fileName: string,
  fileSizeBytes: number,
  bytes?: Uint8Array
): { valid: boolean; fileType?: 'pdf' | 'docx' | 'txt'; error?: string } {
  const cleanName = String(fileName || '').trim();
  const extMatch = cleanName.toLowerCase().match(/\.(pdf|docx|txt)$/);
  if (!extMatch) {
    return { valid: false, error: 'Only .pdf, .docx, and .txt resume files are supported.' };
  }
  const fileType = extMatch[1] as 'pdf' | 'docx' | 'txt';

  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return { valid: false, error: 'Uploaded file appears to be empty.' };
  }
  if (fileSizeBytes > MAX_CV_FILE_BYTES) {
    return { valid: false, error: 'Resume file exceeds the 5 MB maximum upload limit.' };
  }

  if (bytes && bytes.length >= 4) {
    if (fileType === 'pdf') {
      const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (header !== '%PDF') {
        return { valid: false, error: 'Invalid PDF file signature.' };
      }
    } else if (fileType === 'docx') {
      // DOCX files are ZIP archives starting with PK (0x50, 0x4B)
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        return { valid: false, error: 'Invalid DOCX archive signature.' };
      }
    }
  }

  return { valid: true, fileType };
}

export function extractSkillsFromText(text: string): string[] {
  const hay = ` ${String(text || '').toLowerCase()} `;
  const found: string[] = [];
  const seenLower = new Set<string>();

  for (const skill of SKILL_LEXICON) {
    const lower = skill.toLowerCase();
    const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (regex.test(hay) && !seenLower.has(lower)) {
      seenLower.add(lower);
      found.push(skill);
    }
  }
  return found;
}

export function extractSignificantTerms(text: string): string[] {
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}

export function extractYearsOfExperienceFromText(text: string): number {
  const matches = [...String(text || '').matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/gi)];
  let maxYears = 0;
  for (const m of matches) {
    const val = Number(m[1]);
    if (Number.isFinite(val) && val <= 40 && val > maxYears) {
      maxYears = val;
    }
  }
  return maxYears;
}

export function extractJobKeywordsAndSkills(job: {
  titleEn: string;
  summaryEn?: string;
  descriptionEn?: string;
  requirements?: string[];
  skills?: string[];
  category?: string;
}): { skills: string[]; terms: string[] } {
  const fullText = [
    job.titleEn,
    job.category || '',
    job.summaryEn || '',
    job.descriptionEn || '',
    ...(job.requirements || []),
    ...(job.skills || []),
  ].join(' \n ');

  const detectedSkills = extractSkillsFromText(fullText);
  const explicitSkills = (job.skills || []).map((s) => s.trim()).filter(Boolean);
  const combinedSkills = [...new Set([...explicitSkills, ...detectedSkills])];
  const terms = extractSignificantTerms(fullText).slice(0, 35);
  return { skills: combinedSkills, terms };
}

export function computeDeterministicResumeAnalysis(
  rawCvText: string,
  targetRole: string = ''
): AiResumeAnalysisResult {
  const cvText = sanitizeResumePlainText(rawCvText);
  const wordCount = cvText ? cvText.split(/\s+/).filter(Boolean).length : 0;
  const extractedSkills = extractSkillsFromText(cvText);

  const hasEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(cvText);
  const hasPhone = /(?:\+?\d[\d\s-]{7,}\d)/.test(cvText);
  const hasSummarySection = /\b(summary|profile|objective|about)\b/i.test(cvText);
  const hasExperienceSection = /\b(experience|employment|work history|career)\b/i.test(cvText);
  const hasEducationSection = /\b(education|university|college|degree|bsc|ba|msc|ma|diploma)\b/i.test(cvText);
  const hasSkillsSection = /\b(skills|competencies|technologies|tools)\b/i.test(cvText);
  const quantifiedMetricsCount = (cvText.match(/\b\d+%|\b\d+\+|\bETB\s*[\d,]+/gi) || []).length;
  const bulletCount = (cvText.match(/(^|\n)\s*[-•*]/g) || []).length;

  const structure = Math.min(
    100,
    30 +
      (hasSummarySection ? 15 : 0) +
      (hasExperienceSection ? 20 : 0) +
      (hasEducationSection ? 18 : 0) +
      (hasSkillsSection ? 17 : 0)
  );
  const clarity = Math.min(
    100,
    25 +
      (wordCount >= 120 && wordCount <= 900 ? 35 : wordCount >= 50 ? 20 : 5) +
      Math.min(25, bulletCount * 5) +
      Math.min(15, quantifiedMetricsCount * 5)
  );
  const experience = Math.min(
    100,
    25 +
      (hasExperienceSection ? 30 : 0) +
      Math.min(25, extractYearsOfExperienceFromText(cvText) * 6) +
      Math.min(20, quantifiedMetricsCount * 7)
  );
  const education = Math.min(
    100,
    25 + (hasEducationSection ? 55 : 0) + (/\b(bsc|ba|msc|mba|phd|bachelor|master)\b/i.test(cvText) ? 20 : 0)
  );
  const skills = Math.min(100, 20 + Math.min(80, extractedSkills.length * 10));

  const overallScore = Math.round(
    structure * 0.2 + clarity * 0.2 + experience * 0.25 + education * 0.15 + skills * 0.2
  );

  const strengths: string[] = [];
  if (hasEmail && hasPhone) strengths.push('Clear contact details (email and phone) are present.');
  if (hasExperienceSection && bulletCount >= 2)
    strengths.push('Work history is organized into scannable bullet points.');
  if (quantifiedMetricsCount > 0)
    strengths.push(`Includes ${quantifiedMetricsCount} quantified impact metric(s) or figures.`);
  if (extractedSkills.length >= 4)
    strengths.push(`Demonstrates ${extractedSkills.length} recognizable domain/technical skills.`);
  if (hasEducationSection) strengths.push('Academic background and qualifications are stated.');
  if (strengths.length === 0) {
    strengths.push('Resume text was successfully extracted and indexed for evaluation.');
  }

  const weaknesses: string[] = [];
  const missingInfo: string[] = [];
  const suggestions: string[] = [];

  if (!hasEmail) missingInfo.push('Professional email address');
  if (!hasPhone) missingInfo.push('Active phone number');
  if (!hasSummarySection) {
    missingInfo.push('Executive / Professional Summary');
    suggestions.push('Add a concise 2-3 sentence Professional Summary at the top highlighting years of experience and core specialty.');
  }
  if (!hasExperienceSection) {
    weaknesses.push('No dedicated Work Experience heading detected.');
    suggestions.push('Include a clear "WORK EXPERIENCE" section with employer names, dates, and measurable outcomes.');
  }
  if (!hasEducationSection) {
    missingInfo.push('Education / Degree details');
    suggestions.push('Add an "EDUCATION" section listing degree, university/institution, and graduation year.');
  }
  if (!hasSkillsSection || extractedSkills.length < 4) {
    weaknesses.push('Core technical and domain skills section is thin or missing.');
    suggestions.push('List explicit tools, software, standards, and languages under a "SKILLS" section for ATS keyword visibility.');
  }
  if (quantifiedMetricsCount === 0) {
    weaknesses.push('Achievements lack measurable numbers (%, team size, ETB impact, turnaround times).');
    suggestions.push('Strengthen experience bullets with real metrics (e.g., team size supported, reporting time saved, accuracy rate).');
  }
  if (wordCount < 100) {
    weaknesses.push(`Resume is very brief (${wordCount} words); hiring managers need richer scope details.`);
  }

  const targetTerms = targetRole
    ? [...new Set([...extractSkillsFromText(targetRole), ...extractSignificantTerms(targetRole)])]
    : [];
  const lowerCv = cvText.toLowerCase();
  const missingKeywords = targetTerms
    .filter((term) => !lowerCv.includes(term.toLowerCase()))
    .slice(0, 10);

  if (missingKeywords.length > 0) {
    suggestions.push(
      `For the target role (${targetRole}), explicitly reflect truthful experience matching keywords: ${missingKeywords.slice(0, 5).join(', ')}.`
    );
  }

  // Construct an ATS-clean structured CV strictly from extracted source facts
  const lines = cvText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const headerLines = lines.slice(0, 3).join(' | ');
  const improvedSections: string[] = [
    headerLines || 'CANDIDATE RESUME',
    '============================================================',
  ];
  if (extractedSkills.length > 0) {
    improvedSections.push('', 'CORE COMPETENCIES & VERIFIED SKILLS', extractedSkills.join(' · '));
  }
  improvedSections.push('', 'STRUCTURED SOURCE CONTENT (ATS-NORMALIZED)', ...lines.slice(3));
  if (suggestions.length > 0) {
    improvedSections.push(
      '',
      'RECOMMENDED ACTION ITEMS BEFORE SUBMISSION (VERIFY & FILL ONLY TRUTHFUL DETAILS)',
      ...suggestions.map((s) => `[ ] ${s}`)
    );
  }

  return {
    engine: 'deterministic',
    modelLabel: 'TATARI Evidence NLP Engine',
    overallScore,
    sectionScores: { structure, clarity, experience, education, skills },
    extractedSkills,
    strengths,
    weaknesses,
    missingInfo,
    missingKeywords,
    suggestions,
    improvedResumeText: improvedSections.join('\n'),
    analyzedAt: new Date().toISOString(),
  };
}

export function computeDeterministicJobMatch(
  rawCvText: string,
  job: Pick<
    JobListing,
    'id' | 'titleEn' | 'companyName' | 'summaryEn' | 'descriptionEn' | 'requirements' | 'skills' | 'category' | 'experienceLevel'
  >
): AiJobMatchResult {
  const cvText = sanitizeResumePlainText(rawCvText);
  const cvLower = cvText.toLowerCase();
  const candidateSkills = extractSkillsFromText(cvText);
  const candidateTerms = new Set(extractSignificantTerms(cvText));
  const { skills: jobSkills, terms: jobTerms } = extractJobKeywordsAndSkills(job);

  const matchingSkills = jobSkills.filter(
    (s) =>
      candidateSkills.some((cs) => cs.toLowerCase() === s.toLowerCase()) ||
      cvLower.includes(s.toLowerCase())
  );
  const missingSkills = jobSkills.filter(
    (s) => !matchingSkills.some((ms) => ms.toLowerCase() === s.toLowerCase())
  );

  const matchingTerms = jobTerms.filter((t) => candidateTerms.has(t) || cvLower.includes(t));

  const skillRatio = jobSkills.length > 0 ? matchingSkills.length / jobSkills.length : 0.45;
  const termRatio = jobTerms.length > 0 ? matchingTerms.length / Math.min(jobTerms.length, 15) : 0.4;
  const cvYears = extractYearsOfExperienceFromText(cvText);
  const reqYears = extractYearsOfExperienceFromText(
    `${job.experienceLevel || ''} ${(job.requirements || []).join(' ')}`
  );
  const expRatio = reqYears > 0 ? Math.min(1, cvYears / reqYears) : cvYears > 0 ? 0.85 : 0.5;

  const rawScore = Math.round(
    Math.min(1, skillRatio) * 60 + Math.min(1, termRatio) * 25 + expRatio * 15
  );
  const compatibilityScore = Math.max(12, Math.min(98, rawScore));

  // Extract verbatim lines from candidate CV that demonstrate relevant experience
  const cvLines = cvText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 20);
  const relevantExperience = cvLines
    .filter((line) => {
      const lower = line.toLowerCase();
      return (
        matchingSkills.some((s) => lower.includes(s.toLowerCase())) ||
        matchingTerms.some((t) => lower.includes(t))
      );
    })
    .slice(0, 5);

  const explanationParts: string[] = [];
  if (matchingSkills.length > 0) {
    explanationParts.push(
      `Your resume evidences ${matchingSkills.length} of ${Math.max(jobSkills.length, matchingSkills.length)} role-relevant skills (${matchingSkills.slice(0, 6).join(', ')}).`
    );
  } else {
    explanationParts.push(
      `Limited direct skill keyword overlap detected against ${job.titleEn}.`
    );
  }
  if (reqYears > 0) {
    explanationParts.push(
      cvYears >= reqYears
        ? `Your stated ${cvYears}+ years of experience aligns with the role's ${reqYears}+ year expectation.`
        : `The role prefers ${reqYears}+ years of experience while your resume states ${cvYears} year(s).`
    );
  }

  const suggestions: string[] = [];
  if (missingSkills.length > 0) {
    suggestions.push(
      `If you possess truthful hands-on experience in ${missingSkills.slice(0, 5).join(', ')}, highlight specific deliverables in your summary and work history.`
    );
  }
  if (relevantExperience.length === 0) {
    suggestions.push(
      'Rewrite your top 3 bullet points to emphasize measurable projects aligned with this role description.'
    );
  }
  suggestions.push(
    `Lead your resume with a tailored target headline: "${job.titleEn} Candidate — Core Strengths in ${matchingSkills.slice(0, 3).join(', ') || job.category}".`
  );

  // Build Tailored CV strictly preserving ONLY candidate facts
  const prioritizedLines = [
    ...relevantExperience,
    ...cvLines.filter((l) => !relevantExperience.includes(l)),
  ];
  const tailoredResumeText = [
    `TAILORED RESUME FOR: ${job.titleEn.toUpperCase()} (${job.companyName})`,
    `TARGET ALIGNMENT: ${matchingSkills.join(' · ') || 'Core Candidate Profile'}`,
    '------------------------------------------------------------',
    ...prioritizedLines,
  ].join('\n');

  return {
    engine: 'deterministic',
    modelLabel: 'TATARI Evidence NLP Engine',
    jobId: job.id,
    jobTitle: job.titleEn,
    companyName: job.companyName,
    compatibilityScore,
    matchingSkills,
    missingSkills,
    relevantExperience,
    explanation: explanationParts.join(' '),
    suggestions,
    tailoredResumeText,
    matchedAt: new Date().toISOString(),
  };
}

export function buildCandidateProfileCorpus(profile: UserProfile | null): string {
  if (!profile) return '';
  const primaryCv =
    profile.resumes?.find((r) => r.isPrimary)?.extractedText ||
    profile.resumes?.[0]?.extractedText ||
    '';
  return [
    profile.fullName,
    profile.headline || '',
    profile.location || '',
    profile.bio || '',
    (profile.skills || []).join(', '),
    (profile.certifications || []).join(', '),
    (profile.careerInterests || []).join(', '),
    (profile.languages || []).join(', '),
    profile.yearsExperience ? `${profile.yearsExperience} years experience` : '',
    ...(profile.experience || []).map((e) => `${e.title} ${e.company} ${e.summary}`),
    ...(profile.education || []).map((ed) => `${ed.degree} ${ed.fieldOfStudy} ${ed.institution}`),
    primaryCv,
  ]
    .filter(Boolean)
    .join('\n');
}

export function rankJobsForCandidate(
  profile: UserProfile | null,
  jobs: JobListing[],
  limit: number = 12
): AiJobRecommendation[] {
  if (!profile) return [];
  const corpus = buildCandidateProfileCorpus(profile);
  if (!corpus.trim()) return [];

  const activeJobs = jobs.filter((j) => j.status === 'approved' && !j.isExpired);
  const candidateLoc = (profile.location || '').toLowerCase();
  const interests = (profile.careerInterests || []).map((i) => i.toLowerCase());

  const scored: AiJobRecommendation[] = activeJobs.map((job) => {
    const match = computeDeterministicJobMatch(corpus, job);
    let score = match.compatibilityScore;
    const reasons: string[] = [];

    if (match.matchingSkills.length > 0) {
      reasons.push(
        `Matches ${match.matchingSkills.length} skill(s): ${match.matchingSkills.slice(0, 4).join(', ')}`
      );
    }
    if (interests.some((i) => job.category.toLowerCase().includes(i) || i.includes(job.category.toLowerCase()))) {
      score = Math.min(99, score + 8);
      reasons.push(`Aligns with your ${job.category} career interest`);
    }
    if (
      candidateLoc &&
      (job.remoteType === 'Remote' ||
        candidateLoc.includes(job.location.toLowerCase()) ||
        job.location.toLowerCase().includes(candidateLoc.split(',')[0]))
    ) {
      score = Math.min(99, score + 5);
      reasons.push(
        job.remoteType === 'Remote' ? 'Remote flexibility matches location' : `Located in ${job.location}`
      );
    }
    if (reasons.length === 0) {
      reasons.push(`Related sector relevance (${job.category})`);
    }

    return {
      jobId: job.id,
      compatibilityScore: score,
      matchReasons: reasons,
      matchingSkills: match.matchingSkills,
      missingSkillsToLearn: match.missingSkills.slice(0, 5),
    };
  });

  return scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore).slice(0, limit);
}

export function findMatchingJobsForAlert(alert: JobAlertConfig, jobs: JobListing[]): JobListing[] {
  if (!alert.active) return [];
  const kw = alert.keywords.trim().toLowerCase();
  const loc = alert.location.trim().toLowerCase();

  return jobs.filter((job) => {
    if (job.status !== 'approved' || job.isExpired) return false;
    if (alert.category && alert.category !== 'all' && job.category !== alert.category) return false;
    if (alert.remoteType && alert.remoteType !== 'all' && job.remoteType !== alert.remoteType)
      return false;
    if (alert.minSalaryEtb > 0 && job.salaryMax > 0 && job.salaryMax < alert.minSalaryEtb)
      return false;
    if (loc && !`${job.location} ${job.remoteType}`.toLowerCase().includes(loc)) return false;
    if (kw) {
      const hay = `${job.titleEn} ${job.companyName} ${job.summaryEn} ${(job.requirements || []).join(' ')}`.toLowerCase();
      const parts = kw.split(/[\s,]+/).filter(Boolean);
      if (!parts.some((p) => hay.includes(p))) return false;
    }
    return true;
  });
}

export function buildDeterministicInterviewQuestions(
  jobTitle: string,
  jobDescription: string,
  requirements: string[] = []
): AiInterviewQuestion[] {
  const skills = extractSkillsFromText(`${jobTitle} ${jobDescription} ${requirements.join(' ')}`);
  const topSkill = skills[0] || 'core domain tools';
  const secondSkill = skills[1] || 'cross-functional workflow systems';
  const topReq = requirements[0] || `delivering measurable results as a ${jobTitle}`;

  return [
    {
      id: 'iq-1',
      category: 'Role-Specific',
      question: `Walk me through your most relevant experience preparing you for this ${jobTitle} role, specifically around ${topReq}.`,
      focusTip: 'Connect specific past projects, scope, and measurable outcomes directly to the role.',
    },
    {
      id: 'iq-2',
      category: 'Technical',
      question: `How have you applied ${topSkill} and ${secondSkill} in a real production or operational workflow? Describe a technical challenge you solved.`,
      focusTip: 'Explain the problem, the exact tools/methods used, trade-offs, and verified outcome.',
    },
    {
      id: 'iq-3',
      category: 'Behavioral',
      question: `Tell me about a time you caught a costly error or compliance risk before a tight deadline. How did you resolve it with your team?`,
      focusTip: 'Use the STAR structure (Situation, Task, Action, Result) with concrete numbers.',
    },
    {
      id: 'iq-4',
      category: 'Situational',
      question: `In your first 60 days as ${jobTitle}, if inherited data or documentation is incomplete across departments, what steps would you take first?`,
      focusTip: 'Show structured prioritization, stakeholder communication, and rapid audit habits.',
    },
    {
      id: 'iq-5',
      category: 'Behavioral',
      question: `Why does this ${jobTitle} opportunity align with your career trajectory, and what measurable impact would you aim to deliver in year one?`,
      focusTip: 'Link your verified strengths directly to the organization’s operational needs.',
    },
  ];
}

export function evaluateInterviewAnswerDeterministic(
  question: AiInterviewQuestion,
  answer: string,
  jobTitle: string,
  requirements: string[] = []
): AiInterviewEvaluation {
  const cleanAnswer = sanitizeResumePlainText(answer);
  const words = cleanAnswer.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const qTerms = extractSignificantTerms(`${question.question} ${jobTitle} ${requirements.join(' ')}`);
  const ansLower = cleanAnswer.toLowerCase();
  const matchedTerms = qTerms.filter((t) => ansLower.includes(t));
  const hasStarSignals = /\b(situation|challenge|implemented|built|led|reduced|improved|increased|result|outcome|%|\d+)\b/i.test(
    cleanAnswer
  );
  const hasQuantifiedResult = /\d+%|\d+\+|\b\d+\s*(days|weeks|months|employees|users|percent)\b/i.test(
    cleanAnswer
  );

  const clarity = Math.min(
    96,
    (wordCount >= 35 ? 65 : wordCount >= 15 ? 48 : 28) + (hasStarSignals ? 18 : 0) + (wordCount <= 220 ? 10 : 0)
  );
  const communication = Math.min(
    95,
    (wordCount >= 25 ? 62 : 40) + (cleanAnswer.includes('.') ? 15 : 0) + (hasStarSignals ? 15 : 0)
  );
  const relevance = Math.min(
    96,
    38 + Math.min(40, matchedTerms.length * 10) + (hasStarSignals ? 12 : 0)
  );
  const technicalKnowledge = Math.min(
    96,
    40 +
      Math.min(35, extractSkillsFromText(cleanAnswer).length * 12) +
      (hasQuantifiedResult ? 15 : 0)
  );

  const overallScore = Math.round((communication + relevance + clarity + technicalKnowledge) / 4);

  const strengths: string[] = [];
  if (wordCount >= 30) strengths.push('Provides a substantive response with clear context.');
  if (hasQuantifiedResult) strengths.push('Backs claims with concrete numbers or measurable results.');
  if (matchedTerms.length >= 2)
    strengths.push(`Directly references key role concepts (${matchedTerms.slice(0, 4).join(', ')}).`);
  if (strengths.length === 0) strengths.push('Directly addresses the prompt.');

  const improvements: string[] = [];
  if (wordCount < 35)
    improvements.push('Expand your answer to at least 40–80 words using the STAR method (Situation, Task, Action, Result).');
  if (!hasQuantifiedResult)
    improvements.push('Include a specific metric (e.g., hours saved, accuracy %, staff/records processed).');
  if (matchedTerms.length < 2)
    improvements.push('Tie your example more explicitly to the technical/domain requirements of the job.');

  return {
    engine: 'deterministic',
    overallScore,
    scores: { communication, relevance, clarity, technicalKnowledge },
    strengths,
    improvements,
    suggestedStrongerAnswer: `Stronger STAR Structure Example for ${jobTitle}:\n• Situation/Task: Briefly state the operational goal or challenge you owned.\n• Action: Detail the exact tools/methods you personally executed (${matchedTerms.slice(0, 3).join(', ') || 'your core workflow'}).\n• Result: Close with the verified measurable impact (e.g., error reduction, faster turnaround, compliance achieved).`,
    feedbackSummary:
      overallScore >= 75
        ? 'Well-structured and relevant response. Adding one extra concrete KPI will make it standout.'
        : 'Solid foundation—sharpen impact metrics and connect your actions directly to the target role.',
  };
}

export function screenApplicantsDeterministic(
  job: JobListing,
  applications: JobApplication[]
): AiApplicantScreeningItem[] {
  const jobApps = applications.filter((a) => a.jobId === job.id);
  const { skills: jobSkills } = extractJobKeywordsAndSkills(job);

  return jobApps
    .map((app): AiApplicantScreeningItem => {
      const candidateCorpus = [
        app.coverNote,
        app.resumeText || '',
        app.yearsExperience,
        app.resumeFileName || '',
      ]
        .filter(Boolean)
        .join('\n');

      const match = computeDeterministicJobMatch(candidateCorpus, job);
      // Factor stated yearsExperience from application form cleanly
      const statedYears = extractYearsOfExperienceFromText(app.yearsExperience);
      const bonus = statedYears >= 3 ? 6 : statedYears >= 1 ? 3 : 0;
      const fitScore = Math.min(98, match.compatibilityScore + bonus);

      const category: AiApplicantScreeningItem['category'] =
        fitScore >= 68 ? 'Strong Fit' : fitScore >= 45 ? 'Potential Fit' : 'Needs Review';

      return {
        applicationId: app.id,
        applicantName: app.applicantName,
        applicantEmail: app.applicantEmail,
        jobId: job.id,
        jobTitle: job.titleEn,
        fitScore,
        category,
        summary: `${app.applicantName} (${app.yearsExperience}) matches ${match.matchingSkills.length} of ${Math.max(jobSkills.length, match.matchingSkills.length)} tracked requirements. Current stage: ${app.status}.`,
        matchingSkills: match.matchingSkills,
        missingQualifications: match.missingSkills.slice(0, 5),
        biasCheckNote:
          'Evaluated strictly on job skills, stated experience, and submitted CV text; protected attributes excluded.',
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);
}

export function answerRecruiterPoolQuestion(
  question: string,
  job: JobListing | null,
  applications: JobApplication[]
): string {
  const cleanQ = question.trim();
  if (!cleanQ) return 'Please enter a question about your applicants.';
  const targetApps = job ? applications.filter((a) => a.jobId === job.id) : applications;
  if (targetApps.length === 0) {
    return 'There are currently no applications in this pool to analyze.';
  }

  const querySkills = extractSkillsFromText(cleanQ);
  const queryTerms = extractSignificantTerms(cleanQ);

  const ranked = targetApps
    .map((app) => {
      const text = `${app.coverNote} ${app.resumeText || ''} ${app.yearsExperience} ${app.status}`.toLowerCase();
      const skillHits = querySkills.filter((s) => text.includes(s.toLowerCase()));
      const termHits = queryTerms.filter((t) => text.includes(t));
      const score = skillHits.length * 3 + termHits.length;
      return { app, skillHits, termHits, score };
    })
    .sort((a, b) => b.score - a.score);

  const matching = ranked.filter((r) => r.score > 0);
  if (matching.length === 0) {
    return `Reviewed ${targetApps.length} applicant(s)${job ? ` for ${job.titleEn}` : ''}. Top statuses: ${targetApps
      .slice(0, 5)
      .map((a) => `${a.applicantName} (${a.status}, ${a.yearsExperience})`)
      .join('; ')}. None explicitly mentioned the exact phrase "${cleanQ}" in their submitted note/CV text.`;
  }

  return [
    `Analyzed ${targetApps.length} applicant(s)${job ? ` for ${job.titleEn}` : ''} regarding "${cleanQ}":`,
    ...matching.slice(0, 5).map(
      (m, idx) =>
        `${idx + 1}. ${m.app.applicantName} (${m.app.status}, ${m.app.yearsExperience}) — Evidence hits: ${[
          ...m.skillHits,
          ...m.termHits,
        ]
          .slice(0, 5)
          .join(', ')}`
    ),
    'Note: AI provides advisory evidence only; recruiters retain final shortlisting decisions.',
  ].join('\n');
}
