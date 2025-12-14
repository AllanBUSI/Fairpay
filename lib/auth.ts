import { NextRequest } from "next/server";
import { verifyToken, extractTokenFromHeader, JWTPayload } from "./jwt";
import { prisma } from "./prisma";
import { UserRole } from "@/app/generated/prisma/enums";

/**
 * Génère un code à 6 chiffres aléatoire
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export interface AuthUser extends JWTPayload {
  role: UserRole;
}

/**
 * Récupère l'utilisateur authentifié depuis le token JWT avec son rôle
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    // Essayer aussi depuis les cookies pour SSR
    const cookies = request.cookies.get("token");
    if (cookies?.value) {
      const decoded = verifyToken(cookies.value);
      if (!decoded) return null;
      
      // Récupérer le rôle depuis la base de données
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { role: true },
      });
      
      if (!user) return null;
      
      return {
        ...decoded,
        role: user.role,
      };
    }
    return null;
  }

  const decoded = verifyToken(token);
  if (!decoded) return null;
  
  // Récupérer le rôle depuis la base de données
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { role: true },
  });
  
  if (!user) return null;
  
  return {
    ...decoded,
    role: user.role,
  };
}

/**
 * Vérifie si l'utilisateur est authentifié
 * Retourne null si non authentifié (pour permettre à l'appelant de gérer l'erreur)
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser | null> {
  return await getAuthUser(request);
}
