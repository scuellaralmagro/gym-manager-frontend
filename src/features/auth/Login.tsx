import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api, { AUTH_TOKEN_STORAGE_KEY, setApiAuthToken } from "../../lib/axios";
import { handleLaravelErrors } from "../../lib/handleLaravelErrors";
import { cn } from "../../lib/utils";
import { useAuthStore, type AuthUser } from "../../store/authStore";

// Esquema Zod: email válido y contraseña mínima de 8 caracteres.
const loginSchema = z.object({
  email: z.string().email("Introduce un email válido."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Mapeo nombre-rol → id_rol
const ROLE_NAME_TO_ID: Record<string, number> = {
  Administrador: 1,
  Entrenador: 2,
  Cliente: 3,
};

const DASHBOARD_BY_ROLE: Record<number, string> = {
  1: "/admin",
  2: "/entrenador",
  3: "/cliente/calendario",
};

type PerfilResponse = {
  data: {
    id_usuario: number;
    nombre: string;
    apellidos: string;
    email: string;
    telefono: string | null;
    rol: string;
  };
};

/**
 * Pantalla de login de GymManager.
 *
 * @remarks
 * Maneja el formulario de email y contraseña con React Hook Form. Lanza
 * `POST /api/login` y `GET /api/perfil`; después guarda token y usuario en
 * Zustand y redirige según el rol.
 */
export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const { data: loginData } = await api.post<{ token: string }>(
        "/api/login",
        values,
      );

      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, loginData.token);
      setApiAuthToken(loginData.token);

      const { data: perfil } = await api.get<PerfilResponse>("/api/perfil");
      const idRol = ROLE_NAME_TO_ID[perfil.data.rol] ?? 0;

      const user: AuthUser = {
        id: perfil.data.id_usuario,
        nombre: perfil.data.nombre,
        apellidos: perfil.data.apellidos,
        email: perfil.data.email,
        telefono: perfil.data.telefono,
        id_rol: idRol,
      };

      // Aqui guardamos el usuario autenticado en el store y redirigimos a la zona por defecto.
      login(user);
      navigate(DASHBOARD_BY_ROLE[idRol] ?? "/", { replace: true });
    } catch (error) {
      // Si hay un error 422, lo manejamos con la funcion handleLaravelErrors
      if (
        handleLaravelErrors(error, setError, {
          allowedFields: ["email", "password"],
        })
      ) {
        return;
      }

      if (isAxiosError(error) && error.response?.status === 401) {
        const message = error.response?.data?.message as string | undefined;
        setError("password", {
          type: "server",
          message: message ?? "Credenciales incorrectas.",
        });
        return;
      }

      setError("root", {
        type: "server",
        message: "No se pudo iniciar sesión. Inténtalo de nuevo.",
      });
    }
  };

  const fontStack =
    'Haas, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif';

  // Código TSX para el login.
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-12"
      style={{ fontFamily: fontStack }}
    >
      <section
        className={cn(
          "w-full max-w-[420px] rounded-[24px] border border-[#e0e2e6] bg-white",
          "px-10 py-12",
          "shadow-[rgba(15,48,106,0.05)_0px_0px_20px,rgba(45,127,249,0.12)_0px_1px_3px]",
        )}
      >
        <header className="mb-8 text-center">
          <h1 className="text-[32px] font-medium leading-[1.15] text[rgba(4,14,32,0.69)]">
            GymManager
          </h1>
          <p className="mt-2 text-sm tracking-[0.08px] text-[rgba(4,14,32,0.69)]">
            Accede con tus credenciales
          </p>
        </header>

        <form
          className="space-y-5"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              aria-invalid={errors.email ? "true" : "false"}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs tracking-[0.08px] text-[#b3261e]">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={errors.password ? "true" : "false"}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs tracking-[0.08px] text-[#b3261e]">
                {errors.password.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p className="text-center text-xs tracking-[0.08px] text-[#b3261e]">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
