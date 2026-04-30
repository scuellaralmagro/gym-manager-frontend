import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useMemo } from "react";

import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { useConfirm } from "../../components/ui/use-confirm";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import type { CollectionResponse, MiReserva } from "../../types/cliente";

/**
 * Tiempo mínimo antes del inicio de la clase para permitir cancelar la reserva.
 */
const VENTANA_CANCELACION_MS = 2 * 60 * 60 * 1000; // 2 horas

function parseClaseInicio(fecha: string, hora: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0, 0, 0).getTime();
}

function toDate(fecha: string, hora: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0, 0, 0);
}

/**
 * Carga las reservas del cliente autenticado.
 */
async function fetchMisReservas(): Promise<MiReserva[]> {
  const { data } = await api.get<CollectionResponse<MiReserva>>(
    "/api/reservas/mis-reservas",
  );
  return data.data;
}

/**
 * Pantalla de reservas del cliente.
 *
 * @remarks
 * Divide las reservas en próximas e historial con estado derivado por `useMemo`.
 * TanStack Query llama a `GET /api/reservas/mis-reservas`; la cancelación usa `PATCH /api/reservas/{id}/cancelar`.
 */
export default function MyReservations() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const reservasQuery = useQuery({
    queryKey: ["cliente", "mis-reservas"] as const,
    queryFn: fetchMisReservas,
    staleTime: 30_000,
  });

  const rawReservas = reservasQuery.data;
  const nowTs = new Date().getTime();

  // Separo las reservas en "Próximas" y "Historial"
  //  - Próximas: Activa + clase en el futuro (start >= now)
  //  - Historial: todo lo demás (canceladas o clases ya pasadas)
  const { proximas, historial } = useMemo(() => {
    const lista = rawReservas ?? [];
    const prox: MiReserva[] = [];
    const hist: MiReserva[] = [];

    for (const r of lista) {
      const startTs = parseClaseInicio(r.clase.fecha, r.clase.hora_inicio);
      const esFutura = startTs >= nowTs;
      if (r.estado === "Activa" && esFutura) {
        prox.push(r);
      } else {
        hist.push(r);
      }
    }

    prox.sort(
      (a, b) =>
        parseClaseInicio(a.clase.fecha, a.clase.hora_inicio) -
        parseClaseInicio(b.clase.fecha, b.clase.hora_inicio),
    );
    // Historial con las más recientes arriba
    hist.sort(
      (a, b) =>
        parseClaseInicio(b.clase.fecha, b.clase.hora_inicio) -
        parseClaseInicio(a.clase.fecha, a.clase.hora_inicio),
    );

    return { proximas: prox, historial: hist };
  }, [rawReservas, nowTs]);

  // Cancelar reserva
  const cancelarMutation = useMutation({
    mutationFn: async (idReserva: number) => {
      await api.patch(`/api/reservas/${idReserva}/cancelar`);
    },
    onMutate: async (idReserva: number) => {
      await queryClient.cancelQueries({
        queryKey: ["cliente", "mis-reservas"],
      });
      await queryClient.cancelQueries({ queryKey: ["cliente", "clases"] });

      const prevReservas = queryClient.getQueryData<MiReserva[]>([
        "cliente",
        "mis-reservas",
      ]);

      queryClient.setQueryData<MiReserva[]>(
        ["cliente", "mis-reservas"],
        (old) =>
          old?.map((r) =>
            r.id_reserva === idReserva
              ? { ...r, estado: "Cancelada" as const }
              : r,
          ) ?? old,
      );

      return { prevReservas };
    },
    onError: (error, _idReserva, context) => {
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
    onSuccess: () => {
      toast.success("Reserva cancelada");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", "mis-reservas"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "clases"] });
    },
  });

  const handleCancelar = async (reserva: MiReserva) => {
    const ok = await confirm({
      title: "Cancelar reserva",
      description: `Vas a cancelar tu plaza en "${reserva.clase.actividad}" del ${format(toDate(reserva.clase.fecha, reserva.clase.hora_inicio), "dd/MM")} a las ${reserva.clase.hora_inicio.slice(0, 5)}. ¿Seguro?`,
      confirmLabel: "Sí, cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    cancelarMutation.mutate(reserva.id_reserva);
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Mis reservas</h1>
        <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
          Consulta tus próximas clases y tu historial.
        </p>
      </header>

      {reservasQuery.isError ? (
        <ErrorBlock onRetry={() => reservasQuery.refetch()} />
      ) : (
        <Tabs defaultValue="proximas">
          <TabsList>
            <TabsTrigger value="proximas">
              Próximas Clases ({proximas.length})
            </TabsTrigger>
            <TabsTrigger value="historial">
              Historial ({historial.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proximas">
            <ReservasLista
              reservas={proximas}
              loading={reservasQuery.isLoading}
              emptyText="No tienes reservas próximas. Échale un vistazo al calendario y apúntate a una clase."
              renderCard={(r) => (
                <ReservaCard
                  key={r.id_reserva}
                  reserva={r}
                  nowTs={nowTs}
                  cancelando={
                    cancelarMutation.isPending &&
                    (cancelarMutation.variables as number | undefined) ===
                      r.id_reserva
                  }
                  onCancelar={() => handleCancelar(r)}
                />
              )}
            />
          </TabsContent>

          <TabsContent value="historial">
            <ReservasLista
              reservas={historial}
              loading={reservasQuery.isLoading}
              emptyText="Todavía no hay reservas en tu historial."
              renderCard={(r) => (
                <ReservaCard
                  key={r.id_reserva}
                  reserva={r}
                  nowTs={nowTs}
                  historial
                />
              )}
            />
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}

type ReservasListaProps = {
  reservas: MiReserva[];
  loading: boolean;
  emptyText: string;
  renderCard: (r: MiReserva) => React.ReactNode;
};

/**
 * Lista reutilizable para pestañas de próximas reservas e historial.
 */
function ReservasLista({
  reservas,
  loading,
  emptyText,
  renderCard,
}: ReservasListaProps) {
  if (loading) {
    return (
      <p className="text-sm text-[rgba(4,14,32,0.55)]">Cargando reservas…</p>
    );
  }
  if (reservas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e0e2e6] bg-[#fafbfc] p-10 text-center text-sm text-[rgba(4,14,32,0.55)]">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {reservas.map((r) => renderCard(r))}
    </div>
  );
}

type ReservaCardProps = {
  reserva: MiReserva;
  nowTs: number;
  cancelando?: boolean;
  onCancelar?: () => void;
  historial?: boolean;
};

/**
 * Tarjeta individual de reserva con estado, horario y acción de cancelación.
 */
function ReservaCard({
  reserva,
  nowTs,
  cancelando = false,
  onCancelar,
  historial = false,
}: ReservaCardProps) {
  const startDate = toDate(reserva.clase.fecha, reserva.clase.hora_inicio);
  const startTs = startDate.getTime();
  const msRestantes = startTs - nowTs;

  const fechaLarga = format(startDate, "EEEE, dd MMM", { locale: es });
  const horario = `${reserva.clase.hora_inicio.slice(0, 5)} – ${reserva.clase.hora_fin.slice(0, 5)}`;
  const entrenador = reserva.clase.entrenador
    ? `${reserva.clase.entrenador.nombre} ${reserva.clase.entrenador.apellidos}`
    : "—";

  // Solo muestro el botón de cancelar cuando la clase no ha ocurrido todavía y la reserva sigue Activa
  const esFutura = startTs >= nowTs;
  const fueraDePlazo = msRestantes < VENTANA_CANCELACION_MS;
  const puedeCancelar =
    !historial && esFutura && reserva.estado === "Activa" && !fueraDePlazo;
  const mostrarLimite =
    !historial && esFutura && reserva.estado === "Activa" && fueraDePlazo;

  return (
    <Card
      className={cn(
        reserva.estado === "Cancelada" && "opacity-75",
        historial && "bg-[#fafbfc]",
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="normal-case tracking-normal text-[rgba(4,14,32,0.55)]">
              {capitalizeFirst(fechaLarga)}
            </CardTitle>
            <CardDescription className="mt-0.5 text-sm text-[#0d1220]">
              {horario}
            </CardDescription>
          </div>
          <Badge variant={reserva.estado === "Activa" ? "activa" : "cancelada"}>
            {reserva.estado}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-lg font-semibold tracking-tight text-[#0d1220]">
          {reserva.clase.actividad}
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <MetaItem label="Sala" value={reserva.clase.sala} />
          <MetaItem label="Entrenador" value={entrenador} />
        </dl>

        {puedeCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={cancelando}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-[12px]",
              "border border-[#b3261e]/30 bg-white px-4 text-sm font-medium text-[#b3261e]",
              "transition-colors hover:bg-[#fdecea]",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {cancelando ? "Cancelando…" : "Cancelar reserva"}
          </button>
        )}

        {mostrarLimite && (
          <div
            role="note"
            className="rounded-lg bg-[#fef4e6] px-3 py-2 text-xs text-[#8a5a00]"
            aria-live="polite"
          >
            ⏰ Fuera de plazo para cancelar (menos de 2 h para el inicio).
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-[rgba(4,14,32,0.55)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[#0d1220]">{value}</dd>
    </div>
  );
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-[#f5c6c3] bg-[#fdecea]">
      <CardContent className="pt-5">
        <p className="text-sm text-[#b3261e]">
          No se pudieron cargar tus reservas.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-[#b3261e]/30 px-3 py-1.5 text-xs font-medium text-[#b3261e] hover:bg-[#b3261e]/10"
        >
          Reintentar
        </button>
      </CardContent>
    </Card>
  );
}
