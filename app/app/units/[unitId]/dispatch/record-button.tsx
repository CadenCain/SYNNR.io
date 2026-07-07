"use client";

import { useFormStatus } from "react-dom";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Submit button that disables while the record action runs — a double-tap on
 *  a slow yard connection shouldn't write two records. */
export default function RecordButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <ClipboardCheck className="h-5 w-5" /> {pending ? "Recording…" : label}
    </Button>
  );
}
