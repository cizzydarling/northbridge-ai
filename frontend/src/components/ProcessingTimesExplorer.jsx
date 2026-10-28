import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {getOfficialProcessingTimes,getCurrentUserLocal} from '../api';
import OfficialResourceCard from './OfficialResourceCard';
import Button from './ui/Button';
export default function ProcessingTimesExplorer(){
 const {i18n}=useTranslation(); const fr=i18n.language.startsWith('fr');
 const [result,setResult]=useState(null),[category,setCategory]=useState(''),[country,setCountry]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const owner=getCurrentUserLocal()?.id;
 const key=JSON.stringify([owner,category,country,i18n.language,revision]);
 const data=result?.key===key?result.data:null;
 const catalog=result?.data;
 useEffect(()=>{let active=true; const expected=owner;
  getOfficialProcessingTimes({application_type:category||undefined,country:country||undefined}).then(r=>{if(active&&getCurrentUserLocal()?.id===expected){setResult({key,data:r.data});setError(false);}}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[category,country,i18n.language,owner,revision,key]);
 const countries=catalog?.applications?.find(a=>a.key===category)?.requires_country;
 return <section className="space-y-4" aria-label={fr?'Recherche des délais':'Processing-time search'}>
  <form className="flex flex-wrap items-end gap-4" onSubmit={e=>{e.preventDefault();setBusy(true);setRevision(n=>n+1);}}>
   <label className="min-w-0 w-full sm:w-auto sm:flex-1">{fr?'Type de demande':'Application category'}<select className="mt-1 block min-w-0 w-full max-w-full rounded border p-2" value={category} onChange={e=>{setCategory(e.target.value);setCountry('');}}><option value="">{fr?'Choisir une catégorie':'Choose a category'}</option>{catalog?.applications?.map(a=><option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
   {countries&&<label className="min-w-0 w-full sm:w-auto sm:flex-1">{fr?'Pays applicable':'Applicable country'}<select className="mt-1 block min-w-0 w-full max-w-full rounded border p-2" value={country} onChange={e=>setCountry(e.target.value)}><option value="">{fr?'Choisir un pays':'Choose a country'}</option>{catalog?.countries?.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>}
   <Button type="submit" disabled={busy}>{fr?'Actualiser la source':'Refresh source'}</Button>
  </form>
  {!data&&!error&&<p role="status">{fr?'Chargement des références…':'Loading references…'}</p>}
  {error&&<p role="alert">{fr?'Source indisponible. Aucun délai n’est prédit.':'Source unavailable. No processing time is predicted.'}</p>}
  {data&&<OfficialResourceCard title={fr?'Estimation officielle publiée':'Official published estimate'} source={{...data,source_url:data.official_page_url}}>
   <p role="status">{data.processing_time || (fr?'Aucune estimation disponible pour cette sélection. Choisissez une catégorie et, si nécessaire, un pays.':'No estimate available for this selection. Choose a category and, where required, a country.')}</p>
   {data.status!=='available'&&<p>{fr?'La source est en chargement, périmée ou indisponible. Aucune actualité n’est garantie.':'The source is loading, stale or unavailable. Currency is not guaranteed.'}</p>}
   <p>{fr?'Estimation générale qui peut changer, pas une prévision personnelle ni une date de décision.':'A general estimate that can change, not a personal prediction or decision date.'}</p>
  </OfficialResourceCard>}
  <Link className="underline" to="/applications">{fr?'Continuer la planification du dossier':'Continue case planning'}</Link>
 </section>;
}
