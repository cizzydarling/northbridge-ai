// Pure UI normalization/ranking. Server authorization and source status stay authoritative.
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function normalizePreparationFacts({
  userId,
  context,
  profile = null,
  saved = null,
  savedState = 'unknown',
  drafts = null,
  documents = null,
  language = null
}) {
  if (!Number.isInteger(userId) || !object(context) || !Number.isInteger(context.case_id) || context.case?.id !== context.case_id || context.case.owner_user_id !== userId) throw new Error('Unverified case context');
  if (context.case.case_title != null && typeof context.case.case_title !== 'string') throw new Error('Unverified case title');
  if (profile?.user_id != null && profile.user_id !== userId) throw new Error('Unverified profile');
  const caseId = context.case_id;
  if (saved !== null && (!object(saved) || saved.user_id !== userId || saved.application_case_id !== caseId || !object(saved.intake_payload))) throw new Error('Unverified saved Forms');
  if (drafts !== null && (!Array.isArray(drafts) || drafts.some(d => d.case_id !== caseId || !Number.isInteger(d.revision) || typeof d.title !== 'string'))) throw new Error('Unverified case drafts');
  if (documents !== null && (!Array.isArray(documents) || documents.some(d => d.user_id !== userId))) throw new Error('Unverified documents');
  const ownedDocuments = documents === null ? null : documents.filter(d => d.matter_type === 'case_' + caseId);
  const selected = object(language?.selected) && Array.isArray(language?.assessments) ? Object.values(language.selected).filter(id => id != null).map(id => language.assessments.find(a => a.id === id)).filter(Boolean) : [];
  const languageState = !selected.length ? 'unknown' : selected.some(a => a.usable === false || a.status === 'expired') ? 'needs_review' : 'recorded';
  return {
    userId,
    caseId,
    caseTitle: context.case.case_title || '#' + caseId,
    caseType: context.case.application_type,
    people: Number.isInteger(context.family_size) ? context.family_size : null,
    profile,
    saved,
    savedState: saved ? 'recorded' : savedState === 'absent' ? 'absent' : 'unknown',
    drafts,
    documents: ownedDocuments,
    languageState,
    languageRecorded: selected.length,
    updatedAt: saved?.updated_at || null
  };
}
export function preparationTasks(facts) {
  const scoped = path => path + '?case_id=' + facts.caseId;
  const tasks = [];
  if (facts.drafts?.length) tasks.push({
    id: 'drafts',
    rank: 100,
    path: scoped('/documents/generator'),
    label: 'drafts',
    reason: 'savedReason'
  });
  if (facts.saved) tasks.push({
    id: 'forms',
    rank: 200,
    path: scoped('/forms'),
    label: 'formsSaved',
    reason: 'savedReason'
  });
  if (facts.languageState === 'needs_review') tasks.push({
    id: 'language',
    rank: 300,
    path: '/profile?section=language#language-evidence',
    label: 'reviewLanguage',
    reason: 'languageReason'
  });
  if (facts.documents?.length) tasks.push({
    id: 'documents',
    rank: 400,
    path: '/documents',
    label: 'reviewDocuments',
    reason: 'documentsReason'
  });
  tasks.push({
    id: 'resources',
    rank: 600,
    path: facts.caseType === 'study_permit' ? '/official-finders?tab=schools' : '/strategy',
    label: 'checkSources',
    reason: 'sourceReason'
  });
  return tasks.sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function selectPreparationAction(facts, selectedId = null) {
  const tasks = preparationTasks(facts);
  const fallback = {
    id: 'context',
    path: '/applications?case_id=' + facts.caseId,
    label: 'reviewContext',
    reason: 'contextReason',
    rank: 900
  };
  let primary = tasks[0] || fallback;
  if (selectedId) primary = tasks.find(t => t.id === selectedId) || {
    ...fallback,
    id: selectedId,
    reason: 'blocked',
    blocked: true
  };
  const seen = new Set([primary.path]);
  const secondary = tasks.filter(t => {
    if (t.id === primary.id || seen.has(t.path)) return false;
    seen.add(t.path);
    return true;
  }).slice(0, 3);
  return {
    primary,
    secondary,
    tasks,
    selectedId
  };
}
