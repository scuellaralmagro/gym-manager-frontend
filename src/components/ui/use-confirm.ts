import { useContext } from "react";

import {
  ConfirmContext,
  type ConfirmOptions,
} from "./confirm-dialog-context";

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm debe usarse dentro de <ConfirmDialogProvider>");
  }
  return ctx.confirm;
}
