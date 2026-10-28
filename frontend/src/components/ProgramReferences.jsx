import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {browseProgramReferences,getCurrentUserLocal} from '../api';
import OfficialResourceCard from './OfficialResourceCard';
import Button from './ui/Button';
export default function ProgramReferences(){
 const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr'),tr=(en,french)=>fr?french:en;
 const [query,setQuery]=useState(''),[jurisdiction,setJurisdiction]=useState(''),[filter,setFilter]=useState({query:'',jurisdiction:''}),[result,setResult]=useState(null),[failed,setFailed]=useState(false);
 const owner=getCurrentUserLocal()?.id;const key=JSON.stringify([owner,filter]);const data=result?.key===key?result.data:null;
 useEffect(()=>{let active=true;const expected=owner;
  browseProgramReferences(filter).then(r=>{if(active&&getCurrentUserLocal()?.id===expected){setResult({key,data:r.data});setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};
 },[filter,key,owner]);
 return <section id="program-references" className="scroll-mt-32 space-y-4 rounded-xl border bg-white p-5" aria-label={tr('Jurisdiction references','Références territoriales')}>
  <h2 className="text-xl font-semibold">{tr('Programs and settlement jurisdiction','Programmes et lieu d’établissement')}</h2>
  <p>{tr('Quebec and Nunavut have no PNP. Program existence is separate from intake availability and personal eligibility. Unverified streams remain under review.','Le Québec et le Nunavut n’ont pas de PCP. L’existence d’un programme est distincte de son ouverture et de votre admissibilité. Les volets non vérifiés restent à l’étude.')}</p>
  <form className="flex flex-wrap items-end gap-4" onSubmit={e=>{e.preventDefault();setResult(null);setFailed(false);setFilter({query,jurisdiction});}}><label className="min-w-0 max-w-full">{tr('Search program references','Rechercher les références de programmes')}<input className="mt-1 block min-w-0 max-w-full rounded border p-2" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="min-w-0 max-w-full">{tr('Settlement jurisdiction','Lieu d’établissement')}<select className="mt-1 block min-w-0 max-w-full rounded border p-2" value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)}><option value="">{tr('All references','Toutes les références')}</option>{['CA','AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map(p=><option key={p}>{p}</option>)}</select></label><Button type="submit">{tr('Browse references','Consulter les références')}</Button></form>
  {failed?<p role="alert">{tr('References unavailable. No stream is recommended.','Références indisponibles. Aucun volet n’est recommandé.')}</p>:!data?<p role="status">{tr('Loading references…','Chargement des références…')}</p>:data.records.length===0?<p>{tr('No supported matching reference.','Aucune référence correspondante prise en charge.')}</p>:data.records.map(p=><OfficialResourceCard key={p.identifier} title={p.title} source={{source_url:p.official_source,review_status:p.review_status}}>
   <p>{p.jurisdiction} · {p.family}</p><p>{fr?p.description_fr:p.description_en}</p><p>{tr('Review status','État de vérification')}: {p.review_status}</p><p>{tr('Intake availability unverified; eligibility not assessed.','Ouverture non vérifiée ; admissibilité non évaluée.')}</p><p>{tr('Recorded reference review date','Date de consultation enregistrée')}: {p.checked_on}</p><p>{tr('Effective date','Date d’effet')}: {p.effective_from||tr('Unknown','Inconnue')}</p>
  </OfficialResourceCard>)}
 </section>;
}
