import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

// Botón primario del formulario
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center rounded-[12px]",
        "bg-[#1b61c9] px-6 text-base font-medium tracking-[0.08px] text-white",
        "shadow-[rgba(0,0,0,0.32)_0px_0px_1px,rgba(0,0,0,0.08)_0px_0px_2px,rgba(45,127,249,0.28)_0px_1px_3px,rgba(0,0,0,0.06)_0px_0px_0px_0.5px_inset]",
        "transition-colors hover:bg-[#254fad]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/40 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
