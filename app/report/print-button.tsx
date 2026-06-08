"use client";

export default function PrintButton() {
  return (
    <button className="btn solid no-print" onClick={() => window.print()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />
      </svg>
      Save / Print PDF
    </button>
  );
}
