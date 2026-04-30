import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases CSS y resuelve conflictos de Tailwind.
 *
 * @param inputs - Clases sueltas, condicionales o arrays compatibles con `clsx`.
 * @returns Cadena final lista para usar en `className`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
