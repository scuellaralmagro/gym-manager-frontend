import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { handleLaravelErrors } from "../../lib/handleLaravelErrors";
import { cn } from "../../lib/utils";
import type { AdminClase } from "../../types/clase";
import {
  ROL_ID_BY_NOMBRE,
  type PaginatedResponse,
  type Usuario,
} from "../../types/usuario";

type ForceReservationDialogProps = {
  open: boolean;
  onClose: () => void;
};

const forceSchema = z.object({
  id_usuario: z
    .number({ error: "Selecciona un cliente." })
    .int()
    .positive({ error: "Selecciona un cliente." }),
  id_clase: z
    .number({ error: "Selecciona una clase." })
    .int()
    .positive({ error: "Selecciona una clase." }),
});

type ForceReservationValues = z.infer<typeof forceSchema>;

/**
 * Retrasa el valor de búsqueda para evitar peticiones por cada tecla.
 *
 * @param value - Valor original que cambia con cada pulsación.
 * @param delay - Milisegundos de espera antes de publicar el valor.
 */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Busca clientes por nombre, apellidos o email.
 *
 * @param search - Texto introducido por administración.
 */
async function searchClientes(search: string): Promise<Usuario[]> {
  const { data } = await api.get<PaginatedResponse<Usuario>>(
    "/api/admin/usuarios",
    {
      params: {
        id_rol: ROL_ID_BY_NOMBRE.Cliente,
        q: search || undefined,
        per_page: 10,
      },
    },
  );
  return data.data;
}

/**
 * Carga próximas clases disponibles.
 */
async function fetchUpcomingClases(): Promise<AdminClase[]> {
  // Recupero las próximas 50 clases (ordenadas por fecha asc en backend).
  const { data } = await api.get<PaginatedResponse<AdminClase>>(
    "/api/admin/clases",
    {
      params: {
        fecha_desde: todayIso(),
        per_page: 50,
        sort: "fecha",
        direction: "asc",
      },
    },
  );
  return data.data;
}

/**
 * Diálogo para que el admin cree una reserva manual.
 *
 * @param open - Controla la visibilidad del modal.
 * @param onClose - Cierra el flujo al cancelar o guardar.
 *
 * @remarks
 * Maneja `clienteSearch`, `debouncedClienteSearch` y `pinnedCliente` para no
 * perder el cliente seleccionado. Las peticiones se hacen con `GET` sobre
 * `/api/admin/usuarios` y `/api/admin/clases`. Las modificaciones se hacen con
 * `POST` sobre `/api/admin/reservas`.
 */
export default function ForceReservationDialog({
  open,
  onClose,
}: ForceReservationDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [clienteSearch, setClienteSearch] = useState("");
  const debouncedClienteSearch = useDebouncedValue(clienteSearch, 300);
  const [pinnedCliente, setPinnedCliente] = useState<Usuario | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ForceReservationValues>({
    resolver: zodResolver(forceSchema),
    defaultValues: {
      id_usuario: undefined as unknown as number,
      id_clase: undefined as unknown as number,
    },
    mode: "onBlur",
  });

  const idUsuario = watch("id_usuario");

  useEffect(() => {
    if (open) {
      reset({
        id_usuario: undefined as unknown as number,
        id_clase: undefined as unknown as number,
      });
      setClienteSearch("");
      setPinnedCliente(null);
    }
  }, [open, reset]);

  const clientesQuery = useQuery({
    queryKey: ["admin", "clientes-search", debouncedClienteSearch] as const,
    queryFn: () => searchClientes(debouncedClienteSearch),
    enabled: open,
    staleTime: 30_000,
  });

  const clasesQuery = useQuery({
    queryKey: ["admin", "clases-upcoming"] as const,
    queryFn: fetchUpcomingClases,
    enabled: open,
    staleTime: 60_000,
  });

  const rawClientes = clientesQuery.data;
  const clases = clasesQuery.data ?? [];

  // Garantizo que el cliente fijado siga apareciendo en el <select> aunque la
  // búsqueda actual ya no lo devuelva
  const clientes = useMemo(() => {
    const base = rawClientes ?? [];
    if (!pinnedCliente) return base;
    const exists = base.some((c) => c.id_usuario === pinnedCliente.id_usuario);
    return exists ? base : [pinnedCliente, ...base];
  }, [rawClientes, pinnedCliente]);

  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id_usuario === idUsuario) ?? null,
    [clientes, idUsuario],
  );

  useEffect(() => {
    if (!selectedCliente) return;
    if (pinnedCliente?.id_usuario === selectedCliente.id_usuario) return;
    setPinnedCliente(selectedCliente);
  }, [selectedCliente, pinnedCliente]);

  const mutation = useMutation({
    mutationFn: async (values: ForceReservationValues) => {
      const { data } = await api.post("/api/admin/reservas", values);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reservas"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "clases"] });
      toast.success(
        "Reserva creada",
        "La reserva se ha forzado correctamente.",
      );
      onClose();
    },
  });

  const onSubmit = async (values: ForceReservationValues) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      if (
        handleLaravelErrors(error, setError, {
          allowedFields: ["id_usuario", "id_clase"],
        })
      ) {
        return;
      }

      // 409 típicos: reserva activa duplicada
      if (isAxiosError(error) && error.response?.status === 409) {
        const message =
          typeof error.response.data?.message === "string"
            ? error.response.data.message
            : "No se pudo forzar la reserva.";
        setError("root", { type: "server", message });
        return;
      }

      setError("root", {
        type: "server",
        message: "No se pudo forzar la reserva. Inténtalo de nuevo.",
      });
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Forzar reserva"
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
          <h2 className="text-lg font-medium tracking-tight">Forzar reserva</h2>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Asigna manualmente una clase a un cliente. Este flujo omite las
            comprobaciones de aforo y de clase pasada.
          </p>
        </header>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="forzar-cliente-buscar">Cliente</Label>
            <Input
              id="forzar-cliente-buscar"
              type="search"
              placeholder="Buscar por nombre, apellidos o email…"
              value={clienteSearch}
              onChange={(event) => setClienteSearch(event.target.value)}
            />
            <select
              id="forzar-cliente"
              aria-label="Cliente"
              aria-invalid={errors.id_usuario ? "true" : "false"}
              className={selectClassName}
              {...register("id_usuario", {
                setValueAs: (v) =>
                  v === "" || v == null
                    ? (undefined as unknown as number)
                    : Number(v),
              })}
            >
              <option value="">
                {clientesQuery.isLoading
                  ? "Cargando clientes…"
                  : clientes.length === 0
                    ? "Sin coincidencias"
                    : "Selecciona un cliente…"}
              </option>
              {clientes.map((cliente) => (
                <option key={cliente.id_usuario} value={cliente.id_usuario}>
                  #{cliente.id_usuario} · {cliente.nombre} {cliente.apellidos}
                  {" · "}
                  {cliente.email}
                </option>
              ))}
            </select>
            {selectedCliente && (
              <p className="text-xs text-[rgba(4,14,32,0.55)]">
                Seleccionado: {selectedCliente.nombre}{" "}
                {selectedCliente.apellidos} ({selectedCliente.email})
              </p>
            )}
            {errors.id_usuario && (
              <p className="text-xs text-[#b3261e]">
                {errors.id_usuario.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="forzar-clase">Clase</Label>
            <select
              id="forzar-clase"
              aria-invalid={errors.id_clase ? "true" : "false"}
              className={selectClassName}
              {...register("id_clase", {
                setValueAs: (v) =>
                  v === "" || v == null
                    ? (undefined as unknown as number)
                    : Number(v),
              })}
            >
              <option value="">
                {clasesQuery.isLoading
                  ? "Cargando clases…"
                  : clases.length === 0
                    ? "No hay clases próximas"
                    : "Selecciona una clase…"}
              </option>
              {clases.map((clase) => (
                <option key={clase.id_clase} value={clase.id_clase}>
                  {formatClaseOption(clase)}
                </option>
              ))}
            </select>
            {errors.id_clase && (
              <p className="text-xs text-[#b3261e]">
                {errors.id_clase.message}
              </p>
            )}
            <p className="text-xs text-[rgba(4,14,32,0.55)]">
              Listamos las próximas 50 clases. Si necesitas una clase pasada,
              solicita la corrección al equipo técnico.
            </p>
          </div>

          <div
            role="note"
            className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]"
          >
            Al forzar la reserva se ignoran el aforo máximo y la validación de
            fecha futura. Si el cliente tenía una reserva cancelada previa para
            esa clase, se reactivará.
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
              {isSubmitting ? "Creando…" : "Forzar reserva"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatClaseOption(clase: AdminClase): string {
  const [y, m, d] = clase.fecha.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const fechaCorta = date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const horaInicio = clase.hora_inicio.slice(0, 5);
  const ocupacion = `${clase.reservas_activas}/${clase.cupo_maximo}`;
  return `${clase.actividad} · ${fechaCorta} ${horaInicio} · ${clase.sala} (${ocupacion})`;
}

const selectClassName = cn(
  "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
  "px-3 text-base tracking-[0.08px] text-[#181d26]",
  "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
);
