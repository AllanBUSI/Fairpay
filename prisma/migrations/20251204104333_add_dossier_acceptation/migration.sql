-- CreateEnum
CREATE TYPE "DossierAcceptation" AS ENUM ('PAS_ENCORE_CHOISI', 'ACCEPTE', 'REFUSE');

-- AlterTable
ALTER TABLE "mises_en_demeure" ADD COLUMN     "acceptation" "DossierAcceptation" NOT NULL DEFAULT 'PAS_ENCORE_CHOISI';
