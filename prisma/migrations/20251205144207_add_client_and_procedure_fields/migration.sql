-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "email" TEXT,
ADD COLUMN     "nomSociete" TEXT,
ADD COLUMN     "telephone" TEXT;

-- AlterTable
ALTER TABLE "mises_en_demeure" ADD COLUMN     "montantTTC" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "numeroFacture" TEXT;
