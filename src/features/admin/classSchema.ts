import { z } from "zod";

import type { SalaOption } from "../../types/clase";

const TIME_REGEX = /^\d{2}:\d{2}(?::\d{2})?$/;

function parseDateISO(date: string): Date | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Opciones de validación para el formulario de clases.
 */
export type ClassSchemaOptions = {
  requireFutureDate?: boolean;
};

/**
 * Crea el esquema Zod para alta y edición de clases.
 *
 * @param salas - Catálogo de salas usado para validar que el cupo no supere la capacidad.
 * @param options - Permite exigir o no fecha futura según sea creación o edición.
 */
export function createClassSchema(
  salas: SalaOption[],
  options: ClassSchemaOptions = {},
) {
  const { requireFutureDate = true } = options;

  return z
    .object({
      fecha: z
        .string()
        .min(1, "Selecciona una fecha.")
        .refine(
          (value) => {
            if (!requireFutureDate) return true;
            const parsed = parseDateISO(value);
            if (!parsed) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return parsed.getTime() >= today.getTime();
          },
          { message: "La fecha debe ser hoy o posterior." },
        ),
      hora_inicio: z.string().regex(TIME_REGEX, "Formato HH:mm."),
      hora_fin: z.string().regex(TIME_REGEX, "Formato HH:mm."),
      cupo_maximo: z
        .number({ error: "El cupo es obligatorio." })
        .int()
        .min(1, "El cupo mínimo es 1."),
      id_sala: z.number({ error: "Selecciona una sala." }).int().positive(),
      id_usuario: z
        .number({ error: "Selecciona un entrenador." })
        .int()
        .positive(),
      id_actividad: z
        .number({ error: "Selecciona una actividad." })
        .int()
        .positive(),
    })
    .superRefine((values, ctx) => {
      if (values.hora_inicio >= values.hora_fin) {
        ctx.addIssue({
          code: "custom",
          path: ["hora_fin"],
          message: "La hora de fin debe ser posterior a la de inicio.",
        });
      }

      const sala = salas.find((s) => s.id_sala === values.id_sala);
      if (sala && values.cupo_maximo > sala.capacidad_max) {
        ctx.addIssue({
          code: "custom",
          path: ["cupo_maximo"],
          message: `El cupo no puede superar la capacidad de la sala (${sala.capacidad_max} plazas).`,
        });
      }
    });
}

/**
 * Valores del formulario de clase inferidos desde el esquema Zod.
 */
export type CreateClassValues = z.infer<ReturnType<typeof createClassSchema>>;
