-- AlterTable: horario de pedidos editable desde el admin (solo agrega columnas con default)
ALTER TABLE "Business" ADD COLUMN     "aperturaMin" INTEGER NOT NULL DEFAULT 480,
ADD COLUMN     "cierreMin" INTEGER NOT NULL DEFAULT 960;
