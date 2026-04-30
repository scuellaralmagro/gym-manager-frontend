import { useQuery } from "@tanstack/react-query";
import { addDays, format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  Views,
  type View,
} from "react-big-calendar";
import { useNavigate } from "react-router-dom";

import "react-big-calendar/lib/css/react-big-calendar.css";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import type { EntrenadorClase } from "../../types/entrenador";

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const RBC_MESSAGES = {
  today: "Hoy",
  previous: "<",
  next: ">",
  month: "Mes",
  week: "Semana",
  day: "Día",
  work_week: "L-V",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Clase",
  noEventsInRange: "No tienes clases programadas en este rango.",
  showMore: (total: number) => `+${total} más`,
};

// Formatos en es-ES para el calendario
const RBC_FORMATS = {
  dayFormat: (date: Date) =>
    format(date, "EEE dd", { locale: es }).replace(/\./, ""),
  weekdayFormat: (date: Date) => format(date, "EEEE", { locale: es }),
  timeGutterFormat: (date: Date) => format(date, "HH:mm"),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`,
};

type TrainerEvento = {
  id_clase: number;
  title: string;
  start: Date;
  end: Date;
  actividad: string;
  sala: string;
  reservas_activas: number;
  cupo_maximo: number;
};

type CollectionResponse<T> = { data: T[] };

type RangoFechas = { desde: string; hasta: string };

/**
 * Carga la agenda del entrenador para un rango de fechas.
 *
 * @param rango - Fechas `desde` y `hasta` enviadas al backend.
 */
async function fetchAgenda(rango: RangoFechas): Promise<EntrenadorClase[]> {
  const { data } = await api.get<CollectionResponse<EntrenadorClase>>(
    "/api/entrenador/agenda",
    { params: { desde: rango.desde, hasta: rango.hasta } },
  );
  return data.data;
}

/**
 * Calcula el rango inicial de semana laboral actual, de lunes a viernes.
 */
function rangoSemanaLaboralInicial(): RangoFechas {
  const hoy = new Date();
  const inicio = startOfWeek(hoy, { weekStartsOn: 1 });
  const fin = addDays(inicio, 4);
  return {
    desde: format(inicio, "yyyy-MM-dd"),
    hasta: format(fin, "yyyy-MM-dd"),
  };
}

/**
 * Parsea fecha y hora de clase a `Date` local.
 */
function parseClaseFecha(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0, 0, 0);
}

/**
 * Agenda semanal del entrenador.
 *
 * @remarks
 * Maneja `view`, `date` y `rango` para sincronizar React Big Calendar con la
 * API. TanStack Query llama a `GET /api/entrenador/agenda` con parámetros
 * `desde` y `hasta`.
 */
export default function TrainerWeeklyAgenda() {
  const [view, setView] = useState<View>(Views.WORK_WEEK);
  const [date, setDate] = useState<Date>(() => new Date());
  const [rango, setRango] = useState<RangoFechas>(() =>
    rangoSemanaLaboralInicial(),
  );

  const agendaQuery = useQuery({
    queryKey: ["entrenador", "agenda", rango.desde, rango.hasta] as const,
    queryFn: () => fetchAgenda(rango),
    staleTime: 60_000,
  });

  const handleRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date }) => {
      let inicio: Date;
      let fin: Date;
      if (Array.isArray(range)) {
        if (range.length === 0) return;
        inicio = range[0];
        fin = range[range.length - 1];
      } else {
        inicio = range.start;
        fin = range.end;
      }
      setRango({
        desde: format(inicio, "yyyy-MM-dd"),
        hasta: format(fin, "yyyy-MM-dd"),
      });
    },
    [],
  );

  const rawClases = agendaQuery.data;

  const events = useMemo<TrainerEvento[]>(() => {
    const lista = rawClases ?? [];
    return lista.map<TrainerEvento>((c) => {
      const start = parseClaseFecha(c.fecha, c.hora_inicio);
      const end = parseClaseFecha(c.fecha, c.hora_fin);
      const reservasActivas = c.cupo_maximo - c.plazas_disponibles;
      return {
        id_clase: c.id_clase,
        title: c.actividad,
        start,
        end,
        actividad: c.actividad,
        sala: c.sala.nombre,
        reservas_activas: reservasActivas,
        cupo_maximo: c.cupo_maximo,
      };
    });
  }, [rawClases]);

  const eventPropGetter = () => ({
    style: { background: "transparent", border: "none", padding: 0 },
  });

  return (
    <section className="space-y-6">
      <style>{`
        .trainer-agenda .rbc-time-gutter .rbc-timeslot-group,
        .trainer-agenda .rbc-time-header-gutter {
          min-width: 0;
          width: 44px;
          color: rgba(4,14,32,0.45);
          font-size: 11px;
        }
        .trainer-agenda .rbc-time-view,
        .trainer-agenda .rbc-month-view {
          border-radius: 16px;
          border-color: #e0e2e6;
          overflow: hidden;
          background: #ffffff;
        }
        .trainer-agenda .rbc-toolbar button {
          color: rgba(4,14,32,0.75);
          border-color: #e0e2e6;
        }
        .trainer-agenda .rbc-toolbar button.rbc-active,
        .trainer-agenda .rbc-toolbar button:hover {
          background: #e8f0fe;
          color: #1b61c9;
          border-color: #cfe0fb;
        }
        .trainer-agenda .rbc-today {
          background: #eef4fd;
        }
        .trainer-agenda .rbc-header {
          padding: 8px 4px;
          font-weight: 500;
          text-transform: capitalize;
          color: rgba(4,14,32,0.75);
          border-color: #eef0f3;
        }
        .trainer-agenda .rbc-time-content,
        .trainer-agenda .rbc-time-header-content,
        .trainer-agenda .rbc-day-slot .rbc-time-slot,
        .trainer-agenda .rbc-timeslot-group {
          border-color: #eef0f3;
        }
        .trainer-agenda .rbc-event {
          background: transparent;
          border: none !important;
          padding: 0 !important;
          outline: none !important;
          border-radius: 0;
        }
        .trainer-agenda .rbc-event.rbc-selected {
          background: transparent;
        }
      `}</style>

      <header>
        <h1 className="text-2xl font-medium tracking-tight">Mi agenda</h1>
        <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
          Vista semanal de tus clases programadas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Planificación semanal</CardTitle>
          <CardDescription>
            Cambia de semana con los controles del calendario
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agendaQuery.isError ? (
            <div className="rounded-2xl border border-[#f5c6c3] bg-[#fdecea] p-4 text-sm text-[#b3261e]">
              No se pudo cargar tu agenda.
            </div>
          ) : (
            <div className="trainer-agenda">
              <Calendar<TrainerEvento>
                localizer={localizer}
                culture="es"
                events={events}
                startAccessor="start"
                endAccessor="end"
                defaultView={Views.WORK_WEEK}
                view={view}
                onView={(v) => setView(v)}
                date={date}
                onNavigate={(d) => setDate(d)}
                onRangeChange={handleRangeChange}
                views={[Views.WORK_WEEK, Views.WEEK, Views.DAY]}
                components={{ event: CustomTrainerEvent }}
                messages={RBC_MESSAGES}
                formats={RBC_FORMATS}
                min={new Date(1970, 0, 1, 7, 0, 0)}
                max={new Date(1970, 0, 1, 22, 0, 0)}
                step={30}
                timeslots={2}
                style={{ height: 720 }}
                eventPropGetter={eventPropGetter}
                popup
                dayLayoutAlgorithm="no-overlap"
              />
            </div>
          )}

          {!agendaQuery.isError &&
            events.length === 0 &&
            !agendaQuery.isLoading && (
              <p className="mt-4 text-center text-xs text-[rgba(4,14,32,0.55)]">
                No tienes clases programadas de aquí en adelante.
              </p>
            )}
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * Evento visual dentro del calendario del entrenador.
 */
function CustomTrainerEvent({ event }: EventProps<TrainerEvento>) {
  const navigate = useNavigate();

  const horario = `${format(event.start, "HH:mm")} – ${format(event.end, "HH:mm")}`;
  const llena = event.reservas_activas >= event.cupo_maximo;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col justify-between gap-1 overflow-hidden",
        "rounded-md px-2 py-1.5 text-[11px] leading-tight text-white",
        llena ? "bg-[rgba(4,14,32,0.82)]" : "bg-[rgba(27,97,201,0.92)]",
      )}
    >
      <div className="space-y-0.5">
        <p className="font-medium">{horario}</p>
        <p className="truncate text-[12px] font-semibold">{event.actividad}</p>
        <p className="text-[11px] text-white/85">
          Asist: {event.reservas_activas}/{event.cupo_maximo}
          {llena && " · Lleno"}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/entrenador/clase/${event.id_clase}/asistencia`);
        }}
        className={cn(
          "mt-1 inline-flex h-6 items-center justify-center rounded-[6px]",
          "bg-white/15 px-2 text-[10px] font-semibold uppercase tracking-wider text-white",
          "backdrop-blur-sm transition-colors hover:bg-white/25",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        )}
      >
        Pasar Lista
      </button>
    </div>
  );
}
