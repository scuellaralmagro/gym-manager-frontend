import { forwardRef, type LabelHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

// Label de los campos del formulario
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none tracking-[0.08px] text-[#181d26]",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  ),
);

Label.displayName = "Label";
