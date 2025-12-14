/*
  Warnings:

  - You are about to drop the `retour_requests` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "retour_requests" DROP CONSTRAINT "retour_requests_procedureId_fkey";

-- DropForeignKey
ALTER TABLE "retour_requests" DROP CONSTRAINT "retour_requests_requestedBy_fkey";

-- AlterTable
ALTER TABLE "mises_en_demeure" ADD COLUMN     "analysed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "miseEnDemeure" TEXT;

-- DropTable
DROP TABLE "retour_requests";
