import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

// Usamos la libreria de shadcn para los badges

type BadgeVariant =
  | "admin"
  | "entrenador"
  | "cliente"
  | "neutral"
  | "activa"
  | "cancelada";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  admin: "bg-[#fdecea] text-[#b3261e] ring-[#f5c6c2]",
  entrenador: "bg-[#e8f0fe] text-[#1b61c9] ring-[#c7dbf9]",
  cliente: "bg-[#e6f6ec] text-[#146c43] ring-[#bde3c9]",
  neutral: "bg-[#f1f5f9] text-[rgba(4,14,32,0.69)] ring-[#e0e2e6]",
  activa: "bg-[#e6f6ec] text-[#0f5132] ring-[#bde3c9]",
  cancelada:
    "bg-[#f1f5f9] text-[rgba(4,14,32,0.55)] ring-[#e0e2e6] line-through",
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        "text-xs font-medium tracking-[0.08px] ring-1 ring-inset",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
