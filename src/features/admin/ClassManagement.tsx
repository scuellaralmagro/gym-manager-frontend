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
import { useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useConfirm } from "../../components/ui/use-confirm";
import { useToast } from "../../components/ui/use-toast";
import api from "../../lib/axios";
import { cn } from "../../lib/utils";
import type {
  AdminClase,
  CatalogResponse,
  EntrenadorOption,
} from "../../types/clase";
import type { PaginatedResponse } from "../../types/usuario";
import ActividadManagementDialog from "./ActividadManagementDialog";
import ClassFormDialog from "./ClassFormDialog";
import SalaManagementDialog from "./SalaManagementDialog";

type SortKey = "fecha" | "hora_inicio" | "cupo_maximo";
type SortDirection = "asc" | "desc";

type ClasesQueryParams = {
  page: number;
  perPage: number;
  fechaDesde: string;
  fechaHasta: string;
  idUsuario: number | null;
  sort: SortKey;
  direction: SortDirection;
};

/**
 * Obtiene el listado paginado de clases para administración.
 *
 * @param params - Filtros, paginación y ordenación de la tabla.
 * @returns Página de clases recibida de `/api/admin/clases`.
 */
async function fetchClases(
  params: ClasesQueryParams,
): Promise<PaginatedResponse<AdminClase>> {
  const { data } = await api.get<PaginatedResponse<AdminClase>>(
    "/api/admin/clases",
    {
      params: {
        page: params.page,
        per_page: params.perPage,
        fecha_desde: params.fechaDesde || undefined,
        fecha_hasta: params.fechaHasta || undefined,
        id_usuario: params.idUsuario ?? undefined,
        sort: params.sort,
        direction: params.direction,
      },
    },
  );
  return data;
}

/**
 * Carga los entrenadores usados por el filtro de la tabla.
 */
async function fetchEntrenadores(): Promise<EntrenadorOption[]> {
  const { data } = await api.get<CatalogResponse<EntrenadorOption>>(
    "/api/admin/entrenadores",
  );
  return data.data;
}

const DEFAULT_PER_PAGE = 10;

/**
 * Pantalla de gestión de oferta y clases del administrador.
 *
 * @remarks
 * Maneja estados de filtros (`page`, fechas, entrenador, ordenación) y modales
 * (`dialogClase`, `salasOpen`, `actividadesOpen`). TanStack Query consulta
 * `/api/admin/clases` y `/api/admin/entrenadores`; las clases se borran
 * con `DELETE /api/admin/clases/{id}`.
 */
export default function ClassManagement() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [page, setPage] = useState(1);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [idUsuario, setIdUsuario] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("fecha");
  const [direction, setDirection] = useState<SortDirection>("asc");
  // Un único estado "dialogClase" cubre los dos modos: si es undefined el dialogo está cerrado, null = crear, AdminClase = editar esa clase
  const [dialogClase, setDialogClase] = useState<AdminClase | null | undefined>(
    undefined,
  );
  const [salasOpen, setSalasOpen] = useState(false);
  const [actividadesOpen, setActividadesOpen] = useState(false);

  const clasesParams: ClasesQueryParams = {
    page,
    perPage: DEFAULT_PER_PAGE,
    fechaDesde,
    fechaHasta,
    idUsuario,
    sort,
    direction,
  };

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin", "clases", clasesParams] as const,
    queryFn: () => fetchClases(clasesParams),
    placeholderData: keepPreviousData,
  });

  // Catálogo de entrenadores para el filtro
  const entrenadoresQuery = useQuery({
    queryKey: ["admin", "entrenadores"] as const,
    queryFn: fetchEntrenadores,
    staleTime: 5 * 60000, // Refresco cada 5 minutos
  });

  const deleteMutation = useMutation({
    mutationFn: async (id_clase: number) => {
      await api.delete(`/api/admin/clases/${id_clase}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "clases"] });
      toast.success("Clase eliminada");
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "No se pudo eliminar la clase.";
      toast.error("No se pudo eliminar", message);
    },
  });

  // Eliminación de una clase con confirmación

  const handleDelete = async (clase: AdminClase) => {
    const ok = await confirm({
      title: `Eliminar clase de ${clase.actividad}`,
      description: `Se borrará la sesión del ${clase.fecha} y todas sus reservas asociadas.`,
      confirmLabel: "Eliminar",
      variant: "destructive",
    });
    if (!ok) return;
    deleteMutation.mutate(clase.id_clase);
  };

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDirection("asc");
    }
    setPage(1);
  };

  const handleFilterReset = () => {
    setFechaDesde("");
    setFechaHasta("");
    setIdUsuario(null);
    setPage(1);
  };

  const columns = useMemo<ColumnDef<AdminClase>[]>(
    () => [
      {
        id: "fecha",
        header: () => (
          <SortableHeader
            label="Fecha y hora"
            active={sort === "fecha"}
            direction={direction}
            onClick={() => handleSort("fecha")}
          />
        ),
        cell: ({ row }) => <FechaHoraCell clase={row.original} />,
      },
      {
        accessorKey: "actividad",
        header: "Actividad",
        cell: ({ row }) => (
          <span className="font-medium text-[rgba(4,14,32,0.87)]">
            {row.original.actividad}
          </span>
        ),
      },
      {
        id: "entrenador_sala",
        header: "Entrenador / Sala",
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="text-[rgba(4,14,32,0.85)]">
              {row.original.entrenador.nombre}{" "}
              {row.original.entrenador.apellidos}
            </span>
            <span className="text-xs text-[rgba(4,14,32,0.55)]">
              {row.original.sala}
            </span>
          </div>
        ),
      },
      {
        id: "cupo",
        header: () => (
          <SortableHeader
            label="Cupo"
            active={sort === "cupo_maximo"}
            direction={direction}
            onClick={() => handleSort("cupo_maximo")}
          />
        ),
        cell: ({ row }) => <CupoCell clase={row.original} />,
      },
      {
        id: "acciones",
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <RowActions
            clase={row.original}
            onEdit={() => setDialogClase(row.original)}
            onDelete={() => handleDelete(row.original)}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, direction],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: data?.meta.last_page ?? -1,
  });

  const total = data?.meta.total ?? 0;
  const lastPage = data?.meta.last_page ?? 1;
  const filtersApplied =
    Boolean(fechaDesde) || Boolean(fechaHasta) || idUsuario !== null;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            Gestión de Oferta / Clases
          </h1>
          <p className="mt-1 text-sm text-[rgba(4,14,32,0.69)]">
            Programa y mantén el catálogo semanal de sesiones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryLink onClick={() => setSalasOpen(true)}>
            Gestionar Salas
          </SecondaryLink>
          <SecondaryLink onClick={() => setActividadesOpen(true)}>
            Gestionar Actividades
          </SecondaryLink>
          <Button
            type="button"
            onClick={() => setDialogClase(null)}
            className="h-10 w-auto px-4"
          >
            + Programar Nueva Clase
          </Button>
        </div>
      </header>

      <div className="grid gap-3 rounded-2xl border border-[#e0e2e6] bg-white p-4 sm:grid-cols-4 sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="clases-desde">Desde</Label>
          <Input
            id="clases-desde"
            type="date"
            value={fechaDesde}
            onChange={(event) => {
              setFechaDesde(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clases-hasta">Hasta</Label>
          <Input
            id="clases-hasta"
            type="date"
            value={fechaHasta}
            onChange={(event) => {
              setFechaHasta(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="clases-entrenador">Entrenador</Label>
          <div className="flex gap-2">
            <select
              id="clases-entrenador"
              value={idUsuario ?? ""}
              onChange={(event) => {
                setIdUsuario(
                  event.target.value ? Number(event.target.value) : null,
                );
                setPage(1);
              }}
              className={cn(
                "flex h-11 w-full rounded-[12px] border border-[#e0e2e6] bg-white",
                "px-3 text-base tracking-[0.08px] text-[#181d26]",
                "focus-visible:border-[#1b61c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b61c9]/30",
              )}
            >
              <option value="">Todos los entrenadores</option>
              {entrenadoresQuery.data?.map((entrenador) => (
                <option
                  key={entrenador.id_usuario}
                  value={entrenador.id_usuario}
                >
                  {entrenador.nombre} {entrenador.apellidos}
                </option>
              ))}
            </select>
            {filtersApplied && (
              <button
                type="button"
                onClick={handleFilterReset}
                className="shrink-0 rounded-lg border border-[#e0e2e6] px-3 text-sm font-medium text-[rgba(4,14,32,0.75)] hover:bg-[#f1f5f9]"
              >
                Limpiar
              </button>
            )}
          </div>
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
                  Cargando clases…
                </TableStateRow>
              ) : isError ? (
                <TableStateRow colSpan={columns.length}>
                  <div className="flex flex-col items-center gap-2 py-4">
                    <span className="text-[#b3261e]">
                      No se pudo cargar la oferta de clases.
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
                  No hay clases programadas que coincidan con los filtros.
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
              ? "0 clases"
              : `${data?.meta.from ?? 0}–${data?.meta.to ?? 0} de ${total} clases`}
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

      <ClassFormDialog
        open={dialogClase !== undefined}
        clase={dialogClase ?? null}
        onClose={() => setDialogClase(undefined)}
      />

      <SalaManagementDialog
        open={salasOpen}
        onClose={() => setSalasOpen(false)}
      />

      <ActividadManagementDialog
        open={actividadesOpen}
        onClose={() => setActividadesOpen(false)}
      />
    </section>
  );
}

/**
 * Encabezado de tabla ordenable según parámetros
 */
function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-wider",
        active ? "text-[#1b61c9]" : "text-[rgba(4,14,32,0.55)]",
      )}
    >
      {label}
      <span aria-hidden className="text-xs">
        {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

/**
 * Celda de tabla que muestra fecha y franja horaria de una clase.
 */
function FechaHoraCell({ clase }: { clase: AdminClase }) {
  const [y, m, d] = clase.fecha.split("-").map(Number);
  const [hiH, hiM] = clase.hora_inicio.split(":").map(Number);
  const start = new Date(y, m - 1, d, hiH, hiM);
  const fechaLegible = start.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const horaInicio = clase.hora_inicio.slice(0, 5);
  const horaFin = clase.hora_fin.slice(0, 5);
  return (
    <div className="flex flex-col leading-tight">
      <span className="font-medium text-[rgba(4,14,32,0.87)]">
        {fechaLegible}
      </span>
      <span className="text-xs text-[rgba(4,14,32,0.55)]">
        {horaInicio} – {horaFin}
      </span>
    </div>
  );
}

/**
 * Celda de ocupación con contador y barra visual.
 */
function CupoCell({ clase }: { clase: AdminClase }) {
  const ocupadas = clase.reservas_activas;
  const total = clase.cupo_maximo;
  const ratio = total > 0 ? Math.min(1, ocupadas / total) : 0;
  // Color cambiando según el ratio de ocupación
  const color = ratio >= 0.9 ? "#b3261e" : ratio >= 0.7 ? "#8a5a00" : "#146c43";
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-sm" style={{ color }}>
        {ocupadas}/{total}
      </span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#eef1f5]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(ratio * 100)}%`,
            backgroundColor: color,
          }} // Ancho del color según el ratio de ocupación
        />
      </div>
    </div>
  );
}

/**
 * Menú de acciones de una fila de clase.
 */
function RowActions({
  clase,
  onEdit,
  onDelete,
}: {
  clase: AdminClase;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Acciones sobre la clase #${clase.id_clase}`}
        >
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

function SecondaryLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center rounded-lg border border-[#e0e2e6] bg-white px-3",
        "text-sm font-medium text-[rgba(4,14,32,0.75)] transition-colors",
        "hover:bg-[#f1f5f9]",
      )}
    >
      {children}
    </button>
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
