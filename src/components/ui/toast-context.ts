import { createContext } from "react";

// Contexto para las notificaciones "toast" (notificaciones emergentes dentro del panel)

export type ToastVariant = "default" | "success" | "error" | "warning";

export type Toast = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

export type ToastInput = Omit<Toast, "id" | "variant"> & {
  variant?: ToastVariant;
};

export type ToastContextValue = {
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
