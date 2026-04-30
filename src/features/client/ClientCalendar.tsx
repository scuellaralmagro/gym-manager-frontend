import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type EventProps,
  Views,
  type View,
} from "react-big-calendar";

import "react-big-calendar/lib/css/react-big-calendar.css";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { useConfirm } from "../../components/ui/use-confirm";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import type {
  ClienteClase,
  CollectionResponse,
  MiReserva,
} from "../../types/cliente";

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Mensajes en español para que la toolbar del calendario no aparezca en inglés
const RBC_MESSAGES = {
  today: "Hoy",
  previous: "<",
  next: ">",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Clase",
  noEventsInRange: "No hay clases en este rango.",
  showMore: (total: number) => `+${total} más`,
};

// Constante para el valor "Todos" de los selectores
const FILTER_ALL = "__ALL__";

/**
 * Evento adaptado al formato que consume React Big Calendar.
 */
type CalendarEvento = {
  id_clase: number;
  title: string;
  start: Date;
  end: Date;
  actividad: string;
  entrenador: string;
  sala: string;
  plazas_disponibles: number;
  cupo_maximo: number;
  yaReservada: boolean;
  idReserva: number | null;
  yaEmpezada: boolean;
};

/**
 * Parsea fecha y hora de Laravel a `Date` local.
 */
function parseClaseFecha(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0, 0, 0);
}

/**
 * Carga clases disponibles para el calendario del cliente.
 */
async function fetchClases(): Promise<ClienteClase[]> {
  const { data } =
    await api.get<CollectionResponse<ClienteClase>>("/api/clases");
  return data.data;
}

/**
 * Carga reservas del cliente para marcar eventos ya reservados.
 */
async function fetchMisReservas(): Promise<MiReserva[]> {
  const { data } = await api.get<CollectionResponse<MiReserva>>(
    "/api/reservas/mis-reservas",
  );
  return data.data;
}

/**
 * Calendario interactivo de clases del cliente.
 *
 * @remarks
 * Maneja filtros de actividad/entrenador, vista y fecha actual del calendario.
 * TanStack Query llama a `GET /api/clases` y `GET /api/reservas/mis-reservas`.
 */
export default function ClientCalendar() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [actividadFiltro, setActividadFiltro] = useState<string>(FILTER_ALL);
  const [entrenadorFiltro, setEntrenadorFiltro] = useState<string>(FILTER_ALL);
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState<Date>(() => new Date());

  const clasesQuery = useQuery({
    queryKey: ["cliente", "clases"] as const,
    queryFn: fetchClases,
    staleTime: 30_000,
  });

  const misReservasQuery = useQuery({
    queryKey: ["cliente", "mis-reservas"] as const,
    queryFn: fetchMisReservas,
    staleTime: 30_000,
  });

  const rawClases = clasesQuery.data;
  const rawReservas = misReservasQuery.data;

  // Mapa id_clase -> id_reserva para saber si la clase ya está reservada.
  // Solo considero reservas Activas del usuario.
  const reservaActivaPorClase = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of rawReservas ?? []) {
      if (r.estado === "Activa") {
        map.set(r.clase.id_clase, r.id_reserva);
      }
    }
    return map;
  }, [rawReservas]);

  const { actividadesUnicas, entrenadoresUnicos } = useMemo(() => {
    const lista = rawClases ?? [];
    const acts = new Set<string>();
    const ents = new Set<string>();
    for (const c of lista) {
      acts.add(c.actividad);
      if (c.entrenador) {
        ents.add(`${c.entrenador.nombre} ${c.entrenador.apellidos}`);
      }
    }
    return {
      actividadesUnicas: Array.from(acts).sort((a, b) => a.localeCompare(b)),
      entrenadoresUnicos: Array.from(ents).sort((a, b) => a.localeCompare(b)),
    };
  }, [rawClases]);

  const nowTs = new Date().getTime();

  // Transformación Clase -> CalendarEvento + aplicación de filtros
  const events = useMemo<CalendarEvento[]>(() => {
    const lista = rawClases ?? [];
    return lista
      .filter(
        (c) =>
          actividadFiltro === FILTER_ALL || c.actividad === actividadFiltro,
      )
      .filter((c) => {
        if (entrenadorFiltro === FILTER_ALL) return true;
        const name = c.entrenador
          ? `${c.entrenador.nombre} ${c.entrenador.apellidos}`
          : "";
        return name === entrenadorFiltro;
      })
      .map<CalendarEvento>((c) => {
        const start = parseClaseFecha(c.fecha, c.hora_inicio);
        const end = parseClaseFecha(c.fecha, c.hora_fin);
        const idReserva = reservaActivaPorClase.get(c.id_clase) ?? null;
        return {
          id_clase: c.id_clase,
          title: c.actividad,
          start,
          end,
          actividad: c.actividad,
          entrenador: c.entrenador
            ? `${c.entrenador.nombre} ${c.entrenador.apellidos}`
            : "—",
          sala: c.sala.nombre,
          plazas_disponibles: c.plazas_disponibles,
          cupo_maximo: c.cupo_maximo,
          yaReservada: idReserva !== null,
          idReserva,
          yaEmpezada: start.getTime() < nowTs,
        };
      });
  }, [
    rawClases,
    reservaActivaPorClase,
    actividadFiltro,
    entrenadorFiltro,
    nowTs,
  ]);

  // Reservar: en onMutate resto una plaza y añado una reserva "temporal" con id negativo para que la UI pinte el botón como "¡Apuntado!" antes de confirmar con el servidor. Si el POST falla se hace rollback.
  const reservarMutation = useMutation({
    mutationFn: async (idClase: number) => {
      const { data } = await api.post("/api/reservas", { id_clase: idClase });
      return data;
    },
    onMutate: async (idClase: number) => {
      await queryClient.cancelQueries({ queryKey: ["cliente", "clases"] });
      await queryClient.cancelQueries({
        queryKey: ["cliente", "mis-reservas"],
      });

      const prevClases = queryClient.getQueryData<ClienteClase[]>([
        "cliente",
        "clases",
      ]);
      const prevReservas = queryClient.getQueryData<MiReserva[]>([
        "cliente",
        "mis-reservas",
      ]);

      queryClient.setQueryData<ClienteClase[]>(
        ["cliente", "clases"],
        (old) =>
          old?.map((c) =>
            c.id_clase === idClase
              ? {
                  ...c,
                  plazas_disponibles: Math.max(0, c.plazas_disponibles - 1),
                }
              : c,
          ) ?? old,
      );

      const targetClase = prevClases?.find((c) => c.id_clase === idClase);
      if (targetClase) {
        const tempId = -new Date().getTime();
        queryClient.setQueryData<MiReserva[]>(
          ["cliente", "mis-reservas"],
          (old) => [
            {
              id_reserva: tempId,
              estado: "Activa" as const,
              fecha_creacion: null,
              clase: {
                id_clase: targetClase.id_clase,
                fecha: targetClase.fecha,
                hora_inicio: targetClase.hora_inicio,
                hora_fin: targetClase.hora_fin,
                actividad: targetClase.actividad,
                sala: targetClase.sala.nombre,
                entrenador: targetClase.entrenador ?? null,
              },
            },
            ...(old ?? []),
          ],
        );
      }

      return { prevClases, prevReservas };
    },
    onError: (error, _idClase, context) => {
      if (context?.prevClases) {
        queryClient.setQueryData(["cliente", "clases"], context.prevClases);
      }
      if (context?.prevReservas) {
        queryClient.setQueryData(
          ["cliente", "mis-reservas"],
          context.prevReservas,
        );
      }
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo completar la reserva.";
      toast.error("No se pudo reservar", message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", "clases"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "mis-reservas"] });
    },
  });

  // Cancelar: operación inversa a la anterior. Sumo una plaza y marco la reserva como
  // Cancelada en la caché. Se hace rollback en caso de error.
  const cancelarMutation = useMutation({
    mutationFn: async (idReserva: number) => {
      await api.patch(`/api/reservas/${idReserva}/cancelar`);
    },
    onMutate: async (idReserva: number) => {
      await queryClient.cancelQueries({ queryKey: ["cliente", "clases"] });
      await queryClient.cancelQueries({
        queryKey: ["cliente", "mis-reservas"],
      });

      const prevClases = queryClient.getQueryData<ClienteClase[]>([
        "cliente",
        "clases",
      ]);
      const prevReservas = queryClient.getQueryData<MiReserva[]>([
        "cliente",
        "mis-reservas",
      ]);

      const reservaAfectada = prevReservas?.find(
        (r) => r.id_reserva === idReserva,
      );

      if (reservaAfectada) {
        queryClient.setQueryData<ClienteClase[]>(
          ["cliente", "clases"],
          (old) =>
            old?.map((c) =>
              c.id_clase === reservaAfectada.clase.id_clase
                ? {
                    ...c,
                    plazas_disponibles: Math.min(
                      c.cupo_maximo,
                      c.plazas_disponibles + 1,
                    ),
                  }
                : c,
            ) ?? old,
        );
      }

      queryClient.setQueryData<MiReserva[]>(
        ["cliente", "mis-reservas"],
        (old) =>
          old?.map((r) =>
            r.id_reserva === idReserva
              ? { ...r, estado: "Cancelada" as const }
              : r,
          ) ?? old,
      );

      return { prevClases, prevReservas };
    },
    onError: (error, _idReserva, context) => {
      if (context?.prevClases) {
        queryClient.setQueryData(["cliente", "clases"], context.prevClases);
      }
      if (context?.prevReservas) {
        queryClient.setQueryData(
          ["cliente", "mis-reservas"],
          context.prevReservas,
        );
      }
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo cancelar la reserva.";
      toast.error("No se pudo cancelar", message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", "clases"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "mis-reservas"] });
    },
  });

  // Handler que reciben los eventos del calendario
  const handleReservar = useCallback(
    (event: CalendarEvento) => {
      reservarMutation.mutate(event.id_clase);
    },
    [reservarMutation],
  );

  const handleCancelar = useCallback(
    async (event: CalendarEvento) => {
      if (!event.idReserva) return;
      const ok = await confirm({
        title: "Cancelar reserva",
        description: `Vas a cancelar tu plaza en "${event.actividad}" del ${format(event.start, "dd/MM")} a las ${format(event.start, "HH:mm")}. ¿Seguro?`,
        confirmLabel: "Sí, cancelar",
        variant: "destructive",
      });
      if (!ok) return;
      cancelarMutation.mutate(event.idReserva);
    },
    [cancelarMutation, confirm],
  );

  // Colorea el fondo del evento según su estado
  const eventPropGetter = useCallback((event: CalendarEvento) => {
    let bg = "#1b61c9"; // disponible (azul primario)
    if (event.yaReservada)
      bg = "#1e7e34"; // verde
    else if (event.plazas_disponibles === 0)
      bg = "#b3261e"; // rojo
    else if (event.yaEmpezada) bg = "#94a3b8"; // gris
    return {
      style: {
        backgroundColor: bg,
        border: "none",
        borderRadius: 8,
        padding: 0,
      },
    };
  }, []);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">
          Calendario de clases
        </h1>
        <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
          Consulta la oferta disponible y reserva tu plaza directamente desde
          cada clase.
        </p>
      </header>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="calendario-actividad">Actividad</Label>
              <select
                id="calendario-actividad"
                value={actividadFiltro}
                onChange={(e) => setActividadFiltro(e.target.value)}
                className={cn(
                  "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
                  "px-3 text-base tracking-[0.08px] text-[#181d26]",
                  "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
                )}
              >
                <option value={FILTER_ALL}>Todas las actividades</option>
                {actividadesUnicas.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendario-entrenador">Entrenador</Label>
              <select
                id="calendario-entrenador"
                value={entrenadorFiltro}
                onChange={(e) => setEntrenadorFiltro(e.target.value)}
                className={cn(
                  "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
                  "px-3 text-base tracking-[0.08px] text-[#181d26]",
                  "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
                )}
              >
                <option value={FILTER_ALL}>Todos los entrenadores</option>
                {entrenadoresUnicos.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendario */}
      <Card>
        <CardHeader>
          <CardTitle>Vista semanal</CardTitle>
          <CardDescription>
            Haz clic sobre una clase para reservar o cancelar. Las plazas se
            actualizan al instante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Leyenda />
          <div className="mt-4 h-[720px]">
            <Calendar<CalendarEvento>
              localizer={localizer}
              events={events}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              messages={RBC_MESSAGES}
              culture="es"
              step={30}
              timeslots={2}
              min={new Date(1970, 0, 1, 7, 0, 0)}
              max={new Date(1970, 0, 1, 23, 0, 0)}
              eventPropGetter={eventPropGetter}
              components={{
                event: (props: EventProps<CalendarEvento>) => (
                  <EventCard
                    {...props}
                    onReservar={handleReservar}
                    onCancelar={handleCancelar}
                    reservandoId={
                      reservarMutation.isPending
                        ? ((reservarMutation.variables as number | undefined) ??
                          null)
                        : null
                    }
                    cancelandoId={
                      cancelarMutation.isPending
                        ? ((cancelarMutation.variables as number | undefined) ??
                          null)
                        : null
                    }
                  />
                ),
              }}
              style={{ height: "100%" }}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * Tarjeta personalizada dentro de cada evento del calendario.
 *
 * @remarks
 * Muestra actividad, ratio de plazas y el botón contextual de reservar o
 * cancelar.
 * 
 * TODO: En eventos muy cortos, la tarjeta puede recortar contenido. Hay que arreglar.
 */
function EventCard({
  event,
  onReservar,
  onCancelar,
  reservandoId,
  cancelandoId,
}: EventProps<CalendarEvento> & {
  onReservar: (event: CalendarEvento) => void;
  onCancelar: (event: CalendarEvento) => void;
  reservandoId: number | null;
  cancelandoId: number | null;
}) {
  const reservando = reservandoId === event.id_clase;
  const cancelando =
    event.idReserva !== null && cancelandoId === event.idReserva;

  return (
    <div className="flex h-full flex-col justify-between gap-1 px-1.5 py-1 text-white">
      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold">
          {event.actividad}
        </div>
        <div className="truncate text-[10px] opacity-90">
          {event.plazas_disponibles}/{event.cupo_maximo} · {event.sala}
        </div>
      </div>
      <EventCta
        event={event}
        reservando={reservando}
        cancelando={cancelando}
        onReservar={() => onReservar(event)}
        onCancelar={() => onCancelar(event)}
      />
    </div>
  );
}

function EventCta({
  event,
  reservando,
  cancelando,
  onReservar,
  onCancelar,
}: {
  event: CalendarEvento;
  reservando: boolean;
  cancelando: boolean;
  onReservar: () => void;
  onCancelar: () => void;
}) {
  // La clase ya ha empezado: desactivo cualquier acción
  if (event.yaEmpezada && !event.yaReservada) {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-white/25 px-2 py-0.5 text-[10px] font-medium">
        Pasada
      </span>
    );
  }

  if (event.yaReservada) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCancelar();
        }}
        disabled={cancelando}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-2 py-0.5",
          "bg-white/25 text-[10px] font-semibold hover:bg-white/40",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {cancelando ? "Cancelando…" : "¡Apuntado!"}
      </button>
    );
  }

  if (event.plazas_disponibles === 0) {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-white/25 px-2 py-0.5 text-[10px] font-medium">
        Lleno
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onReservar();
      }}
      disabled={reservando}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-0.5",
        "bg-white text-[10px] font-semibold text-[#1b61c9] hover:bg-white/90",
        "disabled:pointer-events-none disabled:opacity-60",
      )}
    >
      {reservando ? "Reservando…" : "Reservar"}
    </button>
  );
}

function Leyenda() {
  const items: Array<{ color: string; label: string }> = [
    { color: "#1b61c9", label: "Disponible" },
    { color: "#1e7e34", label: "Ya reservada" },
    { color: "#b3261e", label: "Completa" },
    { color: "#94a3b8", label: "Pasada" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-[rgba(4,14,32,0.69)]">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
