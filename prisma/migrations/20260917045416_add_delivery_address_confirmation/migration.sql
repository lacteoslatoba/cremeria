-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "addressLat" DOUBLE PRECISION,
ADD COLUMN     "addressLng" DOUBLE PRECISION,
ALTER COLUMN "address" DROP NOT NULL;
