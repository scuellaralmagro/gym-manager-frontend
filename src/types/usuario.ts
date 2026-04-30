// Definición de tipos para el usuario (alineados con el modelo 'Usuario' del backend)

export type RolNombre = "Administrador" | "Entrenador" | "Cliente";

export type Usuario = {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  rol: RolNombre;
};

// Formato estándar de respuesta paginada de Laravel
export type PaginatedResponse<T> = {
  data: T[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
};

export const ROL_ID_BY_NOMBRE: Record<RolNombre, number> = {
  Administrador: 1,
  Entrenador: 2,
  Cliente: 3,
};
