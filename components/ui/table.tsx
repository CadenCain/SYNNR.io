import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.05)]", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap border-b border-line bg-elevated/60 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-dim sm:px-4", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-line/60 px-3 py-3 align-middle sm:px-4", className)}>{children}</td>;
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("transition-colors hover:bg-elevated/60 last:[&>td]:border-0", className)}>{children}</tr>;
}
