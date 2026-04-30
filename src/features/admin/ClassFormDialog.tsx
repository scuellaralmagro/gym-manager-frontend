import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { handleLaravelErrors } from "../../lib/handleLaravelErrors";
import { cn } from "../../lib/utils";
import type {
  ActividadOption,
  AdminClase,
  CatalogResponse,
  EntrenadorOption,
  SalaOption,
} from "../../types/clase";
import { createClassSchema, type CreateClassValues } from "./classSchema";

type ClassFormDialogProps = {
  open: boolean;
  onClose: () => void;
  clase: AdminClase | null;
};

/**
 * Carga catálogos usados en el formulario de clases.
 *
 * @param url - Endpoint del catálogo en el backend Laravel.
 * @returns Lista tipada recibida desde Axios.
 */
async function fetchCatalog<T>(url: string): Promise<T[]> {
  const { data } = await api.get<CatalogResponse<T>>(url);
  return data.data;
}

/**
 * Diálogo para programar o editar una clase.
 *
 * @param open - Indica si el diálogo se muestra.
 * @param onClose - Callback para cerrarlo al guardar o cancelar.
 * @param clase - Clase a editar. Si es `null`, el formulario crea una nueva.
 *
 * @remarks
 * Usa estados derivados como `isEdit`, `idSala` y `selectedSala`. Carga salas,
 * actividades y entrenadores con TanStack Query. Las modificaciones se hacen con `POST`/`PUT` sobre
 * `/api/admin/clases`.
 */
export default function ClassFormDialog({
  open,
  onClose,
  clase,
}: ClassFormDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = Boolean(clase);

  // Catálogos de salas, actividades y entrenadores para los selectores
  const salasQuery = useQuery({
    queryKey: ["admin", "salas"] as const,
    queryFn: () => fetchCatalog<SalaOption>("/api/admin/salas"),
    staleTime: 5 * 60000, // Refresco cada 5 minutos
  });

  const actividadesQuery = useQuery({
    queryKey: ["admin", "actividades"] as const,
    queryFn: () => fetchCatalog<ActividadOption>("/api/admin/actividades"),
    staleTime: 5 * 60_000,
  });

  const entrenadoresQuery = useQuery({
    queryKey: ["admin", "entrenadores"] as const,
    queryFn: () => fetchCatalog<EntrenadorOption>("/api/admin/entrenadores"),
    staleTime: 5 * 60_000,
  });

  const salas = salasQuery.data ?? [];

  // Esquema para validar los datos del formulario
  const schema = useMemo(
    () => createClassSchema(salas, { requireFutureDate: !isEdit }),
    [salas, isEdit],
  );

  const defaultValues: Partial<CreateClassValues> = clase
    ? {
        fecha: clase.fecha,
        hora_inicio: clase.hora_inicio.slice(0, 5),
        hora_fin: clase.hora_fin.slice(0, 5),
        cupo_maximo: clase.cupo_maximo,
        id_sala: clase.id_sala,
        id_usuario: clase.entrenador.id_usuario,
        id_actividad: clase.id_actividad,
      }
    : {
        fecha: "",
        hora_inicio: "",
        hora_fin: "",
        cupo_maximo: 1,
        id_sala: undefined,
        id_usuario: undefined,
        id_actividad: undefined,
      };

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CreateClassValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as CreateClassValues,
    mode: "onBlur",
  });

  // Reset de los valores del formulario cuando se abre el dialogo
  useEffect(() => {
    if (open) {
      reset(defaultValues as CreateClassValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clase?.id_clase, reset]);

  // Cuando el admin cambia de sala, revalido cupo_maximo para reflejar el nuevo tope sin esperar al submit
  const idSala = watch("id_sala");
  useEffect(() => {
    if (idSala) {
      void trigger("cupo_maximo");
    }
  }, [idSala, trigger]);

  const mutation = useMutation({
    mutationFn: async (values: CreateClassValues) => {
      const payload = {
        fecha: values.fecha,
        hora_inicio: values.hora_inicio,
        hora_fin: values.hora_fin,
        cupo_maximo: values.cupo_maximo,
        id_sala: values.id_sala,
        id_usuario: values.id_usuario,
        id_actividad: values.id_actividad,
      };

      if (isEdit && clase) {
        const { data } = await api.put(
          `/api/admin/clases/${clase.id_clase}`,
          payload,
        );
        return data;
      }

      const { data } = await api.post("/api/admin/clases", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clases"] });
      toast.success(isEdit ? "Clase actualizada" : "Clase creada");
      onClose();
    },
  });

  const onSubmit = async (values: CreateClassValues) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      if (
        handleLaravelErrors(error, setError, {
          allowedFields: [
            "fecha",
            "hora_inicio",
            "hora_fin",
            "cupo_maximo",
            "id_sala",
            "id_usuario",
            "id_actividad",
          ],
        })
      ) {
        return;
      }
      setError("root", {
        type: "server",
        message: isEdit
          ? "No se pudo actualizar la clase. Inténtalo de nuevo."
          : "No se pudo crear la clase. Inténtalo de nuevo.",
      });
    }
  };

  if (!open) return null;

  const selectedSala = salas.find((s) => s.id_sala === idSala);
  const catalogsLoading =
    salasQuery.isLoading ||
    actividadesQuery.isLoading ||
    entrenadoresQuery.isLoading;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={isEdit ? "Editar clase" : "Programar nueva clase"}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative max-h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-[#e0e2e6] bg-white p-6 shadow-[rgba(15,48,106,0.12)_0px_10px_30px]">
        <header className="mb-4">
          <h2 className="text-lg font-medium tracking-tight">
            {isEdit ? "Editar clase" : "Programar nueva clase"}
          </h2>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            {isEdit
              ? `Modifica los datos de la clase #${clase?.id_clase}.`
              : "Define la sesión indicando horario, sala, actividad y entrenador."}
          </p>
        </header>

        {catalogsLoading ? (
          <p className="py-8 text-center text-sm text-[rgba(4,14,32,0.69)]">
            Cargando catálogos…
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="clase-fecha">Fecha</Label>
                <Input
                  id="clase-fecha"
                  type="date"
                  aria-invalid={errors.fecha ? "true" : "false"}
                  {...register("fecha")}
                />
                {errors.fecha && (
                  <p className="text-xs text-[#b3261e]">
                    {errors.fecha.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clase-hora-inicio">Hora inicio</Label>
                <Input
                  id="clase-hora-inicio"
                  type="time"
                  aria-invalid={errors.hora_inicio ? "true" : "false"}
                  {...register("hora_inicio")}
                />
                {errors.hora_inicio && (
                  <p className="text-xs text-[#b3261e]">
                    {errors.hora_inicio.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clase-hora-fin">Hora fin</Label>
                <Input
                  id="clase-hora-fin"
                  type="time"
                  aria-invalid={errors.hora_fin ? "true" : "false"}
                  {...register("hora_fin")}
                />
                {errors.hora_fin && (
                  <p className="text-xs text-[#b3261e]">
                    {errors.hora_fin.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clase-actividad">Actividad</Label>
              <select
                id="clase-actividad"
                aria-invalid={errors.id_actividad ? "true" : "false"}
                className={selectClassName}
                {...register("id_actividad", { valueAsNumber: true })}
              >
                <option value="">Selecciona una actividad…</option>
                {actividadesQuery.data?.map((actividad) => (
                  <option
                    key={actividad.id_actividad}
                    value={actividad.id_actividad}
                  >
                    {actividad.nombre}
                  </option>
                ))}
              </select>
              {errors.id_actividad && (
                <p className="text-xs text-[#b3261e]">
                  {errors.id_actividad.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clase-entrenador">Entrenador</Label>
                <select
                  id="clase-entrenador"
                  aria-invalid={errors.id_usuario ? "true" : "false"}
                  className={selectClassName}
                  {...register("id_usuario", { valueAsNumber: true })}
                >
                  <option value="">Selecciona un entrenador…</option>
                  {entrenadoresQuery.data?.map((entrenador) => (
                    <option
                      key={entrenador.id_usuario}
                      value={entrenador.id_usuario}
                    >
                      {entrenador.nombre} {entrenador.apellidos}
                    </option>
                  ))}
                </select>
                {errors.id_usuario && (
                  <p className="text-xs text-[#b3261e]">
                    {errors.id_usuario.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clase-sala">Sala</Label>
                <select
                  id="clase-sala"
                  aria-invalid={errors.id_sala ? "true" : "false"}
                  className={selectClassName}
                  {...register("id_sala", { valueAsNumber: true })}
                >
                  <option value="">Selecciona una sala…</option>
                  {salas.map((sala) => (
                    <option key={sala.id_sala} value={sala.id_sala}>
                      {sala.nombre} · {sala.capacidad_max} plazas
                    </option>
                  ))}
                </select>
                {errors.id_sala && (
                  <p className="text-xs text-[#b3261e]">
                    {errors.id_sala.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clase-cupo">Cupo máximo</Label>
              <Input
                id="clase-cupo"
                type="number"
                min={1}
                max={selectedSala?.capacidad_max ?? undefined}
                aria-invalid={errors.cupo_maximo ? "true" : "false"}
                {...register("cupo_maximo", { valueAsNumber: true })}
              />
              {selectedSala && (
                <p className="text-xs text-[rgba(4,14,32,0.55)]">
                  Capacidad física de {selectedSala.nombre}:{" "}
                  {selectedSala.capacidad_max} plazas.
                </p>
              )}
              {errors.cupo_maximo && (
                <p className="text-xs text-[#b3261e]">
                  {errors.cupo_maximo.message}
                </p>
              )}
            </div>

            {errors.root && (
              <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-xs text-[#b3261e]">
                {errors.root.message}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[rgba(4,14,32,0.75)] hover:bg-[#f1f5f9]"
              >
                Cancelar
              </button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 w-auto px-5"
              >
                {isSubmitting
                  ? "Guardando…"
                  : isEdit
                    ? "Guardar cambios"
                    : "Crear clase"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const selectClassName = cn(
  "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
  "px-3 text-base tracking-[0.08px] text-[#181d26]",
  "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
);
