-- Dirección de entrega del pedido: copia de la dirección elegida por el comprador al confirmar
-- (igual que el precio unitario, no cambia si después edita sus direcciones).
-- Opcional: los pedidos creados antes de este cambio no la tienen.
ALTER TABLE "orders"
  ADD COLUMN "shipping_street" TEXT,
  ADD COLUMN "shipping_city" TEXT,
  ADD COLUMN "shipping_country" TEXT,
  ADD COLUMN "shipping_postal_code" TEXT;
