/*
  Warnings:

  - You are about to drop the column `numeroFacture` on the `mises_en_demeure` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "numeroFacture" TEXT;

-- AlterTable
ALTER TABLE "mises_en_demeure" DROP COLUMN "numeroFacture";
