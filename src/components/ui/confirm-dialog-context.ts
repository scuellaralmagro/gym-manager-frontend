import { createContext } from "react";

// Contexto para los diálogos de confirmación (preguntas con respuesta sí/no)

export type ConfirmVariant = "default" | "destructive";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

export type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);
