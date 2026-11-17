// Las llaves primarias de PostgreSQL son UUID. Un id con otro formato (ej: "abc")
// haría fallar la consulta con un error de sintaxis (500); como ese registro no puede
// existir, los repositorios responden "no encontrado" sin consultar la base de datos.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
