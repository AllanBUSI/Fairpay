-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('FACTURE', 'DEVIS', 'CONTRAT', 'EMAIL', 'WHATSAPP_SMS', 'AUTRES_PREUVES');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "mises_en_demeure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
