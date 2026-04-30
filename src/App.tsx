import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import CookieConsent from "./components/CookieConsent";
import ProtectedRoute from "./components/ProtectedRoute";
import { ConfirmDialogProvider } from "./components/ui/confirm-dialog";
import { ToastProvider } from "./components/ui/toast";
import { ROLE_ADMIN, ROLE_CLIENTE, ROLE_ENTRENADOR } from "./config/navigation";
import AdminDashboard from "./features/admin/AdminDashboard";
import ClassManagement from "./features/admin/ClassManagement";
import MetricsDashboard from "./features/admin/MetricsDashboard";
import ReservationManagement from "./features/admin/ReservationManagement";
import UserManagement from "./features/admin/UserManagement";
import LoginPage from "./features/auth/Login";
import ClientCalendar from "./features/client/ClientCalendar";
import ClientDashboard from "./features/client/ClientDashboard";
import ClientProfile from "./features/client/ClientProfile";
import MyReservations from "./features/client/MyReservations";
import TrainerDashboard from "./features/trainer/TrainerDashboard";
import TrainerProfile from "./features/trainer/TrainerProfile";
import TrainerWeeklyAgenda from "./features/trainer/TrainerWeeklyAgenda";
import MainLayout from "./layouts/MainLayout";
import { useAuthStore } from "./store/authStore";

function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-[rgba(4,14,32,0.69)]">
        Pantalla pendiente de implementación.
      </p>
    </section>
  );
}

function NotFoundPage() {
  return <h1>404 — Ruta no encontrada</h1>;
}

// Redirijimos la raíz "/" al home del rol por defecto.
function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.id_rol) {
    case ROLE_ADMIN:
      return <Navigate to="/admin" replace />;
    case ROLE_ENTRENADOR:
      return <Navigate to="/entrenador" replace />;
    case ROLE_CLIENTE:
      return <Navigate to="/cliente" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ConfirmDialogProvider>
          <AppRoutes />
          <CookieConsent />
        </ConfirmDialogProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Zona Cliente */}
      <Route
        path="/cliente"
        element={
          <ProtectedRoute allowedRoles={[ROLE_CLIENTE]}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboard />} />
        <Route path="calendario" element={<ClientCalendar />} />
        <Route path="reservas" element={<MyReservations />} />
        <Route path="perfil" element={<ClientProfile />} />
      </Route>

      {/* Zona Entrenador */}
      <Route
        path="/entrenador"
        element={
          <ProtectedRoute allowedRoles={[ROLE_ENTRENADOR]}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TrainerDashboard />} />
        <Route path="agenda" element={<TrainerWeeklyAgenda />} />
        <Route
          path="clase/:idClase/asistencia"
          element={<Placeholder title="Pasar lista" />}
        />
        <Route path="perfil" element={<TrainerProfile />} />
      </Route>

      {/* Zona Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[ROLE_ADMIN]}>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="usuarios" element={<UserManagement />} />
        <Route path="clases" element={<ClassManagement />} />
        <Route path="reservas" element={<ReservationManagement />} />
        <Route path="informes" element={<MetricsDashboard />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
