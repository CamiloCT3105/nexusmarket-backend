// Copia profunda de lo que entra y sale del almacenamiento en memoria.
// Así el repositorio se comporta como una base de datos real: modificar un objeto
// devuelto NO cambia lo guardado; para persistir un cambio hay que llamar a update().
export function clone<T>(value: T): T {
  return structuredClone(value);
}
