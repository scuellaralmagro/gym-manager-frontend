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
import { useAuthStore } from "../../store/authStore";
import { ROL_ID_BY_NOMBRE, type Usuario } from "../../types/usuario";

// Regex para validar la contraseña (mínimo 8 caracteres, mayúsculas, minúsculas, números y símbolos)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;

const editSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").max(100),
  apellidos: z.string().min(1, "Los apellidos son obligatorios.").max(150),
  email: z.string().email("Introduce un email válido.").max(150),
  telefono: z.string().max(20).or(z.literal("")).nullable().optional(),
  id_rol: z.number().int().positive(),
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 8, {
      message: "La contraseña debe tener al menos 8 caracteres.",
    })
    .refine((v) => !v || PASSWORD_REGEX.test(v), {
      message: "Debe incluir mayúsculas, minúsculas, números y símbolos.",
    }),
});

type EditFormValues = z.infer<typeof editSchema>;

type UserEditDialogProps = {
  usuario: Usuario;
  open: boolean;
  onClose: () => void;
};

/**
 * Diálogo para editar usuarios existentes.
 *
 * @param usuario - Usuario seleccionado en la tabla.
 * @param open - Indica si el modal está visible.
 * @param onClose - Cierra el modal y limpia la selección.
 *
 * @remarks
 * Lee `authUser` desde Zustand para impedir que un admin cambie su propio rol.
 * La modificación se hace con `PUT` sobre `/api/admin/usuarios/{id}` y se refresca la tabla.
 */
export default function UserEditDialog({
  usuario,
  open,
  onClose,
}: UserEditDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const authUser = useAuthStore((state) => state.user);

  // Evitamos que el admin se baje a sí mismo el rol
  const isSelf = Boolean(authUser && authUser.id === usuario.id_usuario);
  const currentIdRol =
    ROL_ID_BY_NOMBRE[usuario.rol as keyof typeof ROL_ID_BY_NOMBRE] ?? 3;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      email: usuario.email,
      telefono: usuario.telefono ?? "",
      id_rol:
        ROL_ID_BY_NOMBRE[usuario.rol as keyof typeof ROL_ID_BY_NOMBRE] ?? 3,
      password: "",
    },
  });

  // Reset de los valores del formulario cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      reset({
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        email: usuario.email,
        telefono: usuario.telefono ?? "",
        id_rol:
          ROL_ID_BY_NOMBRE[usuario.rol as keyof typeof ROL_ID_BY_NOMBRE] ?? 3,
        password: "",
      });
    }
  }, [open, usuario, reset]);

  const mutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const payload = {
        nombre: values.nombre,
        apellidos: values.apellidos,
        email: values.email,
        telefono: values.telefono?.toString().trim() || null,
        id_rol: values.id_rol,
        ...(values.password ? { password: values.password } : {}),
      };
      const { data } = await api.put(
        `/api/admin/usuarios/${usuario.id_usuario}`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      toast.success("Usuario actualizado");
      onClose();
    },
  });

  const onSubmit = async (values: EditFormValues) => {
    // Evitamos que el admin se baje a sí mismo el rol dentro del edit completo
    if (isSelf && values.id_rol !== currentIdRol) {
      toast.warning(
        "No puedes cambiar tu propio rol",
        "Pide a otro administrador que lo haga.",
      );
      setError("id_rol", {
        type: "validate",
        message: "No puedes cambiar tu propio rol.",
      });
      return;
    }

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
        message: "No se pudo guardar el usuario. Inténtalo de nuevo.",
      });
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`Editar usuario ${usuario.email}`}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-[#e0e2e6] bg-white p-6 shadow-[rgba(15,48,106,0.12)_0px_10px_30px]">
        <header className="mb-4">
          <h2 className="text-lg font-medium tracking-tight">Editar usuario</h2>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Modifica los datos del usuario #{usuario.id_usuario}.
          </p>
        </header>

        <form
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre</Label>
              <Input
                id="edit-nombre"
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
              <Label htmlFor="edit-apellidos">Apellidos</Label>
              <Input
                id="edit-apellidos"
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
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
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
              <Label htmlFor="edit-telefono">Teléfono</Label>
              <Input
                id="edit-telefono"
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
              <Label htmlFor="edit-rol">Rol</Label>
              <select
                id="edit-rol"
                aria-invalid={errors.id_rol ? "true" : "false"}
                disabled={isSelf}
                className={cn(
                  "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
                  "px-3 text-base tracking-[0.08px] text-[#181d26]",
                  "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
                  "disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[rgba(4,14,32,0.55)]",
                )}
                {...register("id_rol", { valueAsNumber: true })}
              >
                <option value={ROL_ID_BY_NOMBRE.Administrador}>
                  Administrador
                </option>
                <option value={ROL_ID_BY_NOMBRE.Entrenador}>Entrenador</option>
                <option value={ROL_ID_BY_NOMBRE.Cliente}>Cliente</option>
              </select>
              {isSelf ? (
                <p
                  role="note"
                  className="rounded-lg bg-[#fdecea] px-2.5 py-1.5 text-xs text-[#b3261e]"
                >
                  No puedes modificar tu propio rol (perderías acceso como
                  administrador). Pide a otro administrador que lo haga.
                </p>
              ) : null}
              {errors.id_rol && (
                <p className="text-xs text-[#b3261e]">
                  {errors.id_rol.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-password">Nueva contraseña (opcional)</Label>
            <Input
              id="edit-password"
              type="password"
              autoComplete="new-password"
              placeholder="Dejar vacío para mantener la actual"
              aria-invalid={errors.password ? "true" : "false"}
              {...register("password")}
            />
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
              {isSubmitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
