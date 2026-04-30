import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "../store/authStore";

// ProtectedRoute: evita que se muestren vistas no autorizadas aunque el backend ya valide con middlewares.

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: number[];
};

// Rutas por defecto por rol (admin → dashboard, entrenador → inicio, cliente → calendario).
const DEFAULT_ROUTE_BY_ROLE: Record<number, string> = {
  1: "/admin",
  2: "/entrenador",
  3: "/cliente/calendario",
};

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  // Si no hay sesión, redirigir al login.
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  // Si hay sesión pero falta permiso, redirigir a la zona por defecto por cada rol.
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.id_rol)
  ) {
    const fallback = DEFAULT_ROUTE_BY_ROLE[user.id_rol] ?? "/login";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
