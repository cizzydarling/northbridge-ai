import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import UpgradePrompt from "../components/UpgradePrompt";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  buildProPricingPath,
  deleteSavedCareerJob,
  getCachedBillingAccess,
  getMyAccess,
  getSavedCareerJobs,
} from "../api";

export default function SavedJobsPage() {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [jobs, setJobs] = useState([]);
  const [access, setAccess] = useState(() => getCachedBillingAccess());
  const [loading, setLoading] = useState(true);

  const text =
    language === "fr"
      ? {
          title: "Emplois sauvegardés",
          subtitle: "Retrouvez vos recherches et liens officiels Job Bank.",
          empty: "Aucun emploi sauvegardé pour le moment.",
          open: "Ouvrir",
          remove: "Retirer",
          lockedTitle: "Les emplois sauvegardés sont inclus avec Pro",
          lockedBody:
            "Passez à Pro pour sauvegarder vos recherches Job Bank et revenir aux provinces qui correspondent à votre profil.",
          lockedCta: "Voir Pro",
        }
      : {
          title: "Saved jobs",
          subtitle: "Return to your saved Job Bank searches and official links.",
          empty: "No saved jobs yet.",
          open: "Open",
          remove: "Remove",
          lockedTitle: "Saved jobs are included with Pro",
          lockedBody:
            "Upgrade to Pro to save Job Bank searches and return to matched provinces.",
          lockedCta: "See Pro",
        };
  const proPath = buildProPricingPath("career-match", "saved-jobs");

  async function load() {
    try {
      setLoading(true);
      const accessRes = await getMyAccess();
      setAccess(accessRes.data);
      if (!accessRes.data?.can_save_career_jobs) return;
      const res = await getSavedCareerJobs();
      setJobs(res.data || []);
    } catch (err) {
      console.error(err);
      setAccess(getCachedBillingAccess());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(jobId) {
    await deleteSavedCareerJob(jobId);
    setJobs((current) => current.filter((job) => job.id !== jobId));
  }

  return (
    <Layout>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          NorthBridgeAI
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
          {text.title}
        </h1>
      <p className="mt-2 text-sm text-slate-600">{text.subtitle}</p>
      </div>

      {!loading && !access?.can_save_career_jobs ? (
        <UpgradePrompt
          title={text.lockedTitle}
          body={text.lockedBody}
          buttonLabel={text.lockedCta}
          pricingPath={proPath}
        />
      ) : null}

      {loading ? (
        <p className="text-slate-600">{language === "fr" ? "Chargement..." : "Loading..."}</p>
      ) : null}

      {!loading && access?.can_save_career_jobs && !jobs.length ? (
        <Card>
          <p className="text-sm text-slate-500">{text.empty}</p>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {access?.can_save_career_jobs ? jobs.map((job) => (
          <Card key={job.id}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {job.source} {job.noc_code ? `- ${job.noc_code}` : ""}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  {job.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{job.province}</p>
                {job.notes ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{job.notes}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  onClick={() => window.open(job.job_url, "_blank", "noopener,noreferrer")}
                >
                  {text.open}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleDelete(job.id)}>
                  {text.remove}
                </Button>
              </div>
            </div>
          </Card>
        )) : null}
      </section>
    </Layout>
  );
}
