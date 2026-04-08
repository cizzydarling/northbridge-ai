export default function UpgradeModal({ open, onClose, onUpgrade }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-semibold">
          Unlock your full immigration strategy
        </h3>

        <p className="mt-3 text-sm text-slate-600">
          Get complete pathway analysis, documents, and AI guidance to move forward with confidence.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onUpgrade}
            className="flex-1 rounded-xl bg-blue-600 py-2 text-white"
          >
            Upgrade Now
          </button>

          <button
            onClick={onClose}
            className="flex-1 rounded-xl border py-2"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}