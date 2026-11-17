// Errores de la aplicación. Cada uno sabe qué código HTTP le corresponde,
// así los servicios expresan QUÉ pasó y el middleware central decide la respuesta.
// Los servicios no conocen HTTP: solo eligen la clase de error adecuada.

export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = new.target.name;
  }
}

// Datos inválidos o regla de negocio incumplida
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

// Sin identificar: falta token, token inválido o credenciales incorrectas
export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

// Identificado, pero sin permiso (rol, propiedad o cuenta bloqueada)
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

// El recurso pedido no existe
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

// El recurso ya existe (correo duplicado, factura repetida, etc.)
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
