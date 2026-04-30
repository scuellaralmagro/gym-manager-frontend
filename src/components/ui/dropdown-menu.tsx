import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../../lib/utils";

// Menú desplegable para las acciones de los usuarios

type DropdownContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const DropdownMenuContext = createContext<DropdownContextValue | null>(null);

function useDropdownMenu(component: string) {
  const ctx = useContext(DropdownMenuContext);
  if (!ctx) {
    throw new Error(`${component} debe usarse dentro de <DropdownMenu>`);
  }
  return ctx;
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !contentRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider
      value={{ open, setOpen, triggerRef, contentRef }}
    >
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

type TriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function DropdownMenuTrigger({
  className,
  children,
  onClick,
  ...props
}: TriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownMenu("DropdownMenuTrigger");
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
        "text-[rgba(4,14,32,0.69)] transition-colors hover:bg-[#f1f5f9]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type ContentProps = HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end";
};

export function DropdownMenuContent({
  className,
  align = "end",
  children,
  ...props
}: ContentProps) {
  const { open, contentRef } = useDropdownMenu("DropdownMenuContent");
  if (!open) return null;
  return (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        "absolute z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[#e0e2e6] bg-white",
        "shadow-[rgba(15,48,106,0.08)_0px_10px_30px,rgba(45,127,249,0.08)_0px_1px_3px]",
        "p-1",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type ItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
};

export function DropdownMenuItem({
  className,
  onClick,
  destructive = false,
  ...props
}: ItemProps) {
  const { setOpen } = useDropdownMenu("DropdownMenuItem");
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium",
        "transition-colors focus:outline-none",
        destructive
          ? "text-[#b3261e] hover:bg-[#fdecea]"
          : "text-[rgba(4,14,32,0.85)] hover:bg-[#f1f5f9]",
        "disabled:pointer-events-none disabled:text-[rgba(4,14,32,0.45)]",
        className,
      )}
      {...props}
    />
  );
}
