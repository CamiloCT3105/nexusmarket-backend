-- DropIndex
DROP INDEX "buyer_addresses_buyer_id_idx";

-- AlterTable
ALTER TABLE "buyer_addresses" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "buyer_addresses_buyer_id_position_idx" ON "buyer_addresses"("buyer_id", "position");
