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
import type { CatalogResponse, SalaOption } from "../../types/clase";

type SalaManagementDialogProps = {
  open: boolean;
  onClose: () => void;
};

const salaSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio.")
    .max(100, "Máximo 100 caracteres."),
  capacidad_max: z
    .number({ error: "Introduce un número válido." })
    .int("La capacidad debe ser un entero.")
    .min(1, "Debe ser al menos 1.")
    .max(999, "Máximo 999 plazas."),
});

type SalaFormValues = z.infer<typeof salaSchema>;

/**
 * Recupera el catálogo de salas del centro.
 */
async function fetchSalas(): Promise<SalaOption[]> {
  const { data } =
    await api.get<CatalogResponse<SalaOption>>("/api/admin/salas");
  return data.data;
}

/**
 * Diálogo para gestionar las salas del centro.
 *
 * @param open - Controla la visibilidad del diálogo.
 * @param onClose - Cierra el diálogo al cancelar o guardar.
 *
 * @remarks
 * Maneja `editing` para crear o editar salas. Las peticiones se hacen con `GET` sobre
 * `/api/admin/salas`. Las modificaciones se hacen con `POST`, `PUT` y `DELETE` sobre
 * el mismo recurso.
 */
export default function SalaManagementDialog({
  open,
  onClose,
}: SalaManagementDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<SalaOption | null>(null);

  const salasQuery = useQuery({
    queryKey: ["admin", "salas"] as const,
    queryFn: fetchSalas,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SalaFormValues>({
    resolver: zodResolver(salaSchema),
    defaultValues: { nombre: "", capacidad_max: 10 },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({ nombre: editing.nombre, capacidad_max: editing.capacidad_max });
    } else {
      reset({ nombre: "", capacidad_max: 10 });
    }
  }, [open, editing, reset]);

  const invalidateCatalogs = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "salas"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "clases"] });
  };

  const mutation = useMutation({
    mutationFn: async (values: SalaFormValues) => {
      if (editing) {
        const { data } = await api.put(
          `/api/admin/salas/${editing.id_sala}`,
          values,
        );
        return data;
      }
      const { data } = await api.post("/api/admin/salas", values);
      return data;
    },
    onSuccess: () => {
      invalidateCatalogs();
      toast.success(
        editing ? "Sala actualizada" : "Sala creada",
        editing
          ? "Los cambios están disponibles en los selectores."
          : "Ya puedes programar clases en la nueva sala.",
      );
      setEditing(null);
      reset({ nombre: "", capacidad_max: 10 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id_sala: number) => {
      await api.delete(`/api/admin/salas/${id_sala}`);
    },
    onSuccess: () => {
      invalidateCatalogs();
      toast.success("Sala eliminada");
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo eliminar la sala.";
      toast.error("No se pudo eliminar", message);
    },
  });

  const onSubmit = async (values: SalaFormValues) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      if (
        handleLaravelErrors(error, setError, {
          allowedFields: ["nombre", "capacidad_max"],
        })
      ) {
        return;
      }
      setError("root", {
        type: "server",
        message: editing
          ? "No se pudo actualizar la sala."
          : "No se pudo crear la sala.",
      });
    }
  };

  const handleDelete = async (sala: SalaOption) => {
    const ok = await confirm({
      title: `Eliminar "${sala.nombre}"`,
      description:
        "Esta acción es irreversible. No se podrá eliminar si hay clases programadas en esta sala.",
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    deleteMutation.mutate(sala.id_sala);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Gestionar salas"
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
            Gestionar salas
          </h2>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Define el inventario físico del centro: nombre de la sala y aforo.
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
                {editing ? `Editar "${editing.nombre}"` : "Crear nueva sala"}
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

            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="sala-nombre">Nombre</Label>
                <Input
                  id="sala-nombre"
                  placeholder="Ej. Sala 1 · Funcional"
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
                <Label htmlFor="sala-capacidad">Capacidad (plazas)</Label>
                <Input
                  id="sala-capacidad"
                  type="number"
                  min={1}
                  max={999}
                  aria-invalid={errors.capacidad_max ? "true" : "false"}
                  {...register("capacidad_max", { valueAsNumber: true })}
                />
                {errors.capacidad_max && (
                  <p className="text-xs text-[#b3261e]">
                    {errors.capacidad_max.message}
                  </p>
                )}
              </div>
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
                    : "Crear sala"}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-medium text-[rgba(4,14,32,0.87)]">
              Salas registradas
            </h3>
            {salasQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-[rgba(4,14,32,0.69)]">
                Cargando salas…
              </p>
            ) : salasQuery.isError ? (
              <p className="py-6 text-center text-sm text-[#b3261e]">
                No se pudieron cargar las salas.
              </p>
            ) : (salasQuery.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-[rgba(4,14,32,0.69)]">
                No hay salas registradas todavía.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef1f5] rounded-xl border border-[#e0e2e6]">
                {salasQuery.data?.map((sala) => (
                  <li
                    key={sala.id_sala}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[rgba(4,14,32,0.87)]">
                        {sala.nombre}
                      </p>
                      <p className="text-xs text-[rgba(4,14,32,0.55)]">
                        {sala.capacidad_max} plazas · #{sala.id_sala}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(sala)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#1b61c9] hover:bg-[#e8f0fd]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sala)}
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
