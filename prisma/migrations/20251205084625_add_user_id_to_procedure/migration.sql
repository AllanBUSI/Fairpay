-- AlterTable
ALTER TABLE "mises_en_demeure" ADD COLUMN "userId" TEXT;

-- Pour les données existantes, on va les associer au premier utilisateur disponible
-- ou créer un utilisateur système si aucun n'existe
DO $$
DECLARE
    first_user_id TEXT;
BEGIN
    -- Récupérer le premier utilisateur disponible
    SELECT id INTO first_user_id FROM "users" LIMIT 1;
    
    -- Si aucun utilisateur n'existe, créer un utilisateur système
    IF first_user_id IS NULL THEN
        INSERT INTO "users" (id, email, code, role, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'system@fairpay.com', '000000', 'USER', NOW(), NOW())
        RETURNING id INTO first_user_id;
    END IF;
    
    -- Mettre à jour les procédures existantes avec le premier utilisateur
    UPDATE "mises_en_demeure" SET "userId" = first_user_id WHERE "userId" IS NULL;
END $$;

-- Maintenant on peut rendre la colonne obligatoire
ALTER TABLE "mises_en_demeure" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "mises_en_demeure" ADD CONSTRAINT "mises_en_demeure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
