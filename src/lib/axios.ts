import axios from "axios";

import { useAuthStore } from "../store/authStore";

/**
 * Clave usada para guardar el token de autenticación del usuario.
 */
export const AUTH_TOKEN_STORAGE_KEY = "gym-manager.authToken";

/**
 * Aplica el token Bearer al cliente Axios compartido.
 *
 * @param token - Token emitido por `/api/login`.
 */
export function setApiAuthToken(token: string): void {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

/**
 * Elimina el token Bearer del cliente Axios compartido.
 */
export function clearApiAuthToken(): void {
  delete api.defaults.headers.common.Authorization;
}

/**
 * Cliente Axios principal de GymManager.
 *
 * @remarks
 * Lee `VITE_API_URL` desde el `.env` para separar la URL del backend del código
 * fuente. También reinyecta el token guardado y, si la API responde 401/419,
 * limpia la sesión de Zustand y redirige al login.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000", // defaults to localhost if not set on .env
  withCredentials: true,
});

/** Token persistido entre recargas del navegador. */
const persistedToken =
  typeof window !== "undefined"
    ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    : null;

if (persistedToken) {
  setApiAuthToken(persistedToken);
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 || status === 419) {
      useAuthStore.getState().logout();

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        clearApiAuthToken();

        if (window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
