import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * shadcn-shaped Button (hand-rolled variants — no cva dep). Light theme,
 * SYNNR deep-blue accent. Large tap targets for one-handed yard use.
 */
type Variant = "default" | "outline" | "ghost" | "danger" | "subtle";
type Size = "default" | "sm" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  default: "bg-bone text-white hover:bg-bone-soft",
  outline: "border border-line-2 bg-transparent text-ink hover:bg-elevated",
  ghost: "bg-transparent text-ink hover:bg-elevated hover:text-ink",
  subtle: "bg-elevated text-ink hover:bg-elevated",
  danger: "border border-red-500/40 bg-transparent text-red-400 hover:bg-red-500/10",
};
const SIZES: Record<Size, string> = {
  default: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-[13px]",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0";

/** Style a non-button element (e.g. a Next.js <Link>) as a Button. */
export function buttonClass(variant: Variant = "default", size: Size = "default", className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button ref={ref} className={buttonClass(variant, size, className)} {...props} />
  ),
);
Button.displayName = "Button";
