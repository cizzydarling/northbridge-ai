import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApplicationContext } from "../api";
export default function ApplicationContextBanner(){
  const {i18n}=useTranslation();const fr=i18n.language.startsWith("fr");const [context,setContext]=useState(null);const [error,setError]=useState(false);
  useEffect(()=>{let alive=true;getApplicationContext().then(r=>{if(alive)setContext(r.data);}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[]);
  return <aside className="my-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
    {context?<><Link to={`/applications?case_id=${context.case_id}`}>{fr?"Demande active":"Active application"}: {context.case.case_title || `#${context.case_id}`}</Link><p>{fr?"Personnes sélectionnées":"Selected people"}: {context.family_size}</p>
      {context.family_size>1&&<p>{fr?"Estimation individuelle seulement. Les calculs familiaux et l’admissibilité comme personne à charge nécessitent une vérification des règles. Les faits inconnus restent inconnus.":"Individual estimate only. Family calculations and dependency eligibility require rule verification. Unknown facts remain unknown."}</p>}</>:<p role={error?"alert":undefined}>{error?(fr?"Contexte indisponible. Rechargez la page avant de continuer.":"Context unavailable. Reload before continuing."):(fr?"Chargement du contexte…":"Loading application context…")}</p>}
  </aside>;
}
