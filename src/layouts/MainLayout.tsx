import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { CloseIcon, LogoutIcon, MenuIcon } from "../components/icons";
import {
  getNavItemsForRole,
  ROLE_ADMIN,
  type NavItem,
} from "../config/navigation";
import api, { AUTH_TOKEN_STORAGE_KEY, clearApiAuthToken } from "../lib/axios";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

// Layout principal que envuelve todas las rutas privadas

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Si MainLayout se monta sin usuario, no se pinta nada: ProtectedRoute ya se encargará de redirigir a /login.
  if (!user) return null;

  const items = getNavItemsForRole(user.id_rol);
  const isAdmin = user.id_rol === ROLE_ADMIN;

  // Funcion para cerrar sesión
  const handleLogout = async () => {
    try {
      await api.post("/api/logout");
    } catch (error) {
      void error;
    } finally {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      clearApiAuthToken();
      logout();
      navigate("/login", { replace: true });
    }
  };

  // Para el admin, se muestra el sidebar a la izquierda
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-[#181d26]">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
          />
        )}

        <AdminSidebar
          items={items}
          userName={user.nombre}
          userEmail={user.email}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onLogout={handleLogout}
        />

        <div className="md:pl-64">
          <header className="flex items-center justify-between border-b border-[#e0e2e6] bg-white px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[rgba(4,14,32,0.69)] hover:bg-[#f1f5f9]"
              aria-label="Abrir menú"
            >
              <MenuIcon />
            </button>
            <span className="text-base font-medium">GymManager</span>
            <span className="w-10" aria-hidden />
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  // Para el resto, se muestra el navbar superior
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#181d26]">
      <TopNavbar
        items={items}
        userName={user.nombre}
        mobileOpen={mobileOpen}
        onToggle={() => setMobileOpen((prev) => !prev)}
        onLogout={handleLogout}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

// Componentes de layout

type SidebarProps = {
  items: NavItem[];
  userName: string;
  userEmail: string;
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
};

function AdminSidebar({
  items,
  userName,
  userEmail,
  mobileOpen,
  onClose,
  onLogout,
}: SidebarProps) {
  // Sidebar para el admin
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#e0e2e6] bg-white",
        "transition-transform duration-200 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0",
      )}
      aria-label="Navegación principal"
    >
      <div className="flex items-center justify-between px-5 py-5">
        <span className="text-lg font-medium tracking-tight text-[rgba(4,14,32,0.87)]">
          GymManager
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[rgba(4,14,32,0.69)] hover:bg-[#f1f5f9] md:hidden"
          aria-label="Cerrar menú"
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((item) => (
          <SidebarLink key={item.path} item={item} onClick={onClose} />
        ))}
      </nav>

      <div className="border-t border-[#e0e2e6] p-4">
        <div className="mb-3 px-2">
          <p className="truncate text-sm font-medium text-[rgba(4,14,32,0.87)]">
            {userName}
          </p>
          <p className="truncate text-xs text-[rgba(4,14,32,0.55)]">
            {userEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className={cn(
            "inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            "text-[#b3261e] transition-colors hover:bg-[#fdecea]",
          )}
        >
          <LogoutIcon />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  onClick,
}: {
  item: NavItem;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={
        item.path === "/admin" ||
        item.path === "/cliente" ||
        item.path === "/entrenador"
      }
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-[#e8f0fe] text-[#1b61c9]"
            : "text-[rgba(4,14,32,0.75)] hover:bg-[#f1f5f9]",
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{item.title}</span>
    </NavLink>
  );
}

type NavbarProps = {
  items: NavItem[];
  userName: string;
  mobileOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
};

// Navbar para el resto

function TopNavbar({
  items,
  userName,
  mobileOpen,
  onToggle,
  onLogout,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e0e2e6] bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[rgba(4,14,32,0.69)] hover:bg-[#f1f5f9] md:hidden"
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <span className="text-lg font-medium tracking-tight">GymManager</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <NavbarLink key={item.path} item={item} />
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <span className="max-w-[140px] truncate text-sm text-[rgba(4,14,32,0.69)]">
            {userName}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              "text-[#b3261e] transition-colors hover:bg-[#fdecea]",
            )}
          >
            <LogoutIcon />
            Salir
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#e0e2e6] bg-white md:hidden">
          <nav className="space-y-1 px-3 py-3">
            {items.map((item) => (
              <NavbarLink
                key={item.path}
                item={item}
                block
                onClick={onToggle}
              />
            ))}
          </nav>
          <div className="flex items-center justify-between border-t border-[#e0e2e6] px-4 py-3">
            <span className="truncate text-sm text-[rgba(4,14,32,0.69)]">
              {userName}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                "text-[#b3261e] transition-colors hover:bg-[#fdecea]",
              )}
            >
              <LogoutIcon />
              Salir
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function NavbarLink({
  item,
  block = false,
  onClick,
}: {
  item: NavItem;
  block?: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={
        item.path === "/admin" ||
        item.path === "/cliente" ||
        item.path === "/entrenador"
      }
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          block ? "w-full" : "",
          isActive
            ? "bg-[#e8f0fe] text-[#1b61c9]"
            : "text-[rgba(4,14,32,0.75)] hover:bg-[#f1f5f9]",
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="truncate">{item.title}</span>
    </NavLink>
  );
}
