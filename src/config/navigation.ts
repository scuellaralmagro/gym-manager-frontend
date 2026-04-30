import type { ComponentType, SVGProps } from "react";

import {
  AgendaIcon,
  BookingIcon,
  CalendarIcon,
  ChartIcon,
  DashboardIcon,
  HomeIcon,
  UserIcon,
  UsersIcon,
} from "../components/icons";

export const ROLE_ADMIN = 1;
export const ROLE_ENTRENADOR = 2;
export const ROLE_CLIENTE = 3;

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type NavItem = {
  title: string;
  path: string;
  icon: NavIcon;
  allowedRoles: number[];
};

// Definimos las rutas y los roles permitidos para cada item de la navegación

export const navItems: NavItem[] = [
  // Admin
  {
    title: "Dashboard",
    path: "/admin",
    icon: DashboardIcon,
    allowedRoles: [ROLE_ADMIN],
  },
  {
    title: "Gestión Usuarios",
    path: "/admin/usuarios",
    icon: UsersIcon,
    allowedRoles: [ROLE_ADMIN],
  },
  {
    title: "Gestión Oferta / Clases",
    path: "/admin/clases",
    icon: CalendarIcon,
    allowedRoles: [ROLE_ADMIN],
  },
  {
    title: "Gestión Reservas",
    path: "/admin/reservas",
    icon: BookingIcon,
    allowedRoles: [ROLE_ADMIN],
  },
  {
    title: "Informes y Métricas",
    path: "/admin/informes",
    icon: ChartIcon,
    allowedRoles: [ROLE_ADMIN],
  },

  // Entrenador
  {
    title: "Inicio",
    path: "/entrenador",
    icon: HomeIcon,
    allowedRoles: [ROLE_ENTRENADOR],
  },
  {
    title: "Mi Agenda",
    path: "/entrenador/agenda",
    icon: AgendaIcon,
    allowedRoles: [ROLE_ENTRENADOR],
  },
  {
    title: "Mi Perfil",
    path: "/entrenador/perfil",
    icon: UserIcon,
    allowedRoles: [ROLE_ENTRENADOR],
  },

  // Cliente
  {
    title: "Inicio",
    path: "/cliente",
    icon: HomeIcon,
    allowedRoles: [ROLE_CLIENTE],
  },
  {
    title: "Calendario",
    path: "/cliente/calendario",
    icon: CalendarIcon,
    allowedRoles: [ROLE_CLIENTE],
  },
  {
    title: "Mis Reservas",
    path: "/cliente/reservas",
    icon: BookingIcon,
    allowedRoles: [ROLE_CLIENTE],
  },
  {
    title: "Mi Perfil",
    path: "/cliente/perfil",
    icon: UserIcon,
    allowedRoles: [ROLE_CLIENTE],
  },
];

// Funcion para filtrar las rutas permitidas para cada rol
export function getNavItemsForRole(
  idRol: number | null | undefined,
): NavItem[] {
  if (!idRol) return [];
  return navItems.filter((item) => item.allowedRoles.includes(idRol));
}
