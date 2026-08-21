"use client";

export default function PrintButton() {
  return (
    <button type="button" className="op-print-btn" onClick={() => window.print()}>
      Print
    </button>
  );
}
