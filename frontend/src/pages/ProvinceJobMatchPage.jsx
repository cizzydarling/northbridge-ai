import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

function buildJobBankSearch(occupation, province, language) {
  const base =
    language === "fr"
      ? "https://www.guichetemplois.gc.ca/rechercheemplois"
      : "https://www.jobbank.gc.ca/jobsearch/jobsearch";
  const params = new URLSearchParams({
    searchstring: occupation || "",
    locationstring: province || "Canada",
  });
  return `${base}?${params.toString()}`;
}

export default function ProvinceJobMatchPage() {
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const province = searchParams.get("province") || "ON";
  const occupation = searchParams.get("occupation") || "Project Coordinator";
  const noc = searchParams.get("noc") || "";
  const jobUrl = useMemo(
    () => buildJobBankSearch(occupation, province, language),
    [occupation, province, language]
  );

  const text =
    language === "fr"
      ? {
          eyebrow: "Emplois par province",
          title: "Recherche officielle Job Bank",
          open: "Ouvrir dans Job Bank",
          jobs: "Widget officiel de recherche d'emploi",
          occupation: "Profession",
          province: "Province",
          noc: "CNP",
        }
      : {
          eyebrow: "Province jobs",
          title: "Official Job Bank search",
          open: "Open in Job Bank",
          jobs: "Official job-search widget",
          occupation: "Occupation",
          province: "Province",
          noc: "NOC",
        };

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {text.eyebrow}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            {text.title}
          </h1>
        </div>
        <Button onClick={() => window.open(jobUrl, "_blank", "noopener,noreferrer")}>
          {text.open}
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {text.occupation}
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{occupation}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {text.province}
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{province}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {text.noc}
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{noc || "-"}</p>
        </Card>
      </section>

      <Card className="mt-5">
        <h2 className="text-2xl font-semibold text-slate-950">{text.jobs}</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <iframe
            title="Job Bank"
            src="https://www.jobbank.gc.ca/widgetjs/"
            className="h-[560px] w-full bg-white"
          />
        </div>
      </Card>
    </Layout>
  );
}
