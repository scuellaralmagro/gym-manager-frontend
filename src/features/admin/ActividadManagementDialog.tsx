import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useConfirm } from "../../components/ui/use-confirm";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { handleLaravelErrors } from "../../lib/handleLaravelErrors";
import { cn } from "../../lib/utils";
import type { ActividadOption, CatalogResponse } from "../../types/clase";

type ActividadManagementDialogProps = {
  open: boolean;
  onClose: () => void;
};

const actividadSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio.")
    .max(100, "Máximo 100 caracteres."),
  descripcion: z
    .string()
    .min(1, "La descripción es obligatoria.")
    .max(1000, "Máximo 1000 caracteres."),
});

type ActividadFormValues = z.infer<typeof actividadSchema>;

/**
 * Recupera el catálogo de actividades.
 *
 * @returns Lista de actividades recibida de `/api/admin/actividades`.
 */
async function fetchActividades(): Promise<ActividadOption[]> {
  const { data } = await api.get<CatalogResponse<ActividadOption>>(
    "/api/admin/actividades",
  );
  return data.data;
}

/**
 * Diálogo para crear, editar y borrar actividades del catálogo.
 *
 * @param open - Controla si el modal está visible.
 * @param onClose - Cierra el modal desde el componente padre.
 *
 * @remarks
 * Mantiene `editing` como estado local para alternar entre alta y edición.
 * TanStack Query carga actividades con `GET /api/admin/actividades`. Las
 * modificaciones se hacen con `POST`/`PUT`/`DELETE` sobre `/api/admin/actividades`.
 */
export default function ActividadManagementDialog({
  open,
  onClose,
}: ActividadManagementDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<ActividadOption | null>(null);

  const actividadesQuery = useQuery({
    queryKey: ["admin", "actividades"] as const,
    queryFn: fetchActividades,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ActividadFormValues>({
    resolver: zodResolver(actividadSchema),
    defaultValues: { nombre: "", descripcion: "" },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        nombre: editing.nombre,
        descripcion: editing.descripcion ?? "",
      });
    } else {
      reset({ nombre: "", descripcion: "" });
    }
  }, [open, editing, reset]);

  const invalidateCatalogs = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "actividades"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "clases"] });
  };

  const mutation = useMutation({
    mutationFn: async (values: ActividadFormValues) => {
      if (editing) {
        const { data } = await api.put(
          `/api/admin/actividades/${editing.id_actividad}`,
          values,
        );
        return data;
      }
      const { data } = await api.post("/api/admin/actividades", values);
      return data;
    },
    onSuccess: () => {
      invalidateCatalogs();
      toast.success(
        editing ? "Actividad actualizada" : "Actividad creada",
        editing
          ? "Los cambios están disponibles en los selectores."
          : "Ya puedes programar clases con esta actividad.",
      );
      setEditing(null);
      reset({ nombre: "", descripcion: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id_actividad: number) => {
      await api.delete(`/api/admin/actividades/${id_actividad}`);
    },
    onSuccess: () => {
      invalidateCatalogs();
      toast.success("Actividad eliminada");
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo eliminar la actividad.";
      toast.error("No se pudo eliminar", message);
    },
  });

  const onSubmit = async (values: ActividadFormValues) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      if (
        handleLaravelErrors(error, setError, {
          allowedFields: ["nombre", "descripcion"],
        })
      ) {
        return;
      }
      setError("root", {
        type: "server",
        message: editing
          ? "No se pudo actualizar la actividad."
          : "No se pudo crear la actividad.",
      });
    }
  };

  const handleDelete = async (actividad: ActividadOption) => {
    const ok = await confirm({
      title: `Eliminar "${actividad.nombre}"`,
      description:
        "Esta acción es irreversible. No se podrá eliminar si ya hay clases programadas con esta actividad.",
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    deleteMutation.mutate(actividad.id_actividad);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Gestionar actividades"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#e0e2e6] bg-white shadow-[rgba(15,48,106,0.12)_0px_10px_30px]">
        <header className="border-b border-[#e0e2e6] px-6 py-4">
          <h2 className="text-lg font-medium tracking-tight">
            Gestionar actividades
          </h2>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Administra el catálogo de disciplinas que pueden asignarse a las
            clases.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form
            className="space-y-3 rounded-xl border border-[#e0e2e6] bg-[#f8fafc] p-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-[rgba(4,14,32,0.87)]">
                {editing
                  ? `Editar "${editing.nombre}"`
                  : "Crear nueva actividad"}
              </h3>
              {editing && (
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-xs font-medium text-[#1b61c9] hover:underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actividad-nombre">Nombre</Label>
              <Input
                id="actividad-nombre"
                placeholder="Ej. Spinning"
                aria-invalid={errors.nombre ? "true" : "false"}
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-xs text-[#b3261e]">
                  {errors.nombre.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actividad-descripcion">Descripción</Label>
              <textarea
                id="actividad-descripcion"
                rows={3}
                aria-invalid={errors.descripcion ? "true" : "false"}
                placeholder="Breve descripción orientada al cliente."
                className={cn(
                  "flex w-full rounded-[12px] border border-[#e0e2e6] bg-white px-3 py-2",
                  "text-base tracking-[0.08px] text-[#181d26]",
                  "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
                )}
                {...register("descripcion")}
              />
              {errors.descripcion && (
                <p className="text-xs text-[#b3261e]">
                  {errors.descripcion.message}
                </p>
              )}
            </div>

            {errors.root && (
              <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-xs text-[#b3261e]">
                {errors.root.message}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 w-auto px-5"
              >
                {isSubmitting
                  ? "Guardando…"
                  : editing
                    ? "Guardar cambios"
                    : "Crear actividad"}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-[rgba(4,14,32,0.87)]">
              Actividades registradas
            </h3>
            {actividadesQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-[rgba(4,14,32,0.69)]">
                Cargando actividades…
              </p>
            ) : actividadesQuery.isError ? (
              <p className="py-6 text-center text-sm text-[#b3261e]">
                No se pudieron cargar las actividades.
              </p>
            ) : (actividadesQuery.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-[rgba(4,14,32,0.69)]">
                No hay actividades registradas todavía.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef1f5] rounded-xl border border-[#e0e2e6]">
                {actividadesQuery.data?.map((actividad) => (
                  <li
                    key={actividad.id_actividad}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[rgba(4,14,32,0.87)]">
                        {actividad.nombre}
                      </p>
                      {actividad.descripcion && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[rgba(4,14,32,0.55)]">
                          {actividad.descripcion}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(actividad)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#1b61c9] hover:bg-[#e8f0fd]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(actividad)}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#b3261e] hover:bg-[#fdecea] disabled:opacity-50"
                      >
                        Borrar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="border-t border-[#e0e2e6] px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[rgba(4,14,32,0.75)] hover:bg-[#f1f5f9]"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
