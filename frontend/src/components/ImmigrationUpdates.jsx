import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {getOfficialDrawHistory,getCurrentUserLocal,getToken} from '../api';
import OfficialResourceCard from './OfficialResourceCard';
import Button from './ui/Button';

export default function ImmigrationUpdates(){
 const {i18n}=useTranslation();const fr=i18n.language.startsWith('fr'),language=fr?'fr':'en';
 const tr=(en,french)=>fr?french:en;
 const owner=getCurrentUserLocal()?.id,session=getToken();
 const [category,setCategory]=useState(''),[submitted,setSubmitted]=useState(''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[result,setResult]=useState(null),[error,setError]=useState(null);
 const key=JSON.stringify([owner,session,language,submitted,offset,revision]);
 const data=result?.key===key?result.data:null;
 const source=data?{...data,source_url:data.source_url||'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html'}:null;
 const failed=error===key;
 useEffect(()=>{let active=true;const expected=owner,token=session;
  getOfficialDrawHistory({language,category:submitted,offset,limit:6}).then(response=>{
   if(active&&getCurrentUserLocal()?.id===expected&&getToken()===token){setResult({key,data:response.data});setError(null);}
  }).catch(()=>{if(active&&getCurrentUserLocal()?.id===expected&&getToken()===token)setError(key);});
  return()=>{active=false;};
 },[owner,session,key,language,submitted,offset]);
 const unknown=tr('Not supplied / timezone unknown','Non indiqué / fuseau horaire inconnu');
 return <section className="min-w-0 space-y-4" aria-label={tr('Historical immigration updates','Actualités historiques sur l’immigration')}>
  <h2 className="nb-section-title">{tr('Express Entry draw history','Historique des rondes Entrée express')}</h2>
  <p>{tr('Historical results are not future invitation probabilities. A cutoff does not establish your eligibility.','Les résultats historiques ne prédisent pas vos invitations futures. Un seuil ne détermine pas votre admissibilité.')}</p>
  <form className="flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();setSubmitted(category);setOffset(0);setRevision(n=>n+1);}}>
   <label className="min-w-0 flex-1">{tr('Draw category','Catégorie de ronde')}<input className="mt-1 block w-full rounded border p-2" maxLength={100} value={category} onChange={event=>setCategory(event.target.value)}/></label>
   <Button type="submit">{tr('Search history','Rechercher dans l’historique')}</Button>
  </form>
  {!data&&!failed&&<p role="status">{tr('Loading historical references…','Chargement des références historiques…')}</p>}
  {failed&&<div role="alert"><p>{tr('History could not be loaded. No results were invented.','Impossible de charger l’historique. Aucun résultat n’a été inventé.')}</p><Button variant="secondary" onClick={()=>setRevision(n=>n+1)}>{tr('Retry','Réessayer')}</Button></div>}
  {data&&<OfficialResourceCard title={tr('Official historical reference','Référence historique officielle')} source={source}>
   <p role="status">{data.available?tr('Published historical records; compare only within the same rules and category.','Fiches historiques publiées ; comparez uniquement selon les mêmes règles et catégories.'):tr('Historical source records are unavailable. Use the official verification link.','Les fiches historiques sont indisponibles. Utilisez le lien officiel de vérification.')}</p>
   <p>{tr('Draw dates describe events, not the feed’s publication or retrieval date.','Les dates des rondes décrivent des événements, pas la publication ou la récupération du flux.')}</p>
  </OfficialResourceCard>}
  <div className="grid min-w-0 gap-4 md:grid-cols-2">{data?.draws?.map(draw=><OfficialResourceCard key={draw.round} title={'#'+draw.round+' · '+draw.round_type} source={{...data,source_url:draw.source_url}}>
   <dl className="space-y-2 break-words">
    {[[tr('Draw date','Date de ronde'),draw.date],[tr('Invitations issued','Invitations envoyées'),draw.invitations_issued],[tr('CRS cutoff','Seuil SCG'),draw.crs_cutoff],[tr('Draw timestamp (UTC)','Horodatage de ronde (UTC)'),draw.draw_at_utc||unknown],[tr('Tie-breaking timestamp (UTC)','Horodatage du départage (UTC)'),draw.tie_break_at_utc||unknown],[tr('Historical rule context','Contexte réglementaire historique'),draw.rule_version]].map(([label,value])=><div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}
   </dl>
  </OfficialResourceCard>)}</div>
  {data?.available&&data.draws?.length===0&&<p>{tr('No matching historical records.','Aucune fiche historique correspondante.')}</p>}
  {data&&<div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-6))}>{tr('Previous rounds','Rondes précédentes')}</Button><Button variant="secondary" disabled={!data.available||offset+6>=data.total} onClick={()=>setOffset(n=>n+6)}>{tr('More rounds','Autres rondes')}</Button></div>}
  <nav className="flex flex-wrap gap-4 underline"><Link to="/strategy#assess-my-options">{tr('Review CRS evidence','Consulter les éléments du SCG')}</Link><Link to="/strategy#processing-times">{tr('Published processing estimates','Estimations des délais publiées')}</Link><Link to="/self/application">{tr('Continue my preparation','Continuer ma préparation')}</Link></nav>
 </section>;
}
