// Tipos alineados con la respuesta de ReportController@kpis.

export type KpiActividadPopular = {
  nombre: string;
  reservas: number;
} | null;

export type KpiHoraPunta = {
  hora_inicio: string;
  reservas: number;
} | null;

export type InformeKpis = {
  tasa_ocupacion_promedio: number;
  indice_cancelaciones: number;
  media_reservas_por_clase: number;
  clientes_unicos: number;
  actividad_mas_popular: KpiActividadPopular;
  hora_punta: KpiHoraPunta;
};

export type InformeDesglose = {
  total_clases: number;
  cupo_total: number;
  reservas_activas: number;
  reservas_canceladas: number;
  total_reservas: number;
};

export type ReservaPorDiaSemana = {
  dow: number; // Día de la semana (1=Lun, 2=Mar, etc.)
  label: string; 
  total: number;
};

export type AsistenciaResumen = {
  asistidas: number;
  proximas: number;
  canceladas: number;
  porcentaje_asistencia: number;
};

export type TopActividad = {
  nombre: string;
  reservas: number;
};

export type InformeFiltros = {
  mes: string | number | null;
  anio: string | number | null;
  actividad: string | number | null;
  fecha_desde: string | null;
  fecha_hasta: string | null;
};

export type InformeResponse = {
  kpis: InformeKpis;
  desglose: InformeDesglose;
  reservas_por_dia_semana: ReservaPorDiaSemana[];
  asistencia: AsistenciaResumen;
  top_actividades: TopActividad[];
  filtros_aplicados: InformeFiltros;
};
