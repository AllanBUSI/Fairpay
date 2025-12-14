"use client";

import { useState } from "react";
import { Image as ImageIcon, File, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentViewerProps {
  url: string;
  mimeType: string;
  fileName: string;
}

export function DocumentViewer({ url, mimeType, fileName }: DocumentViewerProps) {
  const [imageError, setImageError] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isImage = mimeType.startsWith("image/");
  const isPDF = mimeType === "application/pdf";

  // Vérifier que l'URL est valide
  if (!url || url.trim() === "") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded border bg-muted/30 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">URL du document invalide</p>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="relative w-full bg-muted/30">
        {imageLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {imageError ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">{errorMessage || "Impossible de charger l'image"}</p>
            <p className="text-xs text-muted-foreground/70 break-all px-4">{url}</p>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Ouvrir dans un nouvel onglet
              </Button>
            </a>
          </div>
        ) : (
          <div className="relative w-full overflow-hidden rounded">
            <img
              src={url}
              alt={fileName}
              className={`w-full object-contain ${
                imageLoading ? "hidden" : "block"
              }`}
              style={{ maxHeight: "600px", minHeight: "200px" }}
              onLoad={() => setImageLoading(false)}
              onError={(e) => {
                console.error("Erreur lors du chargement de l'image:", e, "URL:", url);
                setImageError(true);
                setImageLoading(false);
                setErrorMessage("Impossible de charger l'image. Vérifiez que l'URL est accessible.");
              }}
            />
          </div>
        )}
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="relative w-full">
        {pdfError ? (
          <div className="flex h-96 flex-col items-center justify-center gap-2 rounded border bg-muted/30 text-muted-foreground">
            <File className="h-12 w-12" />
            <p className="text-sm">{errorMessage || "Impossible de charger le PDF"}</p>
            <p className="text-xs text-muted-foreground/70 break-all px-4">{url}</p>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Ouvrir dans un nouvel onglet
              </Button>
            </a>
          </div>
        ) : (
          <div className="relative w-full" style={{ height: "600px" }}>
            <iframe
              src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
              className="h-full w-full rounded border"
              title={fileName}
              onError={(e) => {
                console.error("Erreur lors du chargement du PDF:", e, "URL:", url);
                setPdfError(true);
                setErrorMessage("Impossible de charger le PDF. Vérifiez que l'URL est accessible.");
              }}
              onLoad={() => {
                // Vérifier si l'iframe a chargé correctement
                setTimeout(() => {
                  const iframe = document.querySelector('iframe[title="' + fileName + '"]') as HTMLIFrameElement;
                  if (iframe && iframe.contentDocument?.body?.textContent?.includes('403') || iframe.contentDocument?.body?.textContent?.includes('Forbidden')) {
                    setPdfError(true);
                    setErrorMessage("Accès refusé au fichier PDF. Vérifiez les permissions du bucket Supabase.");
                  }
                }, 1000);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Pour les autres types de fichiers
  return (
    <div className="flex h-32 items-center justify-center rounded border bg-muted/30">
      <div className="text-center">
        <File className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Aperçu non disponible</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
          <Button variant="outline" size="sm">
            Ouvrir le fichier
          </Button>
        </a>
      </div>
    </div>
  );
}

