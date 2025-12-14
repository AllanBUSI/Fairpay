-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "dateFactureEchue" TIMESTAMP(3),
ADD COLUMN     "montantDue" DOUBLE PRECISION,
ADD COLUMN     "montantTTC" BOOLEAN;
