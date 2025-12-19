"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Chat } from "@/components/ui/chat";
import { UserRole } from "@/app/generated/prisma/enums";
import { canCommentDossier } from "@/lib/permissions";

interface Procedure {
  id: string;
  contexte: string;
  status: string;
  avocatId: string | null;
  client: {
    id: string;
    nom: string;
    prenom: string;
    nomSociete: string | null;
  };
}

interface User {
  id: string;
  email: string;
  role: UserRole;
}

interface Client {
  id: string;
  nom: string;
  prenom: string;
  nomSociete: string | null;
}

export default function ChatAvocatPage() {
  const router = useRouter();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUserAndProcedures();
  }, []);

  const fetchUserAndProcedures = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Récupérer l'utilisateur
      const userResponse = await fetch("/api/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let currentUser: User | null = null;
      if (userResponse.ok) {
        const userData = await userResponse.json();
        currentUser = userData.user;
        setUser(currentUser);
      } else if (userResponse.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      // Récupérer les procédures de l'avocat (tous les statuts sauf brouillons)
      // On utilise un paramètre pour forcer le filtre côté serveur
      const proceduresResponse = await fetch("/api/procedures?status=all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (proceduresResponse.ok) {
        const proceduresData = await proceduresResponse.json();
        // Filtrer pour ne garder que les procédures assignées à cet avocat (exclure les null)
        const proceduresAssigned = (proceduresData.procedures || []).filter(
          (p: Procedure) => currentUser && p.avocatId !== null && p.avocatId === currentUser.id
        );
        setProcedures(proceduresAssigned);
        console.log(`[ChatAvocat] ${proceduresAssigned.length} dossiers assignés trouvés sur ${proceduresData.procedures?.length || 0} dossiers totaux`);
      } else {
        setError("Erreur lors du chargement des dossiers");
      }
    } catch (err) {
      console.error("Erreur lors du chargement:", err);
      setError("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // Obtenir la liste unique des clients
  const uniqueClients = Array.from(
    new Map(
      procedures.map((p) => [
        p.client.id,
        {
          id: p.client.id,
          nom: p.client.nom,
          prenom: p.client.prenom,
          nomSociete: p.client.nomSociete,
        },
      ])
    ).values()
  );

  // Filtrer les procédures par client sélectionné
  const proceduresForSelectedClient = selectedClientId
    ? procedures.filter((p) => p.client.id === selectedClientId)
    : [];

  const selectedProcedure = procedures.find((p) => p.id === selectedProcedureId);
  const selectedClient = uniqueClients.find((c) => c.id === selectedClientId);

  // Réinitialiser la sélection du dossier quand on change de client
  useEffect(() => {
    setSelectedProcedureId("");
  }, [selectedClientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#16A34A]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
        <p className="text-[#64748B] text-lg">Erreur de chargement de l'utilisateur</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A] flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-[#16A34A]" />
            Chat avec les clients
          </h1>
          <p className="text-[#64748B] mt-2">
            Sélectionnez d'abord un client, puis un dossier pour discuter.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {procedures.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-[#E5E7EB]">
          <FileText className="h-12 w-12 text-[#94A3B8] mx-auto mb-4" />
          <p className="text-[#64748B] text-lg mb-2">
            Aucun dossier assigné
          </p>
          <p className="text-[#94A3B8] text-sm mb-4">
            Vous n'avez aucun dossier assigné pour le moment.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sélection du client */}
          <div className="bg-white rounded-lg border-2 border-[#E5E7EB] p-6">
            <label htmlFor="client-select" className="block text-sm font-semibold text-[#0F172A] mb-3">
              Sélectionner un client
            </label>
            <Select
              id="client-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full"
            >
              <option value="">-- Choisir un client --</option>
              {uniqueClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nomSociete || `${client.prenom} ${client.nom}`}
                </option>
              ))}
            </Select>
            {selectedClient && (
              <div className="mt-4 p-4 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                <p className="text-sm text-[#64748B]">
                  <span className="font-semibold text-[#0F172A]">Client sélectionné :</span>{" "}
                  {selectedClient.nomSociete || `${selectedClient.prenom} ${selectedClient.nom}`}
                </p>
              </div>
            )}
          </div>

          {/* Sélection du dossier (seulement si un client est sélectionné) */}
          {selectedClientId && (
            <div className="bg-white rounded-lg border-2 border-[#E5E7EB] p-6">
              <label htmlFor="procedure-select" className="block text-sm font-semibold text-[#0F172A] mb-3">
                Sélectionner un dossier
              </label>
              <Select
                id="procedure-select"
                value={selectedProcedureId}
                onChange={(e) => setSelectedProcedureId(e.target.value)}
                className="w-full"
                disabled={!selectedClientId}
              >
                <option value="">-- Choisir un dossier --</option>
                {proceduresForSelectedClient.map((procedure) => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.contexte}
                  </option>
                ))}
              </Select>
              {selectedProcedure && (
                <div className="mt-4 p-4 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-sm text-[#64748B]">
                    <span className="font-semibold text-[#0F172A]">Client :</span>{" "}
                    {selectedProcedure.client.nomSociete || 
                     `${selectedProcedure.client.prenom} ${selectedProcedure.client.nom}`}
                  </p>
                  <p className="text-sm text-[#64748B] mt-1">
                    <span className="font-semibold text-[#0F172A]">Contexte :</span>{" "}
                    {selectedProcedure.contexte}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Chat */}
          {selectedProcedureId && user && (
            <div className="bg-white rounded-lg border-2 border-[#E5E7EB] overflow-hidden" style={{ height: "700px" }}>
              <Chat
                procedureId={selectedProcedureId}
                currentUserRole={user.role}
                currentUserId={user.id}
                canComment={user.role === UserRole.USER || canCommentDossier(user.role)}
                onMessageSent={() => {
                  // Optionnel : rafraîchir les données si nécessaire
                }}
              />
            </div>
          )}

          {!selectedClientId && (
            <div className="bg-white rounded-lg border-2 border-[#E5E7EB] p-12 text-center">
              <MessageSquare className="h-16 w-16 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-[#64748B] text-lg">
                Sélectionnez d'abord un client ci-dessus
              </p>
            </div>
          )}

          {selectedClientId && !selectedProcedureId && (
            <div className="bg-white rounded-lg border-2 border-[#E5E7EB] p-12 text-center">
              <MessageSquare className="h-16 w-16 text-[#94A3B8] mx-auto mb-4" />
              <p className="text-[#64748B] text-lg">
                Sélectionnez maintenant un dossier pour commencer à discuter
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

