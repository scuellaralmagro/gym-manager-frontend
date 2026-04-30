import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import {
  ToastContext,
  type Toast,
  type ToastContextValue,
  type ToastInput,
  type ToastVariant,
} from "./toast-context";

// Sistema de notificaciones "toast" (aparecen en la parte superior derecha de la pantalla)

// Duración por defecto de 4 segundos
const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      idRef.current += 1;
      const id = idRef.current;
      const nextToast: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "default",
      };
      setToasts((prev) => [...prev, nextToast]);
      window.setTimeout(() => dismiss(id), DEFAULT_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) =>
        toast({ title, description, variant: "success" }),
      error: (title, description) =>
        toast({ title, description, variant: "error" }),
      warning: (title, description) =>
        toast({ title, description, variant: "warning" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notificaciones"
      className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const palette = getPalette(toast.variant);
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3",
        "shadow-[rgba(15,48,106,0.12)_0px_10px_30px,rgba(45,127,249,0.08)_0px_1px_3px]",
        palette.border,
      )}
    >
      <span
        className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", palette.dot)}
      />
      <div className="flex-1">
        <p className={cn("text-sm font-medium", palette.title)}>
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-[rgba(4,14,32,0.69)]">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="text-[rgba(4,14,32,0.55)] transition-colors hover:text-[rgba(4,14,32,0.87)]"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function getPalette(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return {
        border: "border-[#cde8d5]",
        dot: "bg-[#146c43]",
        title: "text-[#0f5132]",
      };
    case "error":
      return {
        border: "border-[#f5c2be]",
        dot: "bg-[#b3261e]",
        title: "text-[#842029]",
      };
    case "warning":
      return {
        border: "border-[#f4d9a8]",
        dot: "bg-[#8a5a00]",
        title: "text-[#664d03]",
      };
    default:
      return {
        border: "border-[#e0e2e6]",
        dot: "bg-[#1b61c9]",
        title: "text-[rgba(4,14,32,0.87)]",
      };
  }
}

function CloseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
