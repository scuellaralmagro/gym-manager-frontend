import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "../../lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs />");
  return ctx;
}

type TabsProps = {
  defaultValue: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
};

// Componente Tabs

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const baseId = useId();

  const setValue = useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const ctx = useMemo<TabsContextValue>(
    () => ({ value: current, setValue, baseId }),
    [current, setValue, baseId],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export const TabsList = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "inline-flex h-11 items-center gap-1 rounded-[12px]",
      "bg-[#f1f5f9] p-1 text-sm",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className, onKeyDown, ...props }, ref) => {
    const { value: active, setValue, baseId } = useTabsContext();
    const selected = active === value;

    // Navegación con flechas entre pestañas dentro del mismo tablist.
    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tablist = e.currentTarget.closest('[role="tablist"]');
      if (!tablist) return;
      const triggers = Array.from(
        tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      );
      const idx = triggers.indexOf(e.currentTarget);
      if (idx === -1) return;
      const nextIdx =
        e.key === "ArrowRight"
          ? (idx + 1) % triggers.length
          : (idx - 1 + triggers.length) % triggers.length;
      triggers[nextIdx]?.focus();
      e.preventDefault();
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${baseId}-tab-${value}`}
        aria-selected={selected}
        aria-controls={`${baseId}-panel-${value}`}
        tabIndex={selected ? 0 : -1}
        onClick={() => setValue(value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-[10px] px-3",
          "text-sm font-medium tracking-[0.06px] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/40",
          selected
            ? "bg-white text-[#0d1220] shadow-[rgba(15,48,106,0.08)_0px_1px_2px]"
            : "text-[rgba(4,14,32,0.69)] hover:text-[#0d1220]",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, ...props }, ref) => {
    const { value: active, baseId } = useTabsContext();
    const selected = active === value;
    if (!selected) return null;
    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${baseId}-panel-${value}`}
        aria-labelledby={`${baseId}-tab-${value}`}
        className={cn("mt-4", className)}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";
