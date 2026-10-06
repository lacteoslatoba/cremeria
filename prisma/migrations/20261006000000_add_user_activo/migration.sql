-- AlterTable: el admin activa/desactiva repartidores (solo agrega una columna con default true)
ALTER TABLE "User" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;
