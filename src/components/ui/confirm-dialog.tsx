import { useCallback, useRef, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import {
  ConfirmContext,
  type ConfirmOptions,
} from "./confirm-dialog-context";

// Sistema de diálogos de confirmación

type DialogState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
      window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
    });
  }, []);

  const handleClose = useCallback(
    (value: boolean) => {
      state?.resolve(value);
      setState(null);
    },
    [state],
  );

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          role="alertdialog"
          aria-modal
          aria-label={state.title}
          className="fixed inset-0 z-[55] flex items-center justify-center px-4"
        >
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => handleClose(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[#e0e2e6] bg-white p-6 shadow-[rgba(15,48,106,0.12)_0px_10px_30px]">
            <h2 className="text-lg font-medium tracking-tight text-[rgba(4,14,32,0.87)]">
              {state.title}
            </h2>
            {state.description && (
              <p className="mt-2 text-sm text-[rgba(4,14,32,0.69)]">
                {state.description}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[rgba(4,14,32,0.75)] hover:bg-[#f1f5f9]"
              >
                {state.cancelLabel ?? "Cancelar"}
              </button>
              <Button
                ref={confirmBtnRef}
                type="button"
                onClick={() => handleClose(true)}
                className={cn(
                  "h-10 w-auto px-5",
                  state.variant === "destructive" &&
                    "bg-[#b3261e] hover:bg-[#8d1c17] focus-visible:ring-[#b3261e]/40",
                )}
              >
                {state.confirmLabel ?? "Aceptar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
