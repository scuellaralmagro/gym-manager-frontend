import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { handleLaravelErrors } from "../../lib/handleLaravelErrors";
import { cn } from "../../lib/utils";
import { ROL_ID_BY_NOMBRE } from "../../types/usuario";

// Misma política de contraseña que el backend (StoreUserRequest): 8 mínimos
// y al menos una mayúscula, una minúscula, un dígito y un símbolo
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;

const createSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(100),
  apellidos: z.string().min(1, "Los apellidos son obligatorios.").max(150),
  email: z.string().email("Introduce un email válido.").max(150),
  telefono: z.string().max(20).or(z.literal("")).nullable().optional(),
  id_rol: z
    .number({ error: "Selecciona un rol." })
    .int()
    .positive({ error: "Selecciona un rol." }),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .regex(PASSWORD_REGEX, {
      message: "Debe incluir mayúsculas, minúsculas, números y símbolos.",
    }),
});

type CreateFormValues = z.infer<typeof createSchema>;

type UserCreateDialogProps = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_VALUES: CreateFormValues = {
  nombre: "",
  apellidos: "",
  email: "",
  telefono: "",
  id_rol: ROL_ID_BY_NOMBRE.Cliente,
  password: "",
};

/**
 * Diálogo para dar de alta usuarios desde administración.
 *
 * @param open - Controla la visibilidad del diálogo.
 * @param onClose - Cierra el diálogo al cancelar o guardar.
 *
 * @remarks
 * No usa estado local propio salvo el formulario de React Hook Form. La modificación
 * se hace con `POST` sobre `/api/admin/usuarios` y se refresca la lista de usuarios y el dashboard.
 */
export default function UserCreateDialog({
  open,
  onClose,
}: UserCreateDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) reset(DEFAULT_VALUES);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CreateFormValues) => {
      const payload = {
        nombre: values.nombre,
        apellidos: values.apellidos,
        email: values.email,
        telefono: values.telefono?.toString().trim() || null,
        id_rol: values.id_rol,
        password: values.password,
      };
      const { data } = await api.post("/api/admin/usuarios", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      // El KPI "Nuevos Usuarios" del landing también se refresca
      queryClient.invalidateQueries({
        queryKey: ["admin", "dashboard-summary"],
      });
      toast.success("Usuario creado");
      onClose();
    },
  });

  const onSubmit = async (values: CreateFormValues) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      if (
        handleLaravelErrors(error, setError, {
          allowedFields: [
            "nombre",
            "apellidos",
            "email",
            "telefono",
            "id_rol",
            "password",
          ],
        })
      ) {
        return;
      }
      setError("root", {
        type: "server",
        message: "No se pudo crear el usuario. Inténtalo de nuevo.",
      });
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Crear nuevo usuario"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e0e2e6] bg-white p-6 shadow-[rgba(15,48,106,0.12)_0px_10px_30px]">
        <header className="mb-4">
          <h2 className="text-lg font-medium tracking-tight">
            Crear nuevo usuario
          </h2>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Da de alta una cuenta asignándole un rol y una contraseña inicial.
          </p>
        </header>

        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-nombre">Nombre</Label>
              <Input
                id="create-nombre"
                autoComplete="given-name"
                aria-invalid={errors.nombre ? "true" : "false"}
                {...register("nombre")}
              />
              {errors.nombre && (
                <p className="text-xs text-[#b3261e]">
                  {errors.nombre.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-apellidos">Apellidos</Label>
              <Input
                id="create-apellidos"
                autoComplete="family-name"
                aria-invalid={errors.apellidos ? "true" : "false"}
                {...register("apellidos")}
              />
              {errors.apellidos && (
                <p className="text-xs text-[#b3261e]">
                  {errors.apellidos.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? "true" : "false"}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-[#b3261e]">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-telefono">Teléfono</Label>
              <Input
                id="create-telefono"
                type="tel"
                autoComplete="tel"
                aria-invalid={errors.telefono ? "true" : "false"}
                {...register("telefono")}
              />
              {errors.telefono && (
                <p className="text-xs text-[#b3261e]">
                  {errors.telefono.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-rol">Rol</Label>
              <select
                id="create-rol"
                aria-invalid={errors.id_rol ? "true" : "false"}
                className={cn(
                  "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
                  "px-3 text-base tracking-[0.08px] text-[#181d26]",
                  "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
                )}
                {...register("id_rol", { valueAsNumber: true })}
              >
                <option value={ROL_ID_BY_NOMBRE.Administrador}>
                  Administrador
                </option>
                <option value={ROL_ID_BY_NOMBRE.Entrenador}>Entrenador</option>
                <option value={ROL_ID_BY_NOMBRE.Cliente}>Cliente</option>
              </select>
              {errors.id_rol && (
                <p className="text-xs text-[#b3261e]">
                  {errors.id_rol.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-password">Contraseña inicial</Label>
            <Input
              id="create-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : "false"}
              {...register("password")}
            />
            <p className="text-xs text-[rgba(4,14,32,0.55)]">
              Mínimo 8 caracteres con mayúsculas, minúsculas, números y
              símbolos.
            </p>
            {errors.password && (
              <p className="text-xs text-[#b3261e]">
                {errors.password.message}
              </p>
            )}
          </div>

          {errors.root && (
            <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-xs text-[#b3261e]">
              {errors.root.message}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[rgba(4,14,32,0.75)] hover:bg-[#f1f5f9]"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-auto px-5"
            >
              {isSubmitting ? "Creando…" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
