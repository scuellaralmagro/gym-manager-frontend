// Tipos alineados con AdminReservaResource del backend.

export type ReservaEstado = "Activa" | "Cancelada";

export type AdminReserva = {
  id_reserva: number;
  estado: ReservaEstado;
  fecha_creacion: string | null;
  cliente: {
    id_usuario: number;
    nombre: string;
    apellidos: string;
    email: string;
  };
  clase: {
    id_clase: number;
    fecha: string; // yyyy-mm-dd
    hora_inicio: string; // HH:mm:ss
    hora_fin: string; // HH:mm:ss
    actividad: string;
    sala: string;
  };
};
