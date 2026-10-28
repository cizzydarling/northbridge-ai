import { useTranslation } from 'react-i18next';
export default function OfficialResourceCard({title,source,children,actions}) {
 const {i18n}=useTranslation(); const fr=i18n.language.startsWith('fr');
 const state=source.status||source.review_status;
 const labels={available:fr?'Fiches récupérées':'Records retrieved',stale:fr?'Périmée':'Stale',loading:fr?'Actualisation en cours':'Refresh in progress',unavailable:fr?'Indisponible':'Unavailable',UNDER_REVIEW:fr?'À l’étude':'Under review',NOT_VERIFIED:fr?'Non vérifiée':'Not verified',SOURCE_RECORD_NOT_ELIGIBILITY_REVIEW:fr?'Fiche source ; admissibilité non évaluée':'Source record; eligibility not assessed'};
 return <article className="nb-card min-w-0 space-y-3 border border-slate-200 bg-white p-5">
  <h3 className="text-lg font-semibold text-slate-950">{title}</h3>{children}
  <dl className="space-y-1 break-words text-xs text-slate-600">
   <div><dt className="inline font-semibold">{fr?'État de la source : ':'Source status: '}</dt><dd className="inline">{labels[state] || (fr?'Inconnu':'Unknown')}</dd></div>
   <div><dt className="inline font-semibold">{fr?'Récupéré : ':'Retrieved: '}</dt><dd className="inline">{source.retrieved_at || (fr?'Inconnu':'Unknown')}</dd></div>
   <div><dt className="inline font-semibold">{fr?'Mise à jour publiée : ':'Publisher update: '}</dt><dd className="inline">{source.source_updated_at || (fr?'Non indiquée':'Not supplied')}</dd></div>
   {source.expires_at && <div><dt className="inline font-semibold">{fr?'Expiration du cache : ':'Cache expires: '}</dt><dd className="inline">{source.expires_at}</dd></div>}
  </dl>
  <p className="text-xs text-slate-600">{fr?'La récupération ne constitue pas une vérification de l’admissibilité. Consultez la source pour les renseignements actuels.':'Retrieval is not an eligibility review. Check the source for current information.'}</p>
  <a className="inline-block underline" href={source.source_url} target="_blank" rel="noopener noreferrer">{fr?'Vérifier la source officielle':'Verify official source'}</a>
  {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
 </article>;
}
