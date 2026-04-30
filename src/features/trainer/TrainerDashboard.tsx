import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import type {
  AsistenciaItem,
  EntrenadorClase,
} from "../../types/entrenador";

type CollectionResponse<T> = { data: T[] };

/**
 * Carga la agenda próxima del entrenador autenticado.
 */
async function fetchAgenda(): Promise<EntrenadorClase[]> {
  const { data } = await api.get<CollectionResponse<EntrenadorClase>>(
    "/api/entrenador/agenda",
  );
  return data.data;
}

/**
 * Carga los alumnos reservados para una clase concreta.
 *
 * @param idClase - Identificador de la clase seleccionada.
 */
async function fetchAsistencia(idClase: number): Promise<AsistenciaItem[]> {
  const { data } = await api.get<CollectionResponse<AsistenciaItem>>(
    `/api/clases/${idClase}/asistencia`,
  );
  return data.data;
}

function parseInicio(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0, 0, 0);
}

function formatFechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const raw = format(date, "EEEE dd MMM", { locale: es });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Pantalla inicial del entrenador.
 *
 * @remarks
 * Maneja `idClaseSelManual` para recordar la clase seleccionada. TanStack Query
 * llama a `GET /api/entrenador/agenda` y, al seleccionar una clase,
 * `GET /api/clases/{id}/asistencia`.
 */
export default function TrainerDashboard() {
  const agendaQuery = useQuery({
    queryKey: ["entrenador", "agenda"] as const,
    queryFn: fetchAgenda,
    staleTime: 60_000,
  });

  const [idClaseSelManual, setIdClaseSelManual] = useState<number | null>(
    null,
  );

  const clases = useMemo(() => agendaQuery.data ?? [], [agendaQuery.data]);

  const idClaseSel =
    idClaseSelManual !== null &&
    clases.some((c) => c.id_clase === idClaseSelManual)
      ? idClaseSelManual
      : (clases[0]?.id_clase ?? null);

  const claseSel = useMemo(
    () => clases.find((c) => c.id_clase === idClaseSel) ?? null,
    [clases, idClaseSel],
  );

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Inicio</h1>
        <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
          Consulta tus próximas clases y sus alumnos reservados.
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[2fr_3fr]">
        <AgendaColumna
          loading={agendaQuery.isLoading}
          error={agendaQuery.isError}
          clases={clases}
          idClaseSel={idClaseSel}
          onSeleccionar={setIdClaseSelManual}
        />

        <AsistenciaColumna clase={claseSel} />
      </div>
    </section>
  );
}

type AgendaColumnaProps = {
  loading: boolean;
  error: boolean;
  clases: EntrenadorClase[];
  idClaseSel: number | null;
  onSeleccionar: (id: number) => void;
};

/**
 * Columna de clases próximas asignadas al entrenador.
 */
function AgendaColumna({
  loading,
  error,
  clases,
  idClaseSel,
  onSeleccionar,
}: AgendaColumnaProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda próxima</CardTitle>
        <CardDescription>
          Clases asignadas a ti, de hoy en adelante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <p className="text-sm text-[rgba(4,14,32,0.55)]">
            Cargando agenda…
          </p>
        )}

        {error && !loading && (
          <p className="text-sm text-[#b3261e]">
            No se pudo cargar la agenda.
          </p>
        )}

        {!loading && !error && clases.length === 0 && (
          <p className="text-sm text-[rgba(4,14,32,0.55)]">
            No tienes clases programadas.
          </p>
        )}

        {clases.map((c) => (
          <AgendaCard
            key={c.id_clase}
            clase={c}
            selected={c.id_clase === idClaseSel}
            onClick={() => onSeleccionar(c.id_clase)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

type AgendaCardProps = {
  clase: EntrenadorClase;
  selected: boolean;
  onClick: () => void;
};

function AgendaCard({ clase, selected, onClick }: AgendaCardProps) {
  const inicio = parseInicio(clase.fecha, clase.hora_inicio);
  const esPasada = inicio.getTime() < new Date().getTime();
  const reservasActivas = clase.cupo_maximo - clase.plazas_disponibles;
  const horario = `${clase.hora_inicio.slice(0, 5)} – ${clase.hora_fin.slice(0, 5)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-1 rounded-[14px] border px-4 py-3 text-left",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/40",
        selected
          ? "border-[#1b61c9] bg-[#eef4fd]"
          : "border-[#e0e2e6] bg-white hover:bg-[#f1f5f9]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[rgba(4,14,32,0.55)]">
          {formatFechaLarga(clase.fecha)} · {horario}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            esPasada
              ? "bg-[#f1f5f9] text-[rgba(4,14,32,0.55)]"
              : "bg-[#e6f6ec] text-[#146c43]",
          )}
        >
          {esPasada ? "Pasada" : "Próxima"}
        </span>
      </div>
      <p className="text-base font-semibold tracking-tight text-[#0d1220]">
        {clase.actividad}
      </p>
      <p className="text-xs text-[rgba(4,14,32,0.69)]">
        Sala: {clase.sala.nombre} · Reservas: {reservasActivas}/
        {clase.cupo_maximo}
      </p>
    </button>
  );
}

type AsistenciaColumnaProps = {
  clase: EntrenadorClase | null;
};

function AsistenciaColumna({ clase }: AsistenciaColumnaProps) {
  if (!clase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alumnos reservados</CardTitle>
          <CardDescription>
            Selecciona una clase a la izquierda para ver los alumnos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-[#e0e2e6] bg-[#fafbfc] p-10 text-center text-sm text-[rgba(4,14,32,0.55)]">
            Ninguna clase seleccionada.
          </div>
        </CardContent>
      </Card>
    );
  }

  return <AsistenciaPanel key={clase.id_clase} clase={clase} />;
}

type AsistenciaPanelProps = {
  clase: EntrenadorClase;
};

/**
 * Panel de alumnos de la clase seleccionada.
 */
function AsistenciaPanel({ clase }: AsistenciaPanelProps) {
  const asistenciaQuery = useQuery({
    queryKey: ["entrenador", "asistencia", clase.id_clase] as const,
    queryFn: () => fetchAsistencia(clase.id_clase),
    staleTime: 30_000,
  });

  const alumnos = asistenciaQuery.data ?? [];
  const horario = `${clase.hora_inicio.slice(0, 5)} – ${clase.hora_fin.slice(0, 5)}`;
  const reservasActivas = clase.cupo_maximo - clase.plazas_disponibles;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Alumnos · {clase.actividad}</CardTitle>
            <CardDescription>
              {formatFechaLarga(clase.fecha)} · {horario} · Sala{" "}
              {clase.sala.nombre}
            </CardDescription>
          </div>
          <span className="rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-xs font-medium text-[rgba(4,14,32,0.69)]">
            {reservasActivas}/{clase.cupo_maximo}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {asistenciaQuery.isLoading && (
          <p className="text-sm text-[rgba(4,14,32,0.55)]">
            Cargando alumnos…
          </p>
        )}

        {asistenciaQuery.isError && (
          <p className="text-sm text-[#b3261e]">
            No se pudo cargar la lista de alumnos.
          </p>
        )}

        {!asistenciaQuery.isLoading &&
          !asistenciaQuery.isError &&
          alumnos.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#e0e2e6] bg-[#fafbfc] p-10 text-center text-sm text-[rgba(4,14,32,0.55)]">
              No hay alumnos reservados en esta clase.
            </div>
          )}

        {!asistenciaQuery.isLoading && alumnos.length > 0 && (
          <>
            <ul className="divide-y divide-[#eef0f3] rounded-2xl border border-[#e0e2e6] bg-white">
              {alumnos.map((a) => (
                <AlumnoItem key={a.cliente.id_usuario} alumno={a} />
              ))}
            </ul>

            {/* Registro persistente de asistencia: pendiente de implementación. */}
            <div className="rounded-2xl border border-dashed border-[#e0e2e6] bg-[#fafbfc] p-4">
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0d1220]">
                    Registro de asistencia
                  </p>
                  <p className="mt-0.5 text-xs text-[rgba(4,14,32,0.55)]">
                    Marcar asistidos y ausentes llegará en la próxima iteración.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Próximamente"
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-[12px]",
                    "bg-[#1b61c9] px-5 text-sm font-medium text-white",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  Guardar asistencia · Próximamente
                </button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type AlumnoItemProps = {
  alumno: AsistenciaItem;
};

function AlumnoItem({ alumno }: AlumnoItemProps) {
  const { nombre, apellidos, email } = alumno.cliente;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          "bg-[#f1f5f9] text-xs font-medium text-[rgba(4,14,32,0.69)] ring-1 ring-inset ring-[#e0e2e6]",
        )}
      >
        {(nombre.charAt(0) + apellidos.charAt(0)).toUpperCase() || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0d1220]">
          {nombre} {apellidos}
        </p>
        <p className="truncate text-xs text-[rgba(4,14,32,0.55)]">{email}</p>
      </div>
    </li>
  );
}
