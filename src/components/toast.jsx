"use client";

import { useEffect } from "react";

export function Toast({ message, onClose, autoDismissMs = 6000 }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(id);
  }, [message, onClose, autoDismissMs]);

  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white rounded-md shadow-lg px-4 py-3 flex items-center gap-3 max-w-[90vw]">
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-white/80 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
