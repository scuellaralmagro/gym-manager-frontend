import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import api from "../../lib/axios";
import type { DashboardSummaryResponse } from "../../types/dashboard";

/**
 * Carga el resumen semanal del dashboard de administración.
 *
 * @returns KPIs, rango de fechas y ocupación semanal recibidos desde Axios.
 */
async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await api.get<DashboardSummaryResponse>(
    "/api/admin/dashboard-summary",
  );
  return data;
}

/**
 * Pantalla inicial del administrador.
 *
 * @remarks
 * Usa TanStack Query (libreria para peticiones a la API) con la clave `["admin", "dashboard-summary"]` para hacer la petición
 * `/api/admin/dashboard-summary`. Maneja los estados `data`, `isLoading`,
 * `isError` y `refetch` para pintar KPIs, gráfico de ocupación o error.
 */
export default function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "dashboard-summary"] as const,
    queryFn: fetchDashboardSummary,
    // Se actualiza cada 30 segundos para mantener los datos frescos
    staleTime: 30_000,
  });

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
          Resumen semanal del centro
          {data?.rango
            ? ` · ${formatRango(data.rango.desde, data.rango.hasta)}`
            : null}
          .
        </p>
      </header>

      {isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : (
        <>
          <KpiCards data={data?.kpis} loading={isLoading} />

          <Card>
            <CardHeader>
              <CardTitle>Ocupación por Actividad (Esta Semana)</CardTitle>
              <CardDescription>
                Porcentaje medio de plazas ocupadas en cada disciplina
                programada esta semana.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OcupacionChart
                data={data?.ocupacion_semanal ?? []}
                loading={isLoading}
              />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/clases" aria-label="Programar nueva clase">
              <Button type="button" className="w-full">
                + Nueva Clase
              </Button>
            </Link>
            <Link to="/admin/usuarios" aria-label="Crear nuevo usuario">
              <Button type="button" className="w-full">
                + Nuevo Usuario
              </Button>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

type KpiCardsProps = {
  data: DashboardSummaryResponse["kpis"] | undefined;
  loading: boolean;
};

/**
 * Muestra las tarjetas de indicadores principales del dashboard.
 *
 * @param data - KPIs devueltos por la API.
 * @param loading - Indica si la query sigue cargando.
 */
function KpiCards({ data, loading }: KpiCardsProps) {
  const reservasActivas = loading ? "—" : String(data?.reservas_activas ?? 0);
  const llenadoMedio = loading ? "—" : `${data?.llenado_medio ?? 0}%`;
  const nuevosUsuarios = loading ? "—" : String(data?.nuevos_usuarios ?? 0);

  return (
    <div className="grid grid-cols-3 gap-4">
      <KpiCard
        title="Reservas Activas"
        value={reservasActivas}
        description="Reservas vivas para clases de hoy en adelante"
      />
      <KpiCard
        title="% Llenado Medio"
        value={llenadoMedio}
        description="Ocupación ponderada de la semana en curso"
      />
      <KpiCard
        title="Nuevos Usuarios"
        value={nuevosUsuarios}
        description="Altas registradas esta semana"
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold tracking-tight text-[#0d1220]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

type OcupacionChartProps = {
  data: DashboardSummaryResponse["ocupacion_semanal"];
  loading: boolean;
};

/**
 * Dibuja el gráfico de ocupación semanal por actividad.
 *
 * @param data - Lista de ocupación por actividad.
 * @param loading - Estado de carga de la query principal.
 */
function OcupacionChart({ data, loading }: OcupacionChartProps) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[rgba(4,14,32,0.55)]">
        Cargando gráfico…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-[#fafbfc] text-sm text-[rgba(4,14,32,0.55)]">
        No hay actividades programadas esta semana.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
        >
          <CartesianGrid stroke="#eef1f5" vertical={false} />
          <XAxis
            dataKey="actividad"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "#e0e2e6" }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            unit="%"
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e0e2e6",
              fontSize: 12,
              padding: "8px 10px",
              boxShadow: "rgba(15, 48, 106, 0.12) 0px 6px 18px",
            }}
            formatter={(value, _name, entry) => {
              const payload = (entry?.payload ?? {}) as {
                reservas?: number;
                cupo?: number;
              };
              const reservas = payload.reservas ?? 0;
              const cupo = payload.cupo ?? 0;
              return [`${value}% (${reservas}/${cupo})`, "Ocupación"];
            }}
          />
          <Bar dataKey="ocupacion" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Estado de error

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-[#f5c6c3] bg-[#fdecea]">
      <CardContent className="pt-5">
        <p className="text-sm text-[#b3261e]">
          No se pudo cargar el resumen del dashboard.
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

// Utilidades

function formatRango(desde: string, hasta: string): string {
  const desdeFmt = formatCorto(desde);
  const hastaFmt = formatCorto(hasta);
  return `${desdeFmt} – ${hastaFmt}`;
}

function formatCorto(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}
