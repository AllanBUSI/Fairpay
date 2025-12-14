-- CreateTable
CREATE TABLE "retour_requests" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedFrom" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "retour_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "retour_requests" ADD CONSTRAINT "retour_requests_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "mises_en_demeure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retour_requests" ADD CONSTRAINT "retour_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
