// Tipos alineados con AdminClaseResource y los catálogos de AdminCatalogController.

export type AdminClase = {
  id_clase: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cupo_maximo: number;
  reservas_activas: number;
  entrenador: {
    id_usuario: number;
    nombre: string;
    apellidos: string;
  };
  id_sala: number;
  id_actividad: number;
  actividad: string;
  sala: string;
};

export type EntrenadorOption = {
  id_usuario: number;
  nombre: string;
  apellidos: string;
};

export type SalaOption = {
  id_sala: number;
  nombre: string;
  capacidad_max: number;
};

export type ActividadOption = {
  id_actividad: number;
  nombre: string;
  descripcion?: string;
};

export type CatalogResponse<T> = {
  data: T[];
};
