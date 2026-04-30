import { isAxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

type LaravelValidationPayload = {
  message?: string;
  errors?: Record<string, string[]>;
};

/**
 * Opciones para decidir qué errores de Laravel se pintan en el formulario.
 */
export type HandleLaravelErrorsOptions<TFieldValues extends FieldValues> = {
  allowedFields?: Path<TFieldValues>[];
  includeRootMessage?: boolean;
};

/**
 * Mapea respuestas 422 de Laravel a errores de React Hook Form (libreria para formularios).
 *
 * @param error - Error capturado en una petición Axios.
 * @param setError - Función de React Hook Form para marcar campos con error.
 * @param options - Lista opcional de campos permitidos y mensaje raíz.
 * @returns `true` si el error era de validación y se ha gestionado.
 */
export function handleLaravelErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  options: HandleLaravelErrorsOptions<TFieldValues> = {},
): boolean {
  if (!isAxiosError(error)) return false;
  if (error.response?.status !== 422) return false;

  const payload = error.response.data as LaravelValidationPayload | undefined;
  const fieldErrors = payload?.errors ?? {};

  const allowedSet = options.allowedFields
    ? new Set<string>(options.allowedFields as string[])
    : null;

  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (allowedSet && !allowedSet.has(field)) continue;

    const firstMessage = messages?.[0];
    if (!firstMessage) continue;

    setError(field as Path<TFieldValues>, {
      type: "server",
      message: firstMessage,
    });
  }

  if (options.includeRootMessage && payload?.message) {
    setError("root", { type: "server", message: payload.message });
  }

  return true;
}

export default handleLaravelErrors;
