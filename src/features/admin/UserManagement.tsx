import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { useConfirm } from "../../components/ui/use-confirm";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import {
  ROL_ID_BY_NOMBRE,
  type PaginatedResponse,
  type RolNombre,
  type Usuario,
} from "../../types/usuario";
import UserCreateDialog from "./UserCreateDialog";
import UserEditDialog from "./UserEditDialog";

const DEFAULT_PER_PAGE = 10; // Número de usuarios por página

/**
 * Retrasa el texto de búsqueda para reducir llamadas a la API.
 */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type UsuariosQueryParams = {
  page: number;
  perPage: number;
  search: string;
  idRol: number | null;
};

/**
 * Obtiene usuarios paginados para la tabla de administración.
 *
 * @param params - Página, tamaño, búsqueda y rol seleccionado.
 */
async function fetchUsuarios({
  page,
  perPage,
  search,
  idRol,
}: UsuariosQueryParams): Promise<PaginatedResponse<Usuario>> {
  const { data } = await api.get<PaginatedResponse<Usuario>>(
    "/api/admin/usuarios",
    {
      params: {
        page,
        per_page: perPage,
        q: search || undefined,
        id_rol: idRol ?? undefined,
      },
    },
  );
  return data;
}

/**
 * Pantalla de gestión de usuarios.
 *
 * @remarks
 * Maneja filtros (`page`, `search`, `idRol`) y modales (`editing`, `creating`).
 * TanStack Query llama a `GET /api/admin/usuarios`; el borrado usa
 * `DELETE /api/admin/usuarios/{id}` e invalida el listado.
 */
export default function UserManagement() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [idRol, setIdRol] = useState<number | null>(null);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id_usuario: number) => {
      await api.delete(`/api/admin/usuarios/${id_usuario}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      toast.success("Usuario eliminado");
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo eliminar el usuario.";
      toast.error("No se pudo eliminar", message);
    },
  });

  const handleDelete = async (usuario: Usuario) => {
    const ok = await confirm({
      title: `Eliminar a ${usuario.nombre} ${usuario.apellidos}`,
      description:
        "Esta acción es irreversible. Si el usuario es entrenador con clases asignadas, el borrado será rechazado.",
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    deleteMutation.mutate(usuario.id_usuario);
  };

  // Debounceamos la búsqueda para no saturar la API con cada tecla pulsada
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, idRol]);

  const queryKey = [
    "admin",
    "usuarios",
    { page, perPage: DEFAULT_PER_PAGE, search: debouncedSearch, idRol },
  ] as const;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      fetchUsuarios({
        page,
        perPage: DEFAULT_PER_PAGE,
        search: debouncedSearch,
        idRol,
      }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<ColumnDef<Usuario>[]>(
    () => [
      {
        accessorKey: "id_usuario",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[rgba(4,14,32,0.55)]">
            #{row.original.id_usuario}
          </span>
        ),
      },
      {
        id: "nombre_completo",
        header: "Nombre",
        cell: ({ row }) => (
          <span className="font-medium text-[rgba(4,14,32,0.87)]">
            {row.original.nombre} {row.original.apellidos}
          </span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="text-[rgba(4,14,32,0.75)]">
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: "rol",
        header: "Rol",
        cell: ({ row }) => <RolBadge rol={row.original.rol} />,
      },
      {
        id: "acciones",
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <RowActions
            usuario={row.original}
            onEdit={() => setEditing(row.original)}
            onDelete={() => handleDelete(row.original)}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    pageCount: data?.meta.last_page ?? -1,
  });

  const total = data?.meta.total ?? 0;
  const lastPage = data?.meta.last_page ?? 1;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            Gestión de Usuarios
          </h1>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Administra las cuentas del sistema, su rol y sus accesos.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 w-auto px-4"
        >
          + Nuevo Usuario
        </Button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e0e2e6] bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor="usuarios-search" className="sr-only">
            Buscar usuario
          </label>
          <Input
            id="usuarios-search"
            type="search"
            placeholder="Buscar por nombre, apellidos o email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="usuarios-rol" className="sr-only">
            Filtrar por rol
          </label>
          <select
            id="usuarios-rol"
            value={idRol ?? ""}
            onChange={(event) =>
              setIdRol(event.target.value ? Number(event.target.value) : null)
            }
            className={cn(
              "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
              "px-3 text-base tracking-[0.08px] text-[#181d26]",
              "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
            )}
          >
            <option value="">Todos los roles</option>
            <option value={ROL_ID_BY_NOMBRE.Administrador}>
              Administrador
            </option>
            <option value={ROL_ID_BY_NOMBRE.Entrenador}>Entrenador</option>
            <option value={ROL_ID_BY_NOMBRE.Cliente}>Cliente</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e0e2e6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#f8fafc] text-left text-xs uppercase tracking-wider text-[rgba(4,14,32,0.55)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-b border-[#e0e2e6] px-4 py-3 font-medium"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <TableStateRow colSpan={columns.length}>
                  Cargando usuarios…
                </TableStateRow>
              ) : isError ? (
                <TableStateRow colSpan={columns.length}>
                  <div className="flex flex-col items-center gap-2 py-4">
                    <span className="text-[#b3261e]">
                      No se pudo cargar la lista de usuarios.
                    </span>
                    <Button
                      type="button"
                      onClick={() => refetch()}
                      className="h-9 w-auto px-4"
                    >
                      Reintentar
                    </Button>
                  </div>
                </TableStateRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableStateRow colSpan={columns.length}>
                  No hay usuarios que coincidan con los filtros.
                </TableStateRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#eef1f5] last:border-0 hover:bg-[#fafbfc]"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e0e2e6] px-4 py-3 text-sm text-[rgba(4,14,32,0.69)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            {total === 0
              ? "0 usuarios"
              : `${data?.meta.from ?? 0}–${data?.meta.to ?? 0} de ${total} usuarios`}
            {isFetching && !isLoading ? " · actualizando…" : null}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className={cn(
                "rounded-lg border border-[#e0e2e6] px-3 py-1.5 text-sm font-medium",
                "transition-colors hover:bg-[#f1f5f9]",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              Anterior
            </button>
            <span className="px-2 text-xs">
              Página {data?.meta.current_page ?? page} de {lastPage}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              disabled={page >= lastPage || isLoading}
              className={cn(
                "rounded-lg border border-[#e0e2e6] px-3 py-1.5 text-sm font-medium",
                "transition-colors hover:bg-[#f1f5f9]",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <UserEditDialog
          usuario={editing}
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      <UserCreateDialog
        open={creating}
        onClose={() => setCreating(false)}
      />
    </section>
  );
}

function RolBadge({ rol }: { rol: RolNombre }) {
  const variant =
    rol === "Administrador"
      ? "admin"
      : rol === "Entrenador"
        ? "entrenador"
        : rol === "Cliente"
          ? "cliente"
          : "neutral";
  return <Badge variant={variant}>{rol}</Badge>;
}

function RowActions({
  usuario,
  onEdit,
  onDelete,
}: {
  usuario: Usuario;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Acciones sobre ${usuario.email}`}>
          <DotsVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
          <DropdownMenuItem destructive onClick={onDelete}>
            Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableStateRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-sm text-[rgba(4,14,32,0.69)]"
      >
        {children}
      </td>
    </tr>
  );
}

function DotsVerticalIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}
