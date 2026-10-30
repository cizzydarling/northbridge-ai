import { Link } from 'react-router-dom';
import { Alert, LoadingState } from '../components/ui/Feedback';
import { CaseHero, WorkflowLinks, WorkspaceHeading } from '../components/PremiumWorkspacePrimitives';
import { workspaceText } from '../content/premiumWorkspaceCopy';
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { getMyAccess, getCurrentUserLocal, getToken, getMyProfile, getApplicationContext, getSavedSelfApplication, runSelfWorkspace } from "../api";
const APPLICATION_TYPES = [{
  value: "permanent_residence",
  en: "Permanent residence",
  fr: "Résidence permanente"
}, {
  value: "study_permit",
  en: "Study permit",
  fr: "Permis d’études"
}, {
  value: "work_permit",
  en: "Work permit",
  fr: "Permis de travail"
}, {
  value: "visitor_visa",
  en: "Visitor visa",
  fr: "Visa visiteur"
}, {
  value: "spousal_sponsorship",
  en: "Spousal sponsorship",
  fr: "Parrainage d’époux / conjoint"
}];
function getProfileIntake(profile) {
  if (!profile) return {};
  return {
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    nationality: profile.nationality || "",
    current_country: profile.current_country || "",
    current_city: profile.current_city || "",
    marital_status: profile.marital_status || "",
    preferred_language: profile.preferred_language || "",
    age: profile.age ?? "",
    education: profile.education || "",
    language_score: profile.language_score ?? "",
    experience_years: profile.experience_years ?? "",
    occupation: profile.occupation || "",
    noc_code: profile.noc_code || "",
    preferred_province: profile.preferred_province || ""
  };
}
export default function SelfApplicationPage() {
  const {
    i18n
  } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [workspace, setWorkspace] = useState(null);
  const token = getToken();
  const userId = getCurrentUserLocal()?.id;
  const requestEpoch = useRef(0);
  const [caseContext, setCaseContext] = useState(null);
  const copy = workspaceText(language);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedApplicationType, setSelectedApplicationType] = useState("permanent_residence");
  const mounted = useRef(false);
  const activeCaseId = useRef(null);
  const contextCheck = useRef(0);
  const [reload, setReload] = useState(0);
  const [checkingCase, setCheckingCase] = useState(false);
  const clearWorkspace = useCallback(() => {
    setWorkspace(null);
    setCaseContext(null);
  }, []);
  const restartForCase = useCallback(() => {
    ++requestEpoch.current;
    ++contextCheck.current;
    activeCaseId.current = null;
    clearWorkspace();
    setMessage("");
    setLoading(true);
    setCheckingCase(false);
    setReload(value => value + 1);
  }, [clearWorkspace]);
  const validateContext = useCallback(context => {
    if (!Number.isInteger(context?.case_id) || context.case?.id !== context.case_id || context.case.owner_user_id !== userId) throw new Error("Unverified case");
    return context;
  }, [userId]);
  const loadPage = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    const valid = () => mounted.current && epoch === requestEpoch.current && getToken() === token && getCurrentUserLocal()?.id === userId;
    if (!valid()) return;
    clearWorkspace();
    setMessage("");
    setCheckingCase(false);
    setLoading(true);
    let context = null;
    const stillCurrentCase = async () => {
      const latest = (await getApplicationContext()).data;
      if (!valid()) return false;
      validateContext(latest);
      if (latest.case_id !== context.case_id) {
        restartForCase();
        return false;
      }
      return true;
    };
    try {
      const response = await getApplicationContext();
      if (!valid()) return;
      context = validateContext(response.data);
      activeCaseId.current = context.case_id;
      const [profileRes, savedAppRes, _accessRes] = await Promise.allSettled([getMyProfile(), getSavedSelfApplication(context.case_id), getMyAccess()]);
      if (!valid() || !await stillCurrentCase()) return;
      // Preserve the existing healthy payload and fail closed on missing reads.
      if (savedAppRes.status === 'rejected' && savedAppRes.reason?.response?.status !== 404) throw new Error('Saved Forms unavailable');
      if (profileRes.status === 'rejected') throw new Error('Profile unavailable');
      const savedApplication = savedAppRes.status === "fulfilled" ? savedAppRes.value.data : null;
      const profile = profileRes.value.data;
      if (savedApplication && (savedApplication.application_case_id !== context.case_id || savedApplication.user_id !== userId || !savedApplication.intake_payload || typeof savedApplication.intake_payload !== 'object' || Array.isArray(savedApplication.intake_payload))) throw new Error("Unverified saved Forms");
      const applicationType = context.case.application_type;
      const nextIntakePayload = {
        ...(savedApplication?.intake_payload || {}),
        ...getProfileIntake(profile),
        application_type: applicationType
      };
      const workspaceRes = await runSelfWorkspace({case_id: context.case_id, matter_type: applicationType, intake: nextIntakePayload}, language);
      if (!valid() || !await stillCurrentCase()) return;
      setSelectedApplicationType(applicationType);
      setCaseContext({...context, verifiedToken: token, verifiedUser: userId});
      setWorkspace(workspaceRes.data);
      setMessage("");
    } catch {
      if (!valid()) return;
      // A late failure from a previous case must not hide its replacement.
      if (context) {
        try {
          if (!await stillCurrentCase()) return;
        } catch {
          if (!valid()) return;
        }
      }
      clearWorkspace();
      setMessage(language === "fr" ? "Impossible de charger votre application." : "Failed to load your application.");
    } finally {
      if (valid()) setLoading(false);
    }
  }, [language, token, userId, clearWorkspace, restartForCase, validateContext]);
  useEffect(() => {
    const requests = requestEpoch;
    const checks = contextCheck;
    mounted.current = true;
    loadPage();
    return () => {
      mounted.current = false;
      ++requests.current;
      ++checks.current;
    };
  }, [loadPage, reload]);
  useEffect(() => {
    const checks = contextCheck;
    // Returning from another tab rechecks context without regenerating a
    // healthy same-case workspace. Hide old links until that check completes.
    const reconcile = async () => {
      const epoch = requestEpoch.current;
      const check = ++contextCheck.current;
      const valid = () => mounted.current && epoch === requestEpoch.current && check === contextCheck.current && getToken() === token && getCurrentUserLocal()?.id === userId;
      if (!valid()) return;
      setCheckingCase(true);
      try {
        const response = await getApplicationContext();
        if (!valid()) return;
        const context = validateContext(response.data);
        if (activeCaseId.current !== null && context.case_id !== activeCaseId.current) restartForCase();
      } catch {
        if (!valid()) return;
        ++requestEpoch.current;
        clearWorkspace();
        setLoading(false);
        setMessage(language === "fr" ? "Impossible de charger votre application." : "Failed to load your application.");
      } finally {
        if (mounted.current && check === contextCheck.current && getToken() === token && getCurrentUserLocal()?.id === userId) setCheckingCase(false);
      }
    };
    const hide = () => { if (mounted.current) setCheckingCase(true); };
    const visibility = () => { if (document.visibilityState === 'visible') reconcile(); else hide(); };
    window.addEventListener('focus', reconcile);
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      ++checks.current;
      window.removeEventListener('focus', reconcile);
      window.removeEventListener('pageshow', reconcile);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [language, token, userId, clearWorkspace, restartForCase, validateContext]);
  const verified = caseContext?.verifiedToken === token && caseContext?.verifiedUser === userId;
  function handleApplicationTypeChange() {
    navigate('/applications');
  }
  return <Layout><div className="premium-core premium-preparation"><WorkspaceHeading title={copy.prepTitle}>{copy.prepIntro}</WorkspaceHeading>{loading || checkingCase ? <LoadingState>{copy.loading}</LoadingState> : message ? <Alert onRetry={loadPage} retryLabel={copy.retry}>{message}</Alert> : verified && <><CaseHero context={caseContext} /><WorkflowLinks caseId={caseContext.case_id} /><p className="premium-notice">{copy.workflowNote}</p><Card className="mb-6"><h2>{copy.type}</h2><div className="flex flex-wrap gap-2">{APPLICATION_TYPES.map(item => <Button key={item.value} variant={selectedApplicationType === item.value ? 'primary' : 'secondary'} onClick={handleApplicationTypeChange}>{language === 'fr' ? item.fr : item.en}</Button>)}</div></Card><section className="premium-resource-grid"><Card><h2>{copy.formsSaved}</h2><p>{copy.notComplete}</p><Link to={'/forms?case_id=' + caseContext.case_id}>{copy.forms} →</Link></Card><Card><h2>{copy.documents}</h2><p>{copy.known}</p><Link to="/documents">{copy.docsLink} →</Link></Card><Card><h2>{copy.export}</h2><p>{language === 'fr' ? 'Les brouillons conservent leurs versions. Pro est requis pour créer, modifier, réviser et exporter en DOCX.' : 'Drafts retain their revisions. Pro is required to create, edit, review and export DOCX.'}</p><Link to={'/documents/generator?case_id=' + caseContext.case_id}>{copy.export} →</Link></Card></section>{workspace?.application?.updated_at && <p>{copy.activity}: {new Date(workspace.application.updated_at).toLocaleDateString(language)}</p>}<nav className="premium-workflow" aria-label={copy.case}><Link to="/household">{copy.caseLink}</Link><Link to="/strategy">{copy.resources}</Link><Link to="/chat">{copy.assistantNote}</Link></nav></>}</div></Layout>;
}
