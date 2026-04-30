import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useConfirm } from "../../components/ui/use-confirm";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";
import type {
  ClienteClase,
  CollectionResponse,
  MiReserva,
} from "../../types/cliente";

function parseClaseInicio(fecha: string, horaInicio: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = horaInicio.split(":").map(Number);
  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0, 0, 0).getTime();
}

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatHoraCorta(hora: string): string {
  return hora.slice(0, 5);
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Carga la oferta de clases visible para el cliente.
 */
async function fetchClases(): Promise<ClienteClase[]> {
  const { data } =
    await api.get<CollectionResponse<ClienteClase>>("/api/clases");
  return data.data;
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
 * Pantalla inicial del cliente.
 *
 * @remarks
 * Lee el usuario desde Zustand y mantiene estado derivado con `useMemo` para
 * próxima reserva, clases de hoy e ids ya reservados. Las peticiones se hacen con `GET` sobre
 * `/api/clases` y `/api/reservas/mis-reservas`. Las modificaciones se hacen con `POST` sobre
 * `/api/reservas` y `PATCH` sobre `/api/reservas/{id}/cancelar`.
 */
export default function ClientDashboard() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

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
  const isLoading = clasesQuery.isLoading || misReservasQuery.isLoading;
  const isError = clasesQuery.isError || misReservasQuery.isError;

  // Captura única de "ahora" por render
  const nowTs = new Date().getTime();

  // Set de IDs de clase donde el cliente ya tiene reserva Activa
  const idsClaseReservadas = useMemo(() => {
    const lista = rawReservas ?? [];
    return new Set(
      lista
        .filter((r) => r.estado === "Activa")
        .filter(
          (r) => parseClaseInicio(r.clase.fecha, r.clase.hora_inicio) >= nowTs,
        )
        .map((r) => r.clase.id_clase),
    );
  }, [rawReservas, nowTs]);

  // Reserva Activa más próxima en el tiempo (futura). Si no hay, devuelve null.
  const proximaReserva = useMemo<MiReserva | null>(() => {
    const lista = rawReservas ?? [];
    const futuras = lista
      .filter((r) => r.estado === "Activa")
      .filter(
        (r) => parseClaseInicio(r.clase.fecha, r.clase.hora_inicio) >= nowTs,
      )
      .sort(
        (a, b) =>
          parseClaseInicio(a.clase.fecha, a.clase.hora_inicio) -
          parseClaseInicio(b.clase.fecha, b.clase.hora_inicio),
      );
    return futuras[0] ?? null;
  }, [rawReservas, nowTs]);

  // Clases de hoy. Ordenadas por hora de inicio ascendente.
  const clasesHoy = useMemo(() => {
    const lista = rawClases ?? [];
    const hoy = todayIso();
    return lista
      .filter((c) => c.fecha === hoy)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [rawClases]);

  const reservarMutation = useMutation({
    mutationFn: async (idClase: number) => {
      const { data } = await api.post("/api/reservas", { id_clase: idClase });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", "clases"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "mis-reservas"] });
      toast.success("Reserva creada");
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo crear la reserva.";
      toast.error("No se pudo reservar", message);
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: async (idReserva: number) => {
      await api.patch(`/api/reservas/${idReserva}/cancelar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", "clases"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", "mis-reservas"] });
      toast.success("Reserva cancelada");
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo cancelar la reserva.";
      toast.error("No se pudo cancelar", message);
    },
  });

  const handleCancelarProxima = async () => {
    if (!proximaReserva) return;
    const ok = await confirm({
      title: "Cancelar reserva",
      description: `Vas a cancelar tu plaza en "${proximaReserva.clase.actividad}" del ${formatFechaCorta(proximaReserva.clase.fecha)} a las ${formatHoraCorta(proximaReserva.clase.hora_inicio)}. ¿Seguro?`,
      confirmLabel: "Sí, cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    cancelarMutation.mutate(proximaReserva.id_reserva);
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">
          Hola, {user?.nombre ?? "bienvenid@"}.
        </h1>
        <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
          Aquí tienes tu resumen para el día de hoy.
        </p>
      </header>

      {isError ? (
        <Card className="border-[#f5c6c3] bg-[#fdecea]">
          <CardContent className="pt-5">
            <p className="text-sm text-[#b3261e]">
              No se pudo cargar tu información. Revisa tu conexión e inténtalo
              de nuevo.
            </p>
            <button
              type="button"
              onClick={() => {
                clasesQuery.refetch();
                misReservasQuery.refetch();
              }}
              className="mt-3 rounded-lg border border-[#b3261e]/30 px-3 py-1.5 text-xs font-medium text-[#b3261e] hover:bg-[#b3261e]/10"
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[2fr_3fr]">
            <ProximaClaseCard
              reserva={proximaReserva}
              loading={isLoading}
              onCancelar={handleCancelarProxima}
              cancelando={cancelarMutation.isPending}
            />

            <Card>
              <CardHeader>
                <CardTitle>Calendario rápido (Hoy)</CardTitle>
                <CardDescription>
                  Clases programadas para hoy en el centro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ClasesHoyLista
                  clases={clasesHoy}
                  loading={isLoading}
                  idsReservadas={idsClaseReservadas}
                  nowTs={nowTs}
                  onReservar={(idClase) => reservarMutation.mutate(idClase)}
                  reservandoId={
                    reservarMutation.isPending
                      ? ((reservarMutation.variables as number | undefined) ??
                        null)
                      : null
                  }
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Link
              to="/cliente/calendario"
              className="text-sm font-medium text-[#1b61c9] hover:underline"
            >
              Ver calendario completo →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

type ProximaClaseCardProps = {
  reserva: MiReserva | null;
  loading: boolean;
  onCancelar: () => void;
  cancelando: boolean;
};

/**
 * Tarjeta resumen de la próxima reserva activa del cliente.
 */
function ProximaClaseCard({
  reserva,
  loading,
  onCancelar,
  cancelando,
}: ProximaClaseCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tu próxima clase</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[rgba(4,14,32,0.55)]">Cargando…</p>
        </CardContent>
      </Card>
    );
  }

  if (!reserva) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tu próxima clase</CardTitle>
          <CardDescription>
            No tienes ninguna reserva activa próxima.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/cliente/calendario"
            className="text-sm font-medium text-[#1b61c9] hover:underline"
          >
            Explorar el calendario →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const entrenador = reserva.clase.entrenador
    ? `${reserva.clase.entrenador.nombre} ${reserva.clase.entrenador.apellidos}`
    : "Entrenador por confirmar";

  return (
    <Card className="border-[#c9dcf5] bg-gradient-to-br from-white to-[#f3f7fd]">
      <CardHeader>
        <CardTitle className="text-[#1b61c9]">Tu próxima clase</CardTitle>
        <CardDescription>Reserva #{reserva.id_reserva}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight text-[#0d1220]">
            {reserva.clase.actividad}
          </p>
          <p className="text-sm text-[rgba(4,14,32,0.75)]">
            {formatFechaCorta(reserva.clase.fecha)} ·{" "}
            {formatHoraCorta(reserva.clase.hora_inicio)} –{" "}
            {formatHoraCorta(reserva.clase.hora_fin)}
          </p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <MetaItem label="Sala" value={reserva.clase.sala} />
          <MetaItem label="Entrenador" value={entrenador} />
        </dl>
        <div className="pt-2">
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
        </div>
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

type ClasesHoyListaProps = {
  clases: ClienteClase[];
  loading: boolean;
  idsReservadas: Set<number>;
  nowTs: number;
  onReservar: (idClase: number) => void;
  reservandoId: number | null;
};

/**
 * Lista rápida de clases programadas para el día actual.
 */
function ClasesHoyLista({
  clases,
  loading,
  idsReservadas,
  nowTs,
  onReservar,
  reservandoId,
}: ClasesHoyListaProps) {
  if (loading) {
    return (
      <p className="text-sm text-[rgba(4,14,32,0.55)]">
        Cargando clases de hoy…
      </p>
    );
  }

  if (clases.length === 0) {
    return (
      <div className="rounded-xl bg-[#fafbfc] p-6 text-center text-sm text-[rgba(4,14,32,0.55)]">
        No hay clases programadas para hoy.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#eef1f5]">
      {clases.map((clase) => {
        const yaReservada = idsReservadas.has(clase.id_clase);
        const yaEmpezada =
          parseClaseInicio(clase.fecha, clase.hora_inicio) < nowTs;
        const llena = clase.plazas_disponibles === 0;
        const reservandoEsta = reservandoId === clase.id_clase;

        return (
          <li
            key={clase.id_clase}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-[#0d1220]">
                {formatHoraCorta(clase.hora_inicio)} · {clase.actividad}
              </span>
              <span className="text-xs text-[rgba(4,14,32,0.55)]">
                {clase.sala.nombre} ·{" "}
                <PlazasTexto
                  libres={clase.plazas_disponibles}
                  total={clase.cupo_maximo}
                />
              </span>
            </div>
            <ClaseCta
              yaReservada={yaReservada}
              yaEmpezada={yaEmpezada}
              llena={llena}
              loading={reservandoEsta}
              onReservar={() => onReservar(clase.id_clase)}
            />
          </li>
        );
      })}
    </ul>
  );
}

function PlazasTexto({ libres, total }: { libres: number; total: number }) {
  if (libres === 0) {
    return <span className="text-[#b3261e]">0 plazas libres</span>;
  }
  return (
    <span>
      {libres} / {total} plazas libres
    </span>
  );
}

type ClaseCtaProps = {
  yaReservada: boolean;
  yaEmpezada: boolean;
  llena: boolean;
  loading: boolean;
  onReservar: () => void;
};

// CTA con los tres estados previstos en el wireframe
function ClaseCta({
  yaReservada,
  yaEmpezada,
  llena,
  loading,
  onReservar,
}: ClaseCtaProps) {
  if (yaReservada) {
    return (
      <span className="inline-flex h-9 items-center rounded-lg bg-[#e6f4ea] px-3 text-xs font-medium text-[#1e7e34]">
        Ya reservada
      </span>
    );
  }

  if (yaEmpezada) {
    return (
      <span className="inline-flex h-9 items-center rounded-lg bg-[#f1f5f9] px-3 text-xs font-medium text-[rgba(4,14,32,0.55)]">
        En curso / pasada
      </span>
    );
  }

  if (llena) {
    return (
      <span className="inline-flex h-9 items-center rounded-lg bg-[#fdecea] px-3 text-xs font-medium text-[#b3261e]">
        Lleno
      </span>
    );
  }

  return (
    <Button
      type="button"
      onClick={onReservar}
      disabled={loading}
      className="h-9 w-auto px-4 text-sm"
    >
      {loading ? "Reservando…" : "Reservar"}
    </Button>
  );
}
