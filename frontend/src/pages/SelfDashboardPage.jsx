import { LanguageResultsSummary } from '../components/LanguageBenchmarks';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import Card from '../components/ui/Card';
import { Alert, LoadingState } from '../components/ui/Feedback';
import { CaseHero, NextActionPanel, RecordedFacts, WorkspaceHeading, WorkspaceRetry } from '../components/PremiumWorkspacePrimitives';
import { workspaceText } from '../content/premiumWorkspaceCopy';
import { normalizePreparationFacts } from '../utils/preparationNextAction';
import { getApplicationContext, getCaseDrafts, getCurrentUserLocal, getLanguageAssessments, getMyProfile, getSavedSelfApplication, getSelfDocuments, getToken } from '../api';
export default function SelfDashboardPage() {
  const {
    i18n
  } = useTranslation();
  const c = workspaceText(i18n.language);
  const location = useLocation();
  const epoch = useRef(0);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState({
    state: 'loading'
  });
  const token = getToken();
  const userId = getCurrentUserLocal()?.id;
  useEffect(() => {
    const generation = ++epoch.current;
    let alive = true;
    const valid = () => alive && generation === epoch.current && getToken() === token && getCurrentUserLocal()?.id === userId;
    async function load() {
      setView({
        state: 'loading'
      });
      try {
        const context = (await getApplicationContext()).data;
        if (!valid()) return;
        normalizePreparationFacts({
          userId,
          context
        });
        const results = await Promise.allSettled([getMyProfile(), getSavedSelfApplication(context.case_id), getCaseDrafts(context.case_id), getSelfDocuments('case_' + context.case_id), getLanguageAssessments()]);
        if (!valid()) return;
        const latest = (await getApplicationContext()).data;
        if (!valid()) return;
        if (latest.case_id !== context.case_id) throw new Error('Case changed during loading');
        const value = i => results[i].status === 'fulfilled' ? results[i].value.data : null;
        const facts = normalizePreparationFacts({
          userId,
          context,
          profile: value(0),
          saved: value(1),
          savedState: results[1].status === 'fulfilled' || results[1].reason?.response?.status === 404 ? 'absent' : 'unknown',
          drafts: value(2),
          documents: value(3),
          language: value(4)
        });
        setView({
          state: 'ready',
          token,
          userId,
          context,
          facts,
          partial: results.some(r => r.status === 'rejected' && r.reason?.response?.status !== 404)
        });
      } catch {
        if (valid()) setView({
          state: 'error',
          token,
          userId
        });
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [token, userId, reload, location.key]);
  const ready = view.state === 'ready' && view.token === token && view.userId === userId;
  return <Layout><div className="premium-core premium-overview" data-testid="premium-overview" data-state={ready ? 'ready' : view.state}><WorkspaceHeading title={c.title}>{c.intro}</WorkspaceHeading>{!ready ? view.state === 'error' ? <Alert onRetry={() => setReload(n => n + 1)} retryLabel={c.retry}>{c.failed}</Alert> : <LoadingState>{c.loading}</LoadingState> : <><CaseHero context={view.context} /><RecordedFacts facts={view.facts} />{view.partial && <Alert tone="warning">{c.unavailable}<WorkspaceRetry onRetry={() => setReload(n => n + 1)} /></Alert>}<div className="premium-overview-grid"><NextActionPanel key={userId + ':' + view.facts.caseId} facts={view.facts} /><Card as="section" className="premium-recorded"><h2>{c.work}</h2>{view.facts.profile?.first_name&&<h3 className="premium-greeting">{c.welcome}, {view.facts.profile.first_name}</h3>}<p>{c.notComplete}</p><LanguageResultsSummary profile={view.facts.profile}/><ul><li>{c.profile}: {view.facts.profile ? view.facts.profile.first_name || c.recorded : c.unknown}</li><li>{c.formsSaved}: {view.facts.saved ? c.recorded : c.unknown}</li><li>{c.drafts}: {view.facts.drafts === null ? c.unknown : view.facts.drafts.length}</li><li>{c.documents}: {view.facts.documents === null ? c.unknown : view.facts.documents.length}</li></ul><p className="premium-notice">{c.context}</p></Card></div><section className="premium-resource-grid" aria-label={c.resources}><Card><h2>{c.caseLink}</h2><Link to={'/applications?case_id=' + view.facts.caseId}>{c.changeCase} →</Link><p>{c.context}</p></Card><Card><h2>{c.documents}</h2><p>{c.notComplete}</p><Link to="/documents">{c.docsLink} →</Link></Card><Card><h2>{c.resources}</h2><p>{c.dates}</p><Link to={view.facts.caseType === 'study_permit' ? '/official-finders?tab=schools' : '/strategy'}>{c.cta} →</Link></Card></section></>}</div></Layout>;
}
