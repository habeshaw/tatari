import type {
  TrainingCategory,
  TrainingDeliveryMode,
  TrainingFilterCriteria,
  TrainingProgram,
  TrainingProposalStatus,
  TrainingRequest,
  UserProfile,
} from '../types/domain';

export const ORGANIZATION_SECTORS = [
  'Banking & Microfinance',
  'NGO & Humanitarian Development',
  'Manufacturing & Agro-Processing',
  'Technology & Telecom',
  'Healthcare & Pharmaceuticals',
  'Public Enterprise & Government',
  'Hospitality, Logistics & Retail',
];

export const TRAINING_DELIVERY_MODES: TrainingDeliveryMode[] = [
  'On-Site (Your Premises)',
  'Live Virtual',
  'Hybrid Blended',
  'TATARI Training Hub (Addis Ababa)',
];

export interface TrainingQuoteBreakdown {
  baseCohortFeeEtb: number;
  includedSeats: number;
  extraParticipants: number;
  extraSeatFeeEtb: number;
  virtualDiscountEtb: number;
  estimatedTotalEtb: number;
}

export function calculateCohortTrainingQuote(
  baseFeeEtb: number,
  maxIncludedSeats: number,
  teamSize: number,
  deliveryMode: TrainingDeliveryMode
): TrainingQuoteBreakdown {
  const safeBase = Math.max(0, Math.round(Number(baseFeeEtb || 0)));
  const includedSeats = Math.max(1, Math.round(Number(maxIncludedSeats || 15)));
  const safeTeam = Math.max(1, Math.round(Number(teamSize || 1)));
  const extraParticipants = Math.max(0, safeTeam - includedSeats);
  const perExtraSeat = 1200;
  const extraSeatFeeEtb = extraParticipants * perExtraSeat;
  const preDiscount = safeBase + extraSeatFeeEtb;
  const virtualDiscountEtb =
    deliveryMode === 'Live Virtual' ? Math.round(preDiscount * 0.15) : 0;

  return {
    baseCohortFeeEtb: safeBase,
    includedSeats,
    extraParticipants,
    extraSeatFeeEtb,
    virtualDiscountEtb,
    estimatedTotalEtb: Math.max(0, preDiscount - virtualDiscountEtb),
  };
}

export function filterTrainingPrograms(
  programs: TrainingProgram[],
  criteria: TrainingFilterCriteria,
  includeInactive: boolean = false
): TrainingProgram[] {
  const q = criteria.query.trim().toLowerCase();
  return programs.filter((program) => {
    if (!includeInactive && !program.active) return false;
    if (criteria.category !== 'all' && program.category !== criteria.category) return false;
    if (
      criteria.deliveryMode !== 'all' &&
      !program.deliveryModes.includes(criteria.deliveryMode as TrainingDeliveryMode)
    ) {
      return false;
    }
    if (q) {
      const searchable = [
        program.titleEn,
        program.titleAm ?? '',
        program.category,
        program.targetAudience,
        program.summaryEn,
        ...program.sectorFocus,
        ...program.syllabusModules,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

export interface CreateTrainingRequestInput {
  programId: string;
  organizationName: string;
  organizationSector: string;
  contactPerson: string;
  phone: string;
  teamSize: number;
  deliveryMode: TrainingDeliveryMode;
  preferredDates: string;
  locationCity: string;
  customTopics: string;
}

export function createTailoredTrainingRequest(
  programs: TrainingProgram[],
  actor: UserProfile | null,
  input: CreateTrainingRequestInput,
  nowIso: string = new Date().toISOString()
): TrainingRequest {
  if (!actor) {
    throw new Error('Please sign in or register an account before requesting a tailored training proposal.');
  }
  if (actor.status === 'suspended') {
    throw new Error('Suspended accounts cannot submit organizational training requests.');
  }

  const program = programs.find((p) => p.id === input.programId);
  if (!program) {
    throw new Error('Selected training program was not found.');
  }

  const orgName = input.organizationName.trim();
  const contactPerson = input.contactPerson.trim();
  const phone = input.phone.trim();
  const locationCity = input.locationCity.trim();
  const preferredDates = input.preferredDates.trim();
  const customTopics = input.customTopics.trim();
  const teamSize = Math.round(Number(input.teamSize || 0));

  if (orgName.length < 2) {
    throw new Error('Organization / Institution name is required.');
  }
  if (contactPerson.length < 2) {
    throw new Error('Contact person full name is required.');
  }
  if (phone.length < 6) {
    throw new Error('A valid phone number is required.');
  }
  if (teamSize < 1 || teamSize > 250) {
    throw new Error('Team size must be between 1 and 250 participants.');
  }
  if (locationCity.length < 2) {
    throw new Error('City / Training location is required.');
  }
  if (!preferredDates) {
    throw new Error('Preferred training window or dates are required.');
  }
  if (customTopics.length < 10) {
    throw new Error(
      'Please describe your organization’s skill gaps or customization goals (at least 10 characters).'
    );
  }

  const quote = calculateCohortTrainingQuote(
    program.feePerCohortEtb,
    program.maxParticipants,
    teamSize,
    input.deliveryMode
  );

  return {
    id: `trn-req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    requesterEmail: actor.email.toLowerCase(),
    organizationName: orgName,
    organizationSector: input.organizationSector || ORGANIZATION_SECTORS[0],
    contactPerson,
    phone,
    programId: program.id,
    programTitle: program.titleEn,
    customTopics,
    teamSize,
    deliveryMode: input.deliveryMode,
    preferredDates,
    locationCity,
    estimatedFeeEtb: quote.estimatedTotalEtb,
    status: 'Submitted',
    createdAt: nowIso,
  };
}

export interface TrainingProgramInput {
  titleEn: string;
  titleAm?: string;
  category: TrainingCategory;
  durationDays: number;
  targetAudience: string;
  feePerCohortEtb: number;
  maxParticipants: number;
  deliveryModes: TrainingDeliveryMode[];
  sectorFocus: string[];
  summaryEn: string;
  syllabusModules: string[];
  deliverables: string[];
}

function validateTrainingProgramInput(input: TrainingProgramInput): void {
  if (input.titleEn.trim().length < 4) {
    throw new Error('Training program title must be at least 4 characters.');
  }
  if (input.durationDays < 1 || input.durationDays > 30) {
    throw new Error('Duration must be between 1 and 30 days.');
  }
  if (input.feePerCohortEtb < 1000) {
    throw new Error('Cohort fee must be at least ETB 1,000.');
  }
  if (input.maxParticipants < 1 || input.maxParticipants > 200) {
    throw new Error('Cohort capacity must be between 1 and 200 participants.');
  }
  if (input.summaryEn.trim().length < 15) {
    throw new Error('Program summary must be at least 15 characters.');
  }
  if (input.syllabusModules.filter((m) => m.trim()).length === 0) {
    throw new Error('Include at least one syllabus module.');
  }
}

export function adminCreateTrainingProgram(
  programs: TrainingProgram[],
  actor: UserProfile | null,
  input: TrainingProgramInput,
  nowIso: string = new Date().toISOString()
): { programs: TrainingProgram[]; created: TrainingProgram } {
  if (!actor || actor.role !== 'admin' || actor.status !== 'approved') {
    throw new Error('Only an approved Administrator can add corporate training programs.');
  }
  validateTrainingProgramInput(input);

  const created: TrainingProgram = {
    id: `trn-prog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    titleEn: input.titleEn.trim(),
    titleAm: input.titleAm?.trim() || undefined,
    category: input.category,
    durationDays: Math.round(input.durationDays),
    durationLabel: `${Math.round(input.durationDays)}-Day Intensive (${Math.round(input.durationDays) * 7} hrs)`,
    targetAudience: input.targetAudience.trim() || 'Corporate & NGO Teams',
    feePerCohortEtb: Math.round(input.feePerCohortEtb),
    maxParticipants: Math.round(input.maxParticipants),
    deliveryModes:
      input.deliveryModes.length > 0 ? input.deliveryModes : ['On-Site (Your Premises)', 'Live Virtual'],
    sectorFocus: input.sectorFocus.filter((s) => s.trim()),
    summaryEn: input.summaryEn.trim(),
    syllabusModules: input.syllabusModules.filter((m) => m.trim()),
    deliverables: input.deliverables.filter((d) => d.trim()),
    active: true,
    createdAt: nowIso,
  };

  return {
    programs: [created, ...programs],
    created,
  };
}

export function adminUpdateTrainingProgram(
  programs: TrainingProgram[],
  actor: UserProfile | null,
  programId: string,
  updates: TrainingProgramInput
): TrainingProgram[] {
  if (!actor || actor.role !== 'admin' || actor.status !== 'approved') {
    throw new Error('Only an approved Administrator can edit corporate training programs.');
  }
  if (!programs.some((p) => p.id === programId)) {
    throw new Error('Training program not found.');
  }
  validateTrainingProgramInput(updates);

  return programs.map((p) =>
    p.id === programId
      ? {
          ...p,
          titleEn: updates.titleEn.trim(),
          titleAm: updates.titleAm?.trim() || p.titleAm,
          category: updates.category,
          durationDays: Math.round(updates.durationDays),
          durationLabel: `${Math.round(updates.durationDays)}-Day Intensive (${Math.round(updates.durationDays) * 7} hrs)`,
          targetAudience: updates.targetAudience.trim() || p.targetAudience,
          feePerCohortEtb: Math.round(updates.feePerCohortEtb),
          maxParticipants: Math.round(updates.maxParticipants),
          deliveryModes:
            updates.deliveryModes.length > 0 ? updates.deliveryModes : p.deliveryModes,
          sectorFocus: updates.sectorFocus.filter((s) => s.trim()),
          summaryEn: updates.summaryEn.trim(),
          syllabusModules: updates.syllabusModules.filter((m) => m.trim()),
          deliverables: updates.deliverables.filter((d) => d.trim()),
        }
      : p
  );
}

export function adminDeleteTrainingProgram(
  programs: TrainingProgram[],
  actor: UserProfile | null,
  programId: string
): TrainingProgram[] {
  if (!actor || actor.role !== 'admin' || actor.status !== 'approved') {
    throw new Error('Only an approved Administrator can delete corporate training programs.');
  }
  if (!programs.some((p) => p.id === programId)) {
    throw new Error('Training program not found.');
  }
  return programs.filter((p) => p.id !== programId);
}

export function adminUpdateTrainingRequestStatus(
  requests: TrainingRequest[],
  actor: UserProfile | null,
  requestId: string,
  updates: {
    status: TrainingProposalStatus;
    trainerAssigned?: string;
    estimatedFeeEtb?: number;
    proposalNotes?: string;
  },
  nowIso: string = new Date().toISOString()
): TrainingRequest[] {
  if (!actor || actor.role !== 'admin' || actor.status !== 'approved') {
    throw new Error('Only an approved Administrator can manage organizational training proposals.');
  }
  const target = requests.find((r) => r.id === requestId);
  if (!target) {
    throw new Error('Training request not found.');
  }

  return requests.map((r) =>
    r.id === requestId
      ? {
          ...r,
          status: updates.status,
          trainerAssigned:
            updates.trainerAssigned !== undefined
              ? updates.trainerAssigned.trim() || undefined
              : r.trainerAssigned,
          estimatedFeeEtb:
            updates.estimatedFeeEtb !== undefined && Number(updates.estimatedFeeEtb) >= 0
              ? Math.round(Number(updates.estimatedFeeEtb))
              : r.estimatedFeeEtb,
          proposalNotes:
            updates.proposalNotes !== undefined
              ? updates.proposalNotes.trim() || undefined
              : r.proposalNotes,
          updatedAt: nowIso,
        }
      : r
  );
}

export function buildTrainingProposalHtml(
  request: TrainingRequest,
  program?: TrainingProgram
): { filename: string; mimeType: string; content: string } {
  const slug = request.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const modulesHtml = (program?.syllabusModules || ['Tailored Diagnostic Workshop', 'Hands-On Organizational Datasets', 'Action Plan & Assessment'])
    .map((m) => `<li>${m}</li>`)
    .join('\n    ');

  const deliverablesHtml = (program?.deliverables || ['Customized Workbook Templates', 'Completion Certificates', '30-Day Post-Training Q&A'])
    .map((d) => `<li>${d}</li>`)
    .join('\n    ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>TATARI Tailored Training Proposal — ${request.organizationName}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 36px auto; color: #0f172a; line-height: 1.6; padding: 0 24px; }
  .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #164081; padding-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 800; color: #10243B; }
  .sub { font-size: 12px; color: #475569; margin-top: 4px; }
  .status-box { background: #F0F5FF; color: #164081; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; font-size: 13px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  h2 { color: #10243B; font-size: 16px; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .quote { font-family: ui-monospace, monospace; font-size: 18px; font-weight: 800; color: #0F766E; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">TATARI ACADEMY · CORPORATE TRAINING PROPOSAL</div>
      <div class="sub">Prepared for ${request.organizationName} · Addis Ababa, Ethiopia · support@tatari.et</div>
    </div>
    <div class="status-box">${request.status.toUpperCase()}</div>
  </div>

  <div class="grid">
    <div class="box">
      <strong>Client Organization:</strong> ${request.organizationName}<br/>
      <strong>Sector:</strong> ${request.organizationSector}<br/>
      <strong>Primary Contact:</strong> ${request.contactPerson} (${request.phone})<br/>
      <strong>City / Venue:</strong> ${request.locationCity}
    </div>
    <div class="box">
      <strong>Selected Curriculum:</strong> ${request.programTitle}<br/>
      <strong>Team Size:</strong> ${request.teamSize} participants<br/>
      <strong>Delivery Mode:</strong> ${request.deliveryMode}<br/>
      <strong>Preferred Dates:</strong> ${request.preferredDates}<br/>
      <strong>Lead Facilitator:</strong> ${request.trainerAssigned || 'To be confirmed upon scheduling'}
    </div>
  </div>

  <h2>Organization-Specific Tailoring Objectives</h2>
  <p>${request.customTopics}</p>
  ${request.proposalNotes ? `<p><strong>TATARI Academy Lead Notes:</strong> ${request.proposalNotes}</p>` : ''}

  <h2>Tailored Curriculum Modules</h2>
  <ul>
    ${modulesHtml}
  </ul>

  <h2>Organizational Deliverables &amp; Certification</h2>
  <ul>
    ${deliverablesHtml}
  </ul>

  <h2>Commercial Cohort Fee Summary</h2>
  <p class="quote">ETB ${request.estimatedFeeEtb.toLocaleString('en-US')}</p>
  <p style="font-size:12px; color:#64748b;">Proposal Reference: ${request.id} · Issued ${request.createdAt.slice(0, 10)} · Payment accepted via Telebirr / CBE Bank Transfer upon cohort confirmation.</p>
</body>
</html>`;

  return {
    filename: `tatari-training-proposal-${slug || 'org'}-${request.id.slice(-6)}.html`,
    mimeType: 'text/html;charset=utf-8;',
    content: html,
  };
}
