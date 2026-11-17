-- Documento de identidad único por usuario (especificación, sección 11: validaciones críticas).
-- Se agrega en tres pasos para no fallar con usuarios ya existentes:

-- 1) Columna opcional
ALTER TABLE "users" ADD COLUMN "document_number" TEXT;

-- 2) Valor temporal único para los usuarios que ya existían (el administrador sembrado
--    lo reemplaza al arrancar si ADMIN_DOCUMENT_NUMBER está configurado)
UPDATE "users" SET "document_number" = 'PENDIENTE-' || "id"::text WHERE "document_number" IS NULL;

-- 3) Obligatoria y única
ALTER TABLE "users" ALTER COLUMN "document_number" SET NOT NULL;
CREATE UNIQUE INDEX "users_document_number_key" ON "users"("document_number");
