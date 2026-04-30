import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import type {
  AsistenciaResumen,
  InformeResponse,
  ReservaPorDiaSemana,
  TopActividad,
} from "../../types/informe";

const ASISTENCIA_COLORS = {
  asistidas: "#0f5132",
  proximas: "#1b61c9",
  canceladas: "#b3261e",
} as const;

const BAR_COLOR = "#1b61c9";

type DateRange = {
  fechaDesde: string;
  fechaHasta: string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function defaultRange(): DateRange {
  const today = new Date();
  return {
    fechaDesde: toIso(startOfMonth(today)),
    fechaHasta: toIso(today),
  };
}

/**
 * Carga el informe de métricas para el rango indicado.
 *
 * @param range - Fechas `fechaDesde` y `fechaHasta` usadas como filtros.
 * @returns KPIs, desglose y series para gráficas.
 */
async function fetchInforme(range: DateRange): Promise<InformeResponse> {
  const { data } = await api.get<InformeResponse>("/api/admin/informes", {
    params: {
      fecha_desde: range.fechaDesde || undefined,
      fecha_hasta: range.fechaHasta || undefined,
    },
  });
  return data;
}

/**
 * Pantalla de informes y métricas del administrador.
 *
 * @remarks
 * Mantiene `range` como estado principal y valida que la fecha desde no supere
 * la fecha hasta. Usa TanStack Query con `GET /api/admin/informes` para pintar
 * KPIs, barras de reservas, donut de asistencia y ranking de actividades.
 */
export default function MetricsDashboard() {
  const [range, setRange] = useState<DateRange>(defaultRange);

  const queryKey = ["admin", "informes", range] as const;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchInforme(range),
  });

  const rangeInvalido =
    Boolean(range.fechaDesde) &&
    Boolean(range.fechaHasta) &&
    range.fechaDesde > range.fechaHasta;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            Informes y Métricas
          </h1>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            KPIs del centro calculados en tiempo real para el periodo
            seleccionado.
          </p>
        </div>
        <DateRangeFilter
          range={range}
          onChange={setRange}
          invalid={rangeInvalido}
        />
      </header>

      {rangeInvalido ? (
        <StateCard tone="error">
          La fecha «desde» no puede ser posterior a la fecha «hasta». Ajusta el
          rango.
        </StateCard>
      ) : isLoading ? (
        <StateCard>Cargando métricas…</StateCard>
      ) : isError || !data ? (
        <StateCard tone="error">
          <div className="flex flex-col items-center gap-3">
            <span>No se pudo cargar el informe.</span>
            <Button
              type="button"
              onClick={() => refetch()}
              className="h-9 w-auto px-4"
            >
              Reintentar
            </Button>
          </div>
        </StateCard>
      ) : (
        <>
          {isFetching && (
            <p className="text-xs text-[rgba(4,14,32,0.55)]">
              Actualizando datos…
            </p>
          )}

          <KpiGrid data={data} />

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ChartCard
                title="Evolución de reservas por día"
                subtitle="Reservas activas por día de la semana en el periodo seleccionado"
              >
                <ReservasBarChart data={data.reservas_por_dia_semana} />
              </ChartCard>
            </div>
            <div className="lg:col-span-2">
              <ChartCard
                title="Asistencia"
                subtitle="Distribución de reservas según su estado"
              >
                <AsistenciaDonut data={data.asistencia} />
              </ChartCard>
            </div>
          </div>

          <TopActividadesTable data={data.top_actividades} />
        </>
      )}
    </section>
  );
}

type DateRangeFilterProps = {
  range: DateRange;
  onChange: (range: DateRange) => void;
  invalid: boolean;
};

/**
 * Selector de fechas y presets rápidos para filtrar informes.
 */
function DateRangeFilter({ range, onChange, invalid }: DateRangeFilterProps) {
  const presets = useMemo(() => buildPresets(), []);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#e0e2e6] bg-white p-3 sm:min-w-[320px]">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="informe-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="informe-desde"
            type="date"
            value={range.fechaDesde}
            aria-invalid={invalid ? "true" : "false"}
            onChange={(event) =>
              onChange({ ...range, fechaDesde: event.target.value })
            }
            className="h-10"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="informe-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="informe-hasta"
            type="date"
            value={range.fechaHasta}
            aria-invalid={invalid ? "true" : "false"}
            onChange={(event) =>
              onChange({ ...range, fechaHasta: event.target.value })
            }
            className="h-10"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.range)}
            className={cn(
              "rounded-full border border-[#e0e2e6] px-3 py-1 text-xs font-medium",
              "transition-colors hover:border-[#1b61c9] hover:text-[#1b61c9]",
              "text-[rgba(4,14,32,0.69)]",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type PresetDef = { label: string; range: DateRange };

function buildPresets(): PresetDef[] {
  const today = new Date();
  const startMonth = startOfMonth(today);
  const startPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  return [
    {
      label: "Últimos 7 días",
      range: {
        fechaDesde: toIso(addDays(today, -6)),
        fechaHasta: toIso(today),
      },
    },
    {
      label: "Últimos 30 días",
      range: {
        fechaDesde: toIso(addDays(today, -29)),
        fechaHasta: toIso(today),
      },
    },
    {
      label: "Este mes",
      range: { fechaDesde: toIso(startMonth), fechaHasta: toIso(today) },
    },
    {
      label: "Mes anterior",
      range: {
        fechaDesde: toIso(startPrevMonth),
        fechaHasta: toIso(endPrevMonth),
      },
    },
    {
      label: "Últimos 90 días",
      range: {
        fechaDesde: toIso(addDays(today, -89)),
        fechaHasta: toIso(today),
      },
    },
  ];
}

/**
 * Rejilla de KPIs calculados por el backend.
 */
function KpiGrid({ data }: { data: InformeResponse }) {
  const { kpis, desglose } = data;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Tasa de ocupación"
        value={`${kpis.tasa_ocupacion_promedio}%`}
        footer={`${desglose.reservas_activas}/${desglose.cupo_total} plazas`}
      />
      <KpiCard
        title="Clientes únicos"
        value={String(kpis.clientes_unicos)}
        footer="Con al menos una reserva activa"
      />
      <KpiCard
        title="Media por clase"
        value={String(kpis.media_reservas_por_clase)}
        footer={`Sobre ${desglose.total_clases} clases`}
      />
      <KpiCard
        title="Cancelaciones"
        value={`${kpis.indice_cancelaciones}%`}
        footer={`${desglose.reservas_canceladas} canceladas`}
      />
      <KpiCard
        title="Actividad más popular"
        value={kpis.actividad_mas_popular?.nombre ?? "—"}
        footer={
          kpis.actividad_mas_popular
            ? `${kpis.actividad_mas_popular.reservas} reservas`
            : "Sin datos"
        }
      />
      <KpiCard
        title="Hora punta"
        value={kpis.hora_punta?.hora_inicio?.slice(0, 5) ?? "—"}
        footer={
          kpis.hora_punta
            ? `${kpis.hora_punta.reservas} reservas en esa franja`
            : "Sin datos"
        }
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  footer,
}: {
  title: string;
  value: string;
  footer?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e0e2e6] bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-[rgba(4,14,32,0.55)]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#0d1220]">
        {value}
      </p>
      {footer && (
        <p className="mt-1 text-xs text-[rgba(4,14,32,0.55)]">{footer}</p>
      )}
    </div>
  );
}

/**
 * Gráfico de barras con reservas activas agrupadas por día de la semana.
 */
function ReservasBarChart({ data }: { data: ReservaPorDiaSemana[] }) {
  const total = data.reduce((acc, item) => acc + item.total, 0);

  if (total === 0) {
    return (
      <EmptyChart message="Sin reservas activas en el periodo seleccionado." />
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
            dataKey="label"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "#e0e2e6" }}
          />
          <YAxis
            allowDecimals={false}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(27, 97, 201, 0.08)" }}
            contentStyle={tooltipStyle}
            formatter={(value) => [`${value} reservas`, "Activas"]}
            labelFormatter={(label) => `Día ${expandDayLabel(String(label))}`}
          />
          <Bar
            dataKey="total"
            fill={BAR_COLOR}
            radius={[6, 6, 0, 0]}
            name="Reservas"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function expandDayLabel(label: string): string {
  const map: Record<string, string> = {
    L: "Lunes",
    M: "Martes",
    X: "Miércoles",
    J: "Jueves",
    V: "Viernes",
    S: "Sábado",
    D: "Domingo",
  };
  return map[label] ?? label;
}

/**
 * Gráfico circular de asistencia.
 *
 * @remarks
 * La asistencia real queda preparada visualmente (distinguiendo entre reservas activas y canceladas, pero no asistidas),
 * pero la funcionalidad de pasar lista todavía se muestra como funcionalidad pendiente en la interfaz ya que no está implementada.
 */
function AsistenciaDonut({ data }: { data: AsistenciaResumen }) {
  const chartData = [
    { key: "asistidas", name: "Asistidas", value: data.asistidas },
    { key: "proximas", name: "Próximas", value: data.proximas },
    { key: "canceladas", name: "Canceladas", value: data.canceladas },
  ] as const;

  const total = chartData.reduce((acc, item) => acc + item.value, 0);

  if (total === 0) {
    return <EmptyChart message="Sin reservas en el periodo seleccionado." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [`${value} reservas`, String(name)]}
            />
            <Pie
              data={chartData as unknown as Array<Record<string, unknown>>}
              dataKey="value"
              nameKey="name"
              innerRadius="60%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    ASISTENCIA_COLORS[
                      entry.key as keyof typeof ASISTENCIA_COLORS
                    ]
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-semibold tracking-tight text-[#0d1220]">
            {data.porcentaje_asistencia}%
          </span>
          <span className="mt-0.5 text-xs uppercase tracking-wider text-[rgba(4,14,32,0.55)]">
            Asisten
          </span>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[rgba(4,14,32,0.69)]">
        {chartData.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  ASISTENCIA_COLORS[
                    entry.key as keyof typeof ASISTENCIA_COLORS
                  ],
              }}
            />
            {entry.name}: <span className="font-medium">{entry.value}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-snug text-[rgba(4,14,32,0.45)]">
        El porcentaje se calcula sobre reservas ya decididas (asistidas +
        canceladas) y excluye las próximas. TBD: Implementar funcionalidad de
        pasar lista de alumnos para hacer seguimiento de asistencia
      </p>
    </div>
  );
}

/**
 * Tabla con el ranking de actividades más demandadas.
 */
function TopActividadesTable({ data }: { data: TopActividad[] }) {
  const maxReservas = data[0]?.reservas ?? 0;

  return (
    <section className="rounded-2xl border border-[#e0e2e6] bg-white">
      <header className="border-b border-[#e0e2e6] px-5 py-4">
        <h2 className="text-base font-medium tracking-tight">
          Top actividades más demandadas
        </h2>
        <p className="mt-0.5 text-xs text-[rgba(4,14,32,0.55)]">
          Ranking por volumen de reservas activas.
        </p>
      </header>
      {data.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[rgba(4,14,32,0.69)]">
          Sin reservas activas en el periodo seleccionado.
        </p>
      ) : (
        <ol className="divide-y divide-[#eef1f5]">
          {data.map((actividad, index) => {
            const ratio =
              maxReservas > 0 ? (actividad.reservas / maxReservas) * 100 : 0;
            return (
              <li
                key={actividad.nombre}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f5f9] text-sm font-semibold text-[rgba(4,14,32,0.75)]">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-[#0d1220]">
                    {actividad.nombre}
                  </span>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]"
                    aria-hidden
                  >
                    <div
                      className="h-full rounded-full bg-[#1b61c9]"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums text-[rgba(4,14,32,0.87)]">
                  {actividad.reservas}{" "}
                  <span className="text-xs text-[rgba(4,14,32,0.55)]">
                    reservas
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// Auxiliares

function StateCard({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-6 text-center text-sm",
        tone === "error"
          ? "border-[#f5c6c3] bg-[#fdecea] text-[#b3261e]"
          : "border-[#e0e2e6] bg-white text-[rgba(4,14,32,0.69)]",
      )}
    >
      {children}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e0e2e6] bg-white p-5">
      <header className="mb-3">
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[rgba(4,14,32,0.55)]">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg bg-[#fafbfc] text-sm text-[rgba(4,14,32,0.55)]">
      {message}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e0e2e6",
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "rgba(15, 48, 106, 0.12) 0px 6px 18px",
} as const;
