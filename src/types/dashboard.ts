// Tipos alineados con AdminOverviewController@dashboardSummary.

export type DashboardKpis = {
  reservas_activas: number;
  llenado_medio: number;
  nuevos_usuarios: number;
};

export type OcupacionActividad = {
  actividad: string;
  ocupacion: number;
  reservas: number;
  cupo: number;
};

export type DashboardSummaryResponse = {
  kpis: DashboardKpis;
  ocupacion_semanal: OcupacionActividad[];
  rango: {
    desde: string;
    hasta: string;
  };
};
