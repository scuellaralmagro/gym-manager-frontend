import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { handleLaravelErrors } from "../../lib/handleLaravelErrors";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";

const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;

const profileSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(100, "Máximo 100 caracteres."),
    apellidos: z
      .string()
      .trim()
      .min(1, "Los apellidos son obligatorios.")
      .max(150, "Máximo 150 caracteres."),
    email: z
      .string()
      .trim()
      .min(1, "El email es obligatorio.")
      .email("Introduce un email válido.")
      .max(150, "Máximo 150 caracteres."),
    telefono: z.string().max(20, "Máximo 20 caracteres.").optional(),
    password_actual: z.string().optional(),
    nueva_password: z.string().optional(),
    confirmar_password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Solo se activa si el usuario ha introducido `nueva_password`. Si no, los otros dos campos se ignoran (está simplemente editando nombre/email/teléfono).
    const nueva = data.nueva_password?.trim() ?? "";
    if (!nueva) return;

    if (nueva.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nueva_password"],
        message: "La nueva contraseña debe tener al menos 8 caracteres.",
      });
    } else if (!PASSWORD_COMPLEXITY.test(nueva)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nueva_password"],
        message: "Debe incluir mayúsculas, minúsculas, números y símbolos.",
      });
    }

    if (!data.password_actual?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password_actual"],
        message: "Introduce tu contraseña actual para confirmar el cambio.",
      });
    }

    if ((data.confirmar_password ?? "") !== nueva) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmar_password"],
        message: "La confirmación no coincide con la nueva contraseña.",
      });
    }
  });

type ProfileFormValues = z.infer<typeof profileSchema>;

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
 * Construye las iniciales usadas como avatar cuando no hay foto real.
 */
function buildInitials(nombre: string, apellidos: string): string {
  const n = nombre.trim().charAt(0);
  const a = apellidos.trim().charAt(0);
  const initials = `${n}${a}`.toUpperCase();
  return initials || "?";
}

/**
 * Pantalla de perfil del cliente.
 *
 * @remarks
 * Lee y actualiza el usuario en Zustand. Maneja el formulario de datos
 * personales y contraseña con React Hook Form.
 */
export default function ClientProfile() {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nombre: user?.nombre ?? "",
      apellidos: user?.apellidos ?? "",
      email: user?.email ?? "",
      telefono: user?.telefono ?? "",
      password_actual: "",
      nueva_password: "",
      confirmar_password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const payload: Record<string, unknown> = {
        nombre: values.nombre.trim(),
        apellidos: values.apellidos.trim(),
        email: values.email.trim(),
        telefono:
          typeof values.telefono === "string" && values.telefono.trim() !== ""
            ? values.telefono.trim()
            : null,
      };
      if (values.nueva_password) {
        payload.password_actual = values.password_actual;
        payload.nueva_password = values.nueva_password;
        payload.confirmar_password = values.confirmar_password;
      }
      const { data } = await api.put<PerfilResponse>("/api/perfil", payload);
      return data.data;
    },
    onSuccess: (data) => {
      updateUser({
        nombre: data.nombre,
        apellidos: data.apellidos,
        email: data.email,
        telefono: data.telefono,
      });
      reset({
        nombre: data.nombre,
        apellidos: data.apellidos,
        email: data.email,
        telefono: data.telefono ?? "",
        password_actual: "",
        nueva_password: "",
        confirmar_password: "",
      });
      toast.success("Perfil actualizado");
    },
    onError: (error) => {
      const handled = handleLaravelErrors(error, setError, {
        allowedFields: [
          "nombre",
          "apellidos",
          "email",
          "telefono",
          "password_actual",
          "nueva_password",
          "confirmar_password",
        ],
        includeRootMessage: false,
      });
      if (!handled) {
        toast.error("No se pudo guardar", "Inténtalo de nuevo más tarde.");
      }
    },
  });

  // Si por cualquier motivo llegásemos sin autenticación, renderizo un placeholder en vez de un formulario con datos vacíos.
  if (!user) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-medium tracking-tight">Mi perfil</h1>
        <p className="text-sm text-[rgba(4,14,32,0.69)]">
          Sesión no disponible.
        </p>
      </section>
    );
  }

  const initials = buildInitials(user.nombre, user.apellidos);

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Mi perfil</h1>
        <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
          Actualiza tus datos personales y tu contraseña.
        </p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid gap-4 lg:grid-cols-[1fr_2fr]"
      >
        <Card>
          <CardHeader>
            <CardTitle>Foto de perfil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Avatar className="h-24 w-24 text-2xl">
              <AvatarImage alt={`Foto de ${user.nombre}`} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-medium text-[#0d1220]">
                {user.nombre} {user.apellidos}
              </p>
              <p className="mt-0.5 text-xs text-[rgba(4,14,32,0.55)]">
                {user.email}
              </p>
            </div>
            <Button
              type="button"
              disabled
              title="Próximamente"
              aria-disabled="true"
              className="h-9 w-full max-w-[180px] px-3 text-sm"
            >
              Subir foto
            </Button>
            <p className="text-[11px] text-[rgba(4,14,32,0.55)]">
              TBD
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos personales</CardTitle>
              <CardDescription>
                Información de contacto visible para el personal del centro.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FieldGroup
                id="nombre"
                label="Nombre"
                error={errors.nombre?.message}
              >
                <Input
                  id="nombre"
                  autoComplete="given-name"
                  aria-invalid={errors.nombre ? "true" : "false"}
                  {...register("nombre")}
                />
              </FieldGroup>

              <FieldGroup
                id="apellidos"
                label="Apellidos"
                error={errors.apellidos?.message}
              >
                <Input
                  id="apellidos"
                  autoComplete="family-name"
                  aria-invalid={errors.apellidos ? "true" : "false"}
                  {...register("apellidos")}
                />
              </FieldGroup>

              <FieldGroup
                id="email"
                label="Email"
                error={errors.email?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? "true" : "false"}
                  {...register("email")}
                />
              </FieldGroup>

              <FieldGroup
                id="telefono"
                label="Teléfono"
                hint="Opcional"
                error={errors.telefono?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="telefono"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={errors.telefono ? "true" : "false"}
                  {...register("telefono")}
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seguridad y contraseña</CardTitle>
              <CardDescription>
                Deja los campos en blanco si no quieres cambiar tu contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FieldGroup
                id="password_actual"
                label="Contraseña actual"
                error={errors.password_actual?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="password_actual"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password_actual ? "true" : "false"}
                  {...register("password_actual")}
                />
              </FieldGroup>

              <FieldGroup
                id="nueva_password"
                label="Nueva contraseña"
                error={errors.nueva_password?.message}
              >
                <Input
                  id="nueva_password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.nueva_password ? "true" : "false"}
                  {...register("nueva_password")}
                />
              </FieldGroup>

              <FieldGroup
                id="confirmar_password"
                label="Confirmar nueva contraseña"
                error={errors.confirmar_password?.message}
              >
                <Input
                  id="confirmar_password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={errors.confirmar_password ? "true" : "false"}
                  {...register("confirmar_password")}
                />
              </FieldGroup>

              <p className="text-xs text-[rgba(4,14,32,0.55)] sm:col-span-2">
                Usa al menos 8 caracteres con mayúsculas, minúsculas, números y
                símbolos.
              </p>
            </CardContent>
          </Card>

          {errors.root?.message && (
            <p className="text-sm text-[#b3261e]">{errors.root.message}</p>
          )}

          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              onClick={() =>
                reset({
                  nombre: user.nombre,
                  apellidos: user.apellidos,
                  email: user.email,
                  telefono: user.telefono ?? "",
                  password_actual: "",
                  nueva_password: "",
                  confirmar_password: "",
                })
              }
              disabled={!isDirty || isSubmitting || mutation.isPending}
              className={cn(
                "h-10 w-full sm:w-auto px-4 text-sm",
                "border border-[#e0e2e6] bg-white text-[#0d1220]",
                "shadow-none hover:bg-[#f1f5f9]",
              )}
            >
              Descartar cambios
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="h-10 w-full sm:w-auto px-5 text-sm"
            >
              {mutation.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

type FieldGroupProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

function FieldGroup({
  id,
  label,
  error,
  hint,
  className,
  children,
}: FieldGroupProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint && (
          <span className="text-[11px] text-[rgba(4,14,32,0.55)]">{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-xs tracking-[0.08px] text-[#b3261e]">{error}</p>
      )}
    </div>
  );
}
