import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { submitBetaFeedback } from '../api';
import Button from './ui/Button';
import { getFeedbackAIStatus } from '../feedbackContext';

const categories = ['bug', 'ux', 'ai', 'content', 'feature', 'general'];
const pages = new Set('/dashboard /profile /household /applications /strategy /chat /forms /career-match /career-match/province /career-match/saved /citizenship /citizenship/quiz /citizenship/progress /language-practice /official-finders /self/application /documents /self/documents /documents/generator /documents/review /pricing /billing /billing/success /upgrade /onboarding /legal/disclosure'.split(' '));

export default function BetaFeedback() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const inFlight = useRef(false);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState('');
  const [followUp, setFollowUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const context = useRef({});
  useEffect(() => {
    if (dialogOpen) dialog.current.showModal();
  }, [dialogOpen]);
  useEffect(() => {
    if (success) dialog.current?.querySelector('button')?.focus();
  }, [success]);
  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled)')];
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const close = () => {
    if (inFlight.current) return;
    dialog.current.close();
    setDialogOpen(false);
    trigger.current?.focus();
  };
  const open = () => {
    const version = import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_GIT_SHA;
    context.current = {
      page_path: pages.has(pathname) ? pathname : '/other',
      language: i18n.resolvedLanguage === 'fr' ? 'fr' : 'en',
      device_context: window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
      ...(/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(version || '') ? { application_version: version } : {}),
    };
    setSuccess(false);
    setError('');
    setDialogOpen(true);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!category || message.trim().length < 10 || message.trim().length > 4000) {
      setError(t('feedback.validation'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await submitBetaFeedback({ ...context.current, category, message: message.trim(),
        ...(category === 'ai' && context.current.page_path === '/chat' && getFeedbackAIStatus() ? { ai_status: getFeedbackAIStatus() } : {}),
        rating: rating ? Number(rating) : null, allow_follow_up: followUp });
      setSuccess(true);
      setMessage('');
      setCategory('');
      setRating('');
      setFollowUp(false);
    } catch (failure) {
      setError(t(failure.response?.status === 429 ? 'feedback.rateLimit' : 'feedback.error'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400';
  return <>
    <div data-testid="feedback-toolbar" className="sticky top-0 z-40 flex h-12 items-center justify-end border-b border-slate-200 bg-slate-50 px-3 lg:pl-72">
      <button ref={trigger} type="button" onClick={open} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z" /><path d="M7 9h10M7 13h7" /></svg>
        {t('feedback.title')}
      </button>
    </div>
    <dialog ref={dialog} onKeyDown={trapFocus} aria-labelledby="feedback-title" aria-describedby="feedback-privacy" onCancel={event => { event.preventDefault(); close(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 sm:p-6">
      {dialogOpen && <>
      <h2 id="feedback-title" className="text-xl font-semibold">{t('feedback.title')}</h2>
      <p id="feedback-privacy" className="mt-2 text-sm leading-6 text-slate-600">{t('feedback.privacy')}</p>
      {success ? <div className="mt-5 space-y-5">
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{t('feedback.success')}</p>
        <Button onClick={close}>{t('feedback.close')}</Button>
      </div> : <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <label className="block text-sm font-medium" htmlFor="feedback-category">{t('feedback.category')}
          <select id="feedback-category" autoFocus required value={category} disabled={busy} onChange={e => setCategory(e.target.value)} className={field}>
            <option value="">{t('feedback.choose')}</option>
            {categories.map(value => <option key={value} value={value}>{t(`feedback.categories.${value}`)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium" htmlFor="feedback-message">{t('feedback.message')}
          <textarea id="feedback-message" required minLength={10} maxLength={4000} rows={5} value={message} disabled={busy} onChange={e => setMessage(e.target.value)} placeholder={t(category === 'ai' ? 'feedback.aiPrompt' : 'feedback.prompt')} className={field} aria-describedby="feedback-length" />
        </label>
        <p id="feedback-length" className="text-xs text-slate-600">{t('feedback.length', { count: message.length })}</p>
        <label className="block text-sm font-medium" htmlFor="feedback-rating">{t('feedback.rating')}
          <select id="feedback-rating" value={rating} disabled={busy} onChange={e => setRating(e.target.value)} className={field}>
            <option value="">{t('feedback.noRating')}</option>
            {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{t(`feedback.ratings.${value}`)}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor="feedback-follow-up">
          <input id="feedback-follow-up" type="checkbox" checked={followUp} disabled={busy} onChange={e => setFollowUp(e.target.checked)} className="h-5 w-5 accent-slate-900" />{t('feedback.followUp')}
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={close}>{t('feedback.cancel')}</Button>
          <Button type="submit" loading={busy}>{t(busy ? 'feedback.sending' : 'feedback.submit')}</Button>
        </div>
      </form>}
      </>}
    </dialog>
  </>;
}
