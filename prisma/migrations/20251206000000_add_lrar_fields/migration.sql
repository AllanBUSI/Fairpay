-- AlterTable
ALTER TABLE "mises_en_demeure" ADD COLUMN IF NOT EXISTS "penalites" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "mises_en_demeure" ADD COLUMN IF NOT EXISTS "dateEnvoiLRAR" TIMESTAMP(3);
ALTER TABLE "mises_en_demeure" ADD COLUMN IF NOT EXISTS "commentaireLRAR" TEXT;

