import React from "react";

export default function SimulationCard({
  simulation,
  selected = false,
  selectable = false,
  onSelect,
  onCompare,
  onRename,
  onDelete,
  onOpen,
}) {
  const crsComparison = simulation?.result_payload?.crs_comparison || {};
  const pathwayComparison = simulation?.result_payload?.pathway_comparison || {};

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
        selected ? "border-amber-500 ring-2 ring-amber-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {simulation.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Created {new Date(simulation.created_at).toLocaleString()}
          </p>
          {simulation.notes ? (
            <p className="mt-2 text-sm text-slate-700">{simulation.notes}</p>
          ) : null}
        </div>

        {selectable ? (
          <button
            onClick={() => onSelect?.(simulation.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              selected
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current CRS
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {crsComparison.current_crs_score ?? "-"}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Simulated CRS
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {crsComparison.simulated_crs_score ?? "-"}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            CRS Difference
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              (crsComparison.difference ?? 0) >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {typeof crsComparison.difference === "number"
              ? `${crsComparison.difference >= 0 ? "+" : ""}${crsComparison.difference}`
              : "-"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Eligible Pathways
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(pathwayComparison.simulated_eligible_pathways || []).length ? (
            pathwayComparison.simulated_eligible_pathways.map((pathway) => (
              <span
                key={pathway}
                className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
              >
                {pathway}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">No pathways listed</span>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => onOpen?.(simulation)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open
        </button>

        <button
          onClick={() => onCompare?.(simulation)}
          className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Compare
        </button>

        <button
          onClick={() => onRename?.(simulation)}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Rename
        </button>

        <button
          onClick={() => onDelete?.(simulation)}
          className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
