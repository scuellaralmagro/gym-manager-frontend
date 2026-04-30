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
import type { AdminReserva, ReservaEstado } from "../../types/reserva";
import type { PaginatedResponse } from "../../types/usuario";
import ForceReservationDialog from "./ForceReservationDialog";

const DEFAULT_PER_PAGE = 10;

/**
 * Retrasa el valor de búsqueda para evitar peticiones por cada tecla.
 */
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// "todos" representa el filtro "sin filtrar"
type EstadoFiltro = ReservaEstado | "todos";

type ReservasQueryParams = {
  page: number;
  perPage: number;
  search: string;
  estado: EstadoFiltro;
};

/**
 * Obtiene reservas paginadas.
 *
 * @param params - Página, tamaño, búsqueda y estado del filtro.
 */
async function fetchReservas({
  page,
  perPage,
  search,
  estado,
}: ReservasQueryParams): Promise<PaginatedResponse<AdminReserva>> {
  const { data } = await api.get<PaginatedResponse<AdminReserva>>(
    "/api/admin/reservas",
    {
      params: {
        page,
        per_page: perPage,
        q: search || undefined,
        estado: estado === "todos" ? undefined : estado,
      },
    },
  );
  return data;
}

/**
 * Pantalla de gestión de reservas del administrador.
 *
 * @remarks
 * Maneja `page`, `search`, `estado` y `forceDialogOpen`. TanStack Query llama a
 * `GET /api/admin/reservas`. Las modificaciones se hacen con `PATCH` sobre
 * `/api/admin/reservas/{id}/cancelar`.
 */
export default function ReservationManagement() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("Activa");
  const [forceDialogOpen, setForceDialogOpen] = useState(false);

  // Aplicamos el debouncer para evitar peticiones excesivas a la API
  const debouncedSearch = useDebouncedValue(search, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, estado]);

  const queryKey = [
    "admin",
    "reservas",
    { page, perPage: DEFAULT_PER_PAGE, search: debouncedSearch, estado },
  ] as const;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      fetchReservas({
        page,
        perPage: DEFAULT_PER_PAGE,
        search: debouncedSearch,
        estado,
      }),
    placeholderData: keepPreviousData,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id_reserva: number) => {
      await api.patch(`/api/admin/reservas/${id_reserva}/cancelar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reservas"] });
      // Refrescamos el listado de clases para reflejar el cambio de ocupación
      queryClient.invalidateQueries({ queryKey: ["admin", "clases"] });
      toast.success("Reserva cancelada");
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo cancelar la reserva.";
      toast.error("No se pudo cancelar", message);
    },
  });

  const handleCancel = async (reserva: AdminReserva) => {
    const ok = await confirm({
      title: `Cancelar reserva #${reserva.id_reserva}`,
      description: `Se liberará la plaza de ${reserva.cliente.nombre} ${reserva.cliente.apellidos} en ${reserva.clase.actividad} del ${reserva.clase.fecha}.`,
      confirmLabel: "Cancelar reserva",
      variant: "destructive",
    });
    if (!ok) return;
    cancelMutation.mutate(reserva.id_reserva);
  };

  const handleForzarReserva = () => {
    setForceDialogOpen(true);
  };

  const columns = useMemo<ColumnDef<AdminReserva>[]>(
    () => [
      {
        id: "cliente",
        header: "Cliente",
        cell: ({ row }) => <ClienteCell reserva={row.original} />,
      },
      {
        id: "sesion",
        header: "Sesión",
        cell: ({ row }) => <SesionCell reserva={row.original} />,
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
      },
      {
        id: "acciones",
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <RowActions
            reserva={row.original}
            onCancel={() => handleCancel(row.original)}
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
            Gestión de Reservas
          </h1>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Consulta y cancela reservas de cualquier cliente del centro.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleForzarReserva}
          className="h-10 w-auto px-4"
        >
          + Forzar Reserva
        </Button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#e0e2e6] bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor="reservas-search" className="sr-only">
            Buscar reserva
          </label>
          <Input
            id="reservas-search"
            type="search"
            placeholder="Buscar por cliente o clase…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="reservas-estado" className="sr-only">
            Filtrar por estado
          </label>
          <select
            id="reservas-estado"
            value={estado}
            onChange={(event) => setEstado(event.target.value as EstadoFiltro)}
            className={cn(
              "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
              "px-3 text-base tracking-[0.08px] text-[#181d26]",
              "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
            )}
          >
            <option value="Activa">Activas</option>
            <option value="Cancelada">Canceladas</option>
            <option value="todos">Todas</option>
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
                  Cargando reservas…
                </TableStateRow>
              ) : isError ? (
                <TableStateRow colSpan={columns.length}>
                  <div className="flex flex-col items-center gap-2 py-4">
                    <span className="text-[#b3261e]">
                      No se pudo cargar el listado de reservas.
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
                  No hay reservas que coincidan con los filtros.
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
              ? "0 reservas"
              : `${data?.meta.from ?? 0}–${data?.meta.to ?? 0} de ${total} reservas`}
            {isFetching && !isLoading ? " · actualizando…" : null}
          </span>
          <div className="flex items-center gap-2">
            <PagerButton
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
            >
              Anterior
            </PagerButton>
            <span className="px-2 text-xs">
              Página {data?.meta.current_page ?? page} de {lastPage}
            </span>
            <PagerButton
              onClick={() => setPage((prev) => Math.min(lastPage, prev + 1))}
              disabled={page >= lastPage || isLoading}
            >
              Siguiente
            </PagerButton>
          </div>
        </div>
      </div>

      <ForceReservationDialog
        open={forceDialogOpen}
        onClose={() => setForceDialogOpen(false)}
      />
    </section>
  );
}

function ClienteCell({ reserva }: { reserva: AdminReserva }) {
  const { cliente } = reserva;
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-medium text-[rgba(4,14,32,0.87)]">
        <span className="font-mono text-xs text-[rgba(4,14,32,0.55)]">
          #{cliente.id_usuario}
        </span>{" "}
        {cliente.nombre} {cliente.apellidos}
      </span>
      <span className="text-xs text-[rgba(4,14,32,0.55)]">{cliente.email}</span>
    </div>
  );
}

function SesionCell({ reserva }: { reserva: AdminReserva }) {
  const { clase } = reserva;
  // Parseo manual para evitar desplazamientos por zona horaria: la fecha
  // viene como `yyyy-mm-dd` y si usase `new Date("2026-04-21")` saldría como
  // UTC y en es-ES se mostraría el día anterior al usuario
  const [y, m, d] = clase.fecha.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const fechaCorta = start.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
  const horaInicio = clase.hora_inicio.slice(0, 5);
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-medium text-[rgba(4,14,32,0.87)]">
        {clase.actividad}
        <span className="mx-2 text-[rgba(4,14,32,0.35)]">|</span>
        <span className="font-normal text-[rgba(4,14,32,0.75)]">
          {fechaCorta} {horaInicio}
        </span>
      </span>
      <span className="text-xs text-[rgba(4,14,32,0.55)]">{clase.sala}</span>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: ReservaEstado }) {
  const variant = estado === "Activa" ? "activa" : "cancelada";
  return <Badge variant={variant}>{estado}</Badge>;
}

function RowActions({
  reserva,
  onCancel,
}: {
  reserva: AdminReserva;
  onCancel: () => void;
}) {
  const yaCancelada = reserva.estado === "Cancelada";
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Acciones sobre la reserva #${reserva.id_reserva}`}
        >
          <DotsVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {yaCancelada ? (
            <DropdownMenuItem disabled>
              Sin acciones disponibles
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem destructive onClick={onCancel}>
              Cancelar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PagerButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border border-[#e0e2e6] px-3 py-1.5 text-sm font-medium",
        "transition-colors hover:bg-[#f1f5f9]",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {children}
    </button>
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
