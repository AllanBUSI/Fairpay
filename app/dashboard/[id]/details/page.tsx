"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, CheckCircle2, X, Loader2, Eye, ChevronUp, ChevronDown } from "lucide-react";
import { UserRole } from "@/app/generated/prisma/enums";
import { DocumentViewer } from "@/components/ui/document-viewer";

interface Document {
  id: string;
  type: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

interface Client {
  id: string;
  nom: string;
  prenom: string;
  siret: string;
  nomSociete: string | null;
  email: string | null;
  telephone: string | null;
}

interface Procedure {
  id: string;
  contexte: string;
  dateFactureEchue: string;
  montantDue: number | null;
  status: string;
  client: Client;
  documents: Document[];
}

export default function ProcedureDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const procedureId = params.id as string;
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [selectedDocumentsOrder, setSelectedDocumentsOrder] = useState<string[]>([]); // Ordre de fusion
  const [merging, setMerging] = useState(false);
  const [user, setUser] = useState<{ id: string; role: UserRole } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        // Vérifier l'utilisateur
        const userResponse = await fetch("/api/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!userResponse.ok) {
          if (userResponse.status === 401) {
            localStorage.removeItem("token");
            router.push("/login");
            return;
          }
          throw new Error("Erreur lors de la récupération de l'utilisateur");
        }

        const userData = await userResponse.json();
        const user = userData.user;
        setUser({ id: user.id, role: user.role });

        // Vérifier que c'est un avocat
        if (user.role !== UserRole.AVOCAT) {
          setError("Accès réservé aux avocats");
          setLoading(false);
          return;
        }

        // Charger la procédure
        const response = await fetch(`/api/procedures/${procedureId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }
          throw new Error("Erreur lors du chargement de la procédure");
        }

        const data = await response.json();
        setProcedure(data.procedure);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [procedureId, router]);

  const toggleDocument = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    const newOrder = [...selectedDocumentsOrder];
    
    if (newSelected.has(documentId)) {
      // Désélectionner
      newSelected.delete(documentId);
      setSelectedDocumentsOrder(newOrder.filter(id => id !== documentId));
    } else {
      // Sélectionner et ajouter à la fin de l'ordre
      newSelected.add(documentId);
      newOrder.push(documentId);
    }
    
    setSelectedDocuments(newSelected);
    setSelectedDocumentsOrder(newOrder);
  };

  const selectAll = () => {
    if (!procedure) return;
    const documentsToSelect = procedure.documents.filter(
      (doc) => isPDF(doc.mimeType) || isImage(doc.mimeType)
    );
    const allIds = new Set(documentsToSelect.map((doc) => doc.id));
    const allIdsOrder = documentsToSelect.map((doc) => doc.id);
    setSelectedDocuments(allIds);
    setSelectedDocumentsOrder(allIdsOrder);
  };

  const deselectAll = () => {
    setSelectedDocuments(new Set());
    setSelectedDocumentsOrder([]);
  };

  const moveDocumentUp = (documentId: string) => {
    const currentIndex = selectedDocumentsOrder.indexOf(documentId);
    if (currentIndex > 0) {
      const newOrder = [...selectedDocumentsOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
        newOrder[currentIndex],
        newOrder[currentIndex - 1],
      ];
      setSelectedDocumentsOrder(newOrder);
    }
  };

  const moveDocumentDown = (documentId: string) => {
    const currentIndex = selectedDocumentsOrder.indexOf(documentId);
    if (currentIndex < selectedDocumentsOrder.length - 1 && currentIndex !== -1) {
      const newOrder = [...selectedDocumentsOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
        newOrder[currentIndex + 1],
        newOrder[currentIndex],
      ];
      setSelectedDocumentsOrder(newOrder);
    }
  };

  const handleMergeAndReview = async () => {
    if (selectedDocuments.size === 0) {
      setError("Veuillez sélectionner au moins un document");
      return;
    }

    setMerging(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Utiliser l'ordre défini par selectedDocumentsOrder
      // Filtrer pour ne garder que les documents qui sont réellement sélectionnés
      const orderedDocumentIds = selectedDocumentsOrder.filter(id => selectedDocuments.has(id));
      
      // Vérifier que tous les documents sélectionnés sont dans l'ordre
      if (orderedDocumentIds.length !== selectedDocuments.size) {
        // Si certains documents sélectionnés ne sont pas dans l'ordre, les ajouter à la fin
        const missingIds = Array.from(selectedDocuments).filter(id => !orderedDocumentIds.includes(id));
        orderedDocumentIds.push(...missingIds);
      }
      
      console.log("Documents sélectionnés:", Array.from(selectedDocuments));
      console.log("Ordre actuel:", selectedDocumentsOrder);
      console.log("Envoi des documents dans l'ordre:", orderedDocumentIds);
      
      const response = await fetch(`/api/procedures/${procedureId}/merge-documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentIds: orderedDocumentIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la fusion des documents");
      }

      const data = await response.json();
      // Rediriger vers la page de relecture
      router.push(`/dashboard/${procedureId}/relecture?mergedPdfId=${data.mergedPdfId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la fusion");
    } finally {
      setMerging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !procedure) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!procedure) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border bg-card p-4">Procédure non trouvée</div>
      </div>
    );
  }

  const isPDF = (mimeType: string) => mimeType === "application/pdf";
  const isImage = (mimeType: string) => mimeType.startsWith("image/");

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Détails du dossier</h1>
          <p className="text-muted-foreground mt-1">
            Sélectionnez les documents à envoyer par recommandé
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <X className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>

      {/* Informations du client */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Informations du client</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Nom</p>
            <p className="font-medium">
              {procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">SIRET</p>
            <p className="font-medium">{procedure.client.siret}</p>
          </div>
          {procedure.client.email && (
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{procedure.client.email}</p>
            </div>
          )}
          {procedure.client.telephone && (
            <div>
              <p className="text-sm text-muted-foreground">Téléphone</p>
              <p className="font-medium">{procedure.client.telephone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contexte */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Contexte</h2>
        <p className="text-muted-foreground">{procedure.contexte}</p>
      </div>

      {/* Documents */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Documents</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Tout sélectionner
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Tout désélectionner
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {procedure.documents.length === 0 ? (
          <p className="text-muted-foreground">Aucun document disponible</p>
        ) : (
          <div className="space-y-6">
            {/* Section : Ordre de fusion avec flèches */}
            {selectedDocumentsOrder.length > 0 && (
              <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                <h3 className="text-sm font-semibold text-primary mb-3">
                  Ordre de fusion ({selectedDocumentsOrder.length} document{selectedDocumentsOrder.length > 1 ? "s" : ""})
                </h3>
                <div className="space-y-2">
                  {selectedDocumentsOrder.map((documentId, index) => {
                    const document = procedure.documents.find((doc) => doc.id === documentId);
                    if (!document) return null;

                    return (
                      <div
                        key={documentId}
                        className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-background"
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => moveDocumentUp(documentId)}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => moveDocumentDown(documentId)}
                            disabled={index === selectedDocumentsOrder.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary w-6">
                              {index + 1}.
                            </span>
                            <p className="font-medium text-sm">{document.fileName}</p>
                          </div>
                          <p className="text-xs text-muted-foreground ml-8">
                            {document.type} • {(document.fileSize / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDocument(documentId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section : Tous les documents disponibles */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Documents disponibles
              </h3>
              {procedure.documents.map((document) => {
                const isSelected = selectedDocuments.has(document.id);
                const canMerge = isPDF(document.mimeType) || isImage(document.mimeType);

                // Ne pas afficher les documents déjà sélectionnés dans la liste principale
                if (isSelected) return null;

                return (
                  <div
                    key={document.id}
                    className={`rounded-lg border ${
                      isSelected ? "bg-primary/5 border-primary" : "bg-background"
                    } ${!canMerge ? "opacity-50" : ""}`}
                  >
                    {/* Header du document */}
                    <div className="flex items-center gap-4 p-4 border-b">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDocument(document.id)}
                        disabled={!canMerge}
                      />
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{document.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {document.type} • {(document.fileSize / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      {!canMerge && (
                        <span className="text-xs text-muted-foreground">
                          (Seuls les PDFs et images peuvent être fusionnés)
                        </span>
                      )}
                    </div>
                    
                    {/* Preview du document */}
                    {(isPDF(document.mimeType) || isImage(document.mimeType)) && (
                      <div className="p-4">
                        <DocumentViewer
                          url={document.filePath}
                          mimeType={document.mimeType}
                          fileName={document.fileName}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedDocuments.size > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedDocuments.size} document{selectedDocuments.size > 1 ? "s" : ""} sélectionné
                {selectedDocuments.size > 1 ? "s" : ""}
              </p>
              <Button
                onClick={handleMergeAndReview}
                disabled={merging}
                size="lg"
              >
                {merging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fusion en cours...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Fusionner et relire
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

