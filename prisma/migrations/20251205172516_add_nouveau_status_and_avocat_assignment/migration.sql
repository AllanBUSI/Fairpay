-- AlterEnum - Step 1: Add the new enum value
ALTER TYPE "ProcedureStatus" ADD VALUE IF NOT EXISTS 'NOUVEAU';

-- AlterTable - Step 2: Add the avocatId column
ALTER TABLE "mises_en_demeure" ADD COLUMN IF NOT EXISTS "avocatId" TEXT;

-- AlterTable - Step 3: Set default status (this must be in a separate transaction)
-- Note: We'll set the default in a separate step after the enum value is committed

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'mises_en_demeure_avocatId_fkey'
    ) THEN
        ALTER TABLE "mises_en_demeure" 
        ADD CONSTRAINT "mises_en_demeure_avocatId_fkey" 
        FOREIGN KEY ("avocatId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
