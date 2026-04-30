// Tipos alineados con ClaseResource y ReservaResource del backend
// cuando se sirven a un cliente autenticado

export type EntrenadorResumen = {
  id_usuario: number;
  nombre: string;
  apellidos: string;
};

export type ClienteClase = {
  id_clase: number;
  fecha: string; // yyyy-mm-dd
  hora_inicio: string; // HH:mm:ss
  hora_fin: string; // HH:mm:ss
  cupo_maximo: number;
  plazas_disponibles: number;
  actividad: string;
  sala: {
    nombre: string;
    capacidad_max: number;
  };
  entrenador?: EntrenadorResumen | null;
};

export type MiReservaEstado = "Activa" | "Cancelada";

export type MiReserva = {
  id_reserva: number;
  estado: MiReservaEstado;
  fecha_creacion: string | null;
  clase: {
    id_clase: number;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    actividad: string;
    sala: string;
    entrenador?: EntrenadorResumen | null;
  };
};

export type CollectionResponse<T> = {
  data: T[];
};
