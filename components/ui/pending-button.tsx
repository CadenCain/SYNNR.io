"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";

/**
 * A form's submit button that greys out while the form is sending, so a
 * second tap on a slow connection doesn't send it twice. Used where a repeat
 * would cost something (the bill, a duplicate record).
 */
export default function PendingButton({ children, pendingText = "Working…", className, disabled }: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={className ?? buttonClass("outline", "lg")}>
      {pending ? pendingText : children}
    </button>
  );
}
