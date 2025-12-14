import { UserRole } from "@/app/generated/prisma/enums";

export interface UserPermissions {
  canViewDossier: boolean;
  canCommentDossier: boolean;
  canValidateDossier: boolean;
  canAddUser: boolean;
  canUploadDocuments: boolean;
}

/**
 * Retourne les permissions d'un utilisateur selon son rôle
 */
export function getUserPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case UserRole.AVOCAT:
      return {
        canViewDossier: true,
        canCommentDossier: true,
        canValidateDossier: true,
        canAddUser: true,
        canUploadDocuments: true,
      };
    case UserRole.JURISTE:
      return {
        canViewDossier: true,
        canCommentDossier: true,
        canValidateDossier: false,
        canAddUser: false,
        canUploadDocuments: false,
      };
    case UserRole.USER:
    default:
      return {
        canViewDossier: true, // Les utilisateurs peuvent consulter leurs propres dossiers
        canCommentDossier: true, // Les utilisateurs peuvent envoyer des messages
        canValidateDossier: false,
        canAddUser: false,
        canUploadDocuments: true, // Les utilisateurs peuvent uploader des fichiers
      };
  }
}

/**
 * Vérifie si un utilisateur peut consulter un dossier
 */
export function canViewDossier(role: UserRole): boolean {
  return getUserPermissions(role).canViewDossier;
}

/**
 * Vérifie si un utilisateur peut commenter un dossier
 */
export function canCommentDossier(role: UserRole): boolean {
  return getUserPermissions(role).canCommentDossier;
}

/**
 * Vérifie si un utilisateur peut valider un dossier
 */
export function canValidateDossier(role: UserRole): boolean {
  return getUserPermissions(role).canValidateDossier;
}

/**
 * Vérifie si un utilisateur peut ajouter un utilisateur
 */
export function canAddUser(role: UserRole): boolean {
  return getUserPermissions(role).canAddUser;
}

/**
 * Vérifie si un utilisateur peut uploader des documents
 */
export function canUploadDocuments(role: UserRole): boolean {
  return getUserPermissions(role).canUploadDocuments;
}

