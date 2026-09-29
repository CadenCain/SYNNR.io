"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("default", "sm")}>
      <Printer className="h-4 w-4" /> Print
    </button>
  );
}
