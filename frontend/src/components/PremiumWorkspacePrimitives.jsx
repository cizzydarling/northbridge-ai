import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import Button from './ui/Button';
import { getCurrentUserLocal, getToken } from '../api';
import { workspaceText } from '../content/premiumWorkspaceCopy';
import { selectPreparationAction } from '../utils/preparationNextAction';
// Bounded session memory only. No API, storage or entitlement owner is introduced.
let sessionKey = null;
const choices = new Map();
export function WorkspaceHeading({
  title,
  children
}) {
  const {
    i18n
  } = useTranslation();
  return <header className="premium-heading"><p className="premium-eyebrow">NorthBridgeAI · {workspaceText(i18n.language).eyebrow}</p><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}
export function CaseHero({
  context,
  children
}) {
  const {
    i18n
  } = useTranslation();
  const c = workspaceText(i18n.language);
  return <section className="premium-case-hero" aria-label={c.case}><div><p className="premium-eyebrow">{c.case} #{context.case_id}</p><h2>{context.case.case_title || {
          permanent_residence: i18n.language.startsWith('fr') ? 'Résidence permanente' : 'Permanent residence',
          study_permit: i18n.language.startsWith('fr') ? 'Permis d’études' : 'Study permit',
          work_permit: i18n.language.startsWith('fr') ? 'Permis de travail' : 'Work permit',
          visitor_visa: i18n.language.startsWith('fr') ? 'Visa visiteur' : 'Visitor visa',
          spousal_sponsorship: i18n.language.startsWith('fr') ? 'Parrainage de conjoint' : 'Spousal sponsorship'
        }[context.case.application_type] || c.unknown}</h2><p>{children || c.context}</p></div><svg aria-hidden="true" viewBox="0 0 220 100"><path d="M10 85h200M30 85V20M190 85V20M30 27Q110 125 190 27M30 36Q110 115 190 36" /><circle cx="110" cy="24" r="14" /></svg></section>;
}
export function WorkflowLinks({
  caseId
}) {
  const {
    i18n
  } = useTranslation();
  const c = workspaceText(i18n.language);
  const ownedCaseId = Number.isInteger(caseId) && caseId > 0 ? caseId : null;
  return <nav className="premium-workflow" aria-label={c.workflow}><Link to={'/forms' + (ownedCaseId ? '?case_id=' + ownedCaseId : '')}>{c.forms}</Link><span aria-hidden="true">→</span><Link to="/documents">{c.documents}</Link><span aria-hidden="true">→</span><Link to="/documents/review">{c.review}</Link><span aria-hidden="true">→</span><Link to={'/documents/generator' + (ownedCaseId ? '?case_id=' + ownedCaseId : '')}>{c.export}</Link></nav>;
}
export function NextActionPanel({
  facts
}) {
  const {
    i18n
  } = useTranslation();
  const c = workspaceText(i18n.language);
  const token = getToken();
  const identity = getCurrentUserLocal()?.id;
  const key = identity + ':' + facts.caseId;
  const [selection, setSelection] = useState(() => sessionKey === token ? choices.get(key) || null : null);
  useEffect(() => {
    if (sessionKey !== token) {
      choices.clear();
      sessionKey = token;
    }
    function clear() {
      if (getToken() !== sessionKey) {
        choices.clear();
        sessionKey = null;
        setSelection(null);
      }
    }
    window.addEventListener('nbai-bootstrap-refresh', clear);
    window.addEventListener('storage', clear);
    window.addEventListener('nbai-auth-state-refresh', clear);
    return () => {
      window.removeEventListener('nbai-bootstrap-refresh', clear);
      window.removeEventListener('storage', clear);
      window.removeEventListener('nbai-auth-state-refresh', clear);
    };
  }, [token]);
  const result = useMemo(() => selectPreparationAction(facts, selection), [facts, selection]);
  if (identity !== facts.userId) return null;
  function choose(value) {
    if (getToken() !== token || getCurrentUserLocal()?.id !== facts.userId) return;
    if (choices.size >= 32 && !choices.has(key)) choices.delete(choices.keys().next().value);
    if (value) choices.set(key, value);else choices.delete(key);
    setSelection(value || null);
  }
  return <Card as="section" className="premium-next-action" padding="lg" aria-label={c.next}><p className="premium-eyebrow">{c.next}</p><h2>{c[result.primary.label]}</h2><p><strong>{c.why}: </strong>{c[result.primary.reason]}</p>{result.primary.blocked ? <p role="status">{c.blocked}</p> : <Link className="premium-primary-link" to={result.primary.path}>{c.continue}<span aria-hidden="true"> →</span></Link>}<div className="premium-choice"><label htmlFor="preparation-priority">{c.choose}</label><select id="preparation-priority" value={selection || ''} onChange={e => choose(e.target.value)}><option value="">{c.suggested}</option>{selection && !result.tasks.some(t => t.id === selection) && <option value={selection}>{c.reviewContext}</option>}{result.tasks.map(t => <option key={t.id} value={t.id}>{c[t.label]}</option>)}</select><small>{c.retained}</small></div>{result.secondary.length > 0 && <section className="premium-secondary"><h3>{c.secondary}</h3>{result.secondary.map(t => <Link key={t.id} to={t.path}><strong>{c[t.label]} <span aria-hidden="true">→</span></strong><span>{c[t.reason]}</span></Link>)}</section>}</Card>;
}
export function RecordedFacts({
  facts
}) {
  const {
    i18n
  } = useTranslation();
  const c = workspaceText(i18n.language);
  return <div className="premium-facts"><div><span>{c.saved}</span><strong>{facts.saved ? c.recorded : facts.savedState === 'absent' ? c.none : c.unknown}</strong><small>{c.notComplete}</small></div><div><span>{c.evidence}</span><strong>{facts.languageState === 'unknown' ? c.unknown : facts.languageState === 'needs_review' ? c.reviewLanguage : c.recorded}</strong></div><div><span>{c.documents}</span><strong>{facts.documents === null ? c.unknown : facts.documents.length}</strong><small>{c.known}</small></div><div><span>{c.activity}</span><strong>{facts.updatedAt ? new Date(facts.updatedAt).toLocaleDateString(i18n.language) : c.unknown}</strong></div></div>;
}
export function WorkspaceRetry({
  onRetry
}) {
  const {
    i18n
  } = useTranslation();
  const c = workspaceText(i18n.language);
  return <Button variant="secondary" onClick={onRetry}>{c.retry}</Button>;
}
