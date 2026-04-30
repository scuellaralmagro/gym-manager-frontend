import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

// Campo de texto del formulario
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
        "px-4 py-2 text-base tracking-[0.08px] text-[#181d26]",
        "placeholder:text-[rgba(4,14,32,0.69)]",
        "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
