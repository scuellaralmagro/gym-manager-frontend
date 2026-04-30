import { create } from "zustand";

/**
 * Usuario autenticado que se guarda en el store global.
 */
export type AuthUser = {
  id: number;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  id_rol: number;
};

/**
 * Estado global de autenticación de la app.
 *
 * @remarks
 * Maneja el usuario activo, si hay sesión iniciada, el login, la actualización
 * parcial de perfil y el logout.
 */
type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
};

/**
 * Hook Zustand (libreria para gestion de estados) para leer y modificar la sesión del usuario.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) =>
    set({
      user,
      isAuthenticated: true,
    }),
  updateUser: (patch) =>
    set((state) =>
      state.user ? { user: { ...state.user, ...patch } } : state,
    ),
  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}));
