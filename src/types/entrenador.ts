// Definiciones de tipos para el entrenador

export type EntrenadorClase = {
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
};

export type AsistenciaEstado = "Activa" | "Cancelada";

export type AsistenciaItem = {
  id_reserva: number;
  estado: AsistenciaEstado;
  cliente: {
    id_usuario: number;
    nombre: string;
    apellidos: string;
    email: string;
  };
};
