"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, X, Loader2, CheckCircle2, Send, MapPin, User, Building2, Mail, Phone, Calendar, Euro } from "lucide-react";
import { DocumentViewer } from "@/components/ui/document-viewer";

interface Client {
  id: string;
  nom: string;
  prenom: string;
  siret: string;
  nomSociete: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
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
  documents: Array<{ id: string; fileName: string; filePath: string }>;
}

export default function RelecturePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const procedureId = params.id as string;
  const mergedPdfId = searchParams.get("mergedPdfId");
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Adresse de destination
  const [destinationAddress, setDestinationAddress] = useState({
    nom: "",
    prenom: "",
    nomSociete: "",
    adresse: "",
    codePostal: "",
    ville: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!mergedPdfId) {
        setError("ID du document fusionné manquant");
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        // Récupérer les détails de la procédure
        const response = await fetch(`/api/procedures/${procedureId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Erreur lors du chargement de la procédure");
        }

        const data = await response.json();
        const procedureData = data.procedure;
        setProcedure(procedureData);

        // Trouver le document fusionné
        const document = procedureData?.documents?.find(
          (doc: { id: string }) => doc.id === mergedPdfId
        );

        if (!document) {
          throw new Error("Document fusionné non trouvé");
        }

        setMergedPdfUrl(document.filePath);

        // Pré-remplir l'adresse de destination avec les informations du client
        if (procedureData?.client) {
          const client = procedureData.client;
          setDestinationAddress({
            nom: client.nom || "",
            prenom: client.prenom || "",
            nomSociete: client.nomSociete || "",
            adresse: client.adresse || "",
            codePostal: client.codePostal || "",
            ville: client.ville || "",
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mergedPdfId, procedureId, router]);

  const handleDownload = () => {
    if (mergedPdfUrl) {
      window.open(mergedPdfUrl, "_blank");
    }
  };

  const handleConfirm = () => {
    // Ici, vous pouvez ajouter une logique pour marquer le document comme validé
    // ou rediriger vers une page de confirmation d'envoi
    alert("Document validé ! Vous pouvez maintenant procéder à l'envoi par recommandé.");
    router.push(`/dashboard/${procedureId}`);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          <X className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    );
  }

  if (!procedure) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relecture du document fusionné</h1>
          <p className="text-muted-foreground mt-1">
            Vérifiez le document et l'adresse de destination avant l'envoi par recommandé
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Télécharger
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            <X className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale - Document et adresse */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Viewer */}
          {mergedPdfUrl && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Document fusionné</span>
                </div>
              </div>
              <div className="p-6">
                <DocumentViewer
                  url={mergedPdfUrl}
                  mimeType="application/pdf"
                  fileName="document-fusionne.pdf"
                />
              </div>
            </div>
          )}

          {/* Adresse de destination */}
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Adresse de destination</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dest-nom">Nom *</Label>
                  <Input
                    id="dest-nom"
                    value={destinationAddress.nom}
                    onChange={(e) =>
                      setDestinationAddress({ ...destinationAddress, nom: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dest-prenom">Prénom *</Label>
                  <Input
                    id="dest-prenom"
                    value={destinationAddress.prenom}
                    onChange={(e) =>
                      setDestinationAddress({ ...destinationAddress, prenom: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="dest-nomSociete">Nom de la société</Label>
                <Input
                  id="dest-nomSociete"
                  value={destinationAddress.nomSociete}
                  onChange={(e) =>
                    setDestinationAddress({ ...destinationAddress, nomSociete: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="dest-adresse">Adresse *</Label>
                <Textarea
                  id="dest-adresse"
                  value={destinationAddress.adresse}
                  onChange={(e) =>
                    setDestinationAddress({ ...destinationAddress, adresse: e.target.value })
                  }
                  rows={3}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dest-codePostal">Code postal *</Label>
                  <Input
                    id="dest-codePostal"
                    value={destinationAddress.codePostal}
                    onChange={(e) =>
                      setDestinationAddress({ ...destinationAddress, codePostal: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dest-ville">Ville *</Label>
                  <Input
                    id="dest-ville"
                    value={destinationAddress.ville}
                    onChange={(e) =>
                      setDestinationAddress({ ...destinationAddress, ville: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne latérale - Informations du dossier */}
        <div className="space-y-6">
          {/* Informations du client */}
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Informations du client</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nom complet</p>
                <p className="font-medium">
                  {procedure.client.nomSociete ||
                    `${procedure.client.prenom} ${procedure.client.nom}`}
                </p>
              </div>
              {procedure.client.nomSociete && (
                <div>
                  <p className="text-sm text-muted-foreground">Nom / Prénom</p>
                  <p className="font-medium">
                    {procedure.client.prenom} {procedure.client.nom}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">SIRET</p>
                <p className="font-medium">{procedure.client.siret}</p>
              </div>
              {procedure.client.email && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </p>
                  <p className="font-medium">{procedure.client.email}</p>
                </div>
              )}
              {procedure.client.telephone && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Téléphone
                  </p>
                  <p className="font-medium">{procedure.client.telephone}</p>
                </div>
              )}
              {procedure.client.adresse && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Adresse
                  </p>
                  <p className="font-medium">
                    {procedure.client.adresse}
                    {procedure.client.codePostal && procedure.client.ville && (
                      <span>
                        <br />
                        {procedure.client.codePostal} {procedure.client.ville}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Informations de la procédure */}
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Informations du dossier</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Date facture échue
                </p>
                <p className="font-medium">{formatDate(procedure.dateFactureEchue)}</p>
              </div>
              {procedure.montantDue !== null && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Euro className="h-3 w-3" />
                    Montant dû
                  </p>
                  <p className="font-medium">{procedure.montantDue.toFixed(2)} €</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Statut</p>
                <p className="font-medium">{procedure.status}</p>
              </div>
            </div>
          </div>

          {/* Contexte */}
          <div className="rounded-lg border bg-card shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Contexte</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {procedure.contexte}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button variant="outline" onClick={() => router.push(`/dashboard/${procedureId}/details`)}>
          Modifier la sélection
        </Button>
        <Button onClick={handleConfirm} size="lg">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Valider le document
        </Button>
      </div>
    </div>
  );
}

