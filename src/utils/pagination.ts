// Paginación común a todos los listados: el frontend usa un solo componente de tabla.
//
// Petición:  ?page=1&pageSize=20     (page empieza en 1; pageSize máximo 100)
// Respuesta: { items, page, pageSize, total, totalPages }

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PageRequest = { page: number; pageSize: number };

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// Equivalente para las consultas: cuántos saltar y cuántos traer
export function skipTake({ page, pageSize }: PageRequest): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPage<T>(items: T[], total: number, request: PageRequest): Page<T> {
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    total,
    totalPages: Math.ceil(total / request.pageSize),
  };
}
