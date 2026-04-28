"use client";

export function ProgressOverlay({ current, total }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-8 w-96 max-w-[90vw]">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Generating certificates…
        </h2>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-gray-600 text-center">
          {current} of {total}
        </p>
      </div>
    </div>
  );
}
