"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Download, Save } from "lucide-react";
import html2pdf from "html2pdf.js";

interface MiseEnDemeureEditorProps {
  procedureId: string;
  initialContent: string | null;
  procedureData: {
    contexte: string;
    montantDue: number | null;
    dateFactureEchue: string;
    client: {
      nom: string;
      prenom: string;
      siret: string;
      nomSociete: string | null;
      email: string | null;
      telephone: string | null;
    };
  };
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

interface MiseEnDemeureData {
  mise_en_demeure?: {
    meta?: {
      date?: string;
      lieu?: string;
    };
        avocat?: {
          nom_complet?: string;
          qualite?: string;
          email?: string;
          cabinet?: string;
          adresse?: string;
          codePostal?: string;
          ville?: string;
          telephone?: string;
          logoUrl?: string | null;
        };
    destinataire?: {
      nom?: string;
      prenom?: string;
      nom_complet?: string;
      entreprise?: string | null;
      siret?: string;
      adresse?: string;
      codePostal?: string | null;
      ville?: string | null;
      email?: string;
      telephone?: string;
    };
    facture?: {
      numero?: string;
      date?: string;
      montant?: number;
      montant_lettres?: string;
    };
    factures?: Array<{
      numero?: string;
      date?: string;
      montant?: number;
    }>;
    creancier?: {
      nom?: string;
      qualite?: string;
      adresse?: string;
    };
    dateRelance?: string | null;
    dateRelance2?: string | null;
    objet?: string;
    phrases?: string[];
    signature?: {
      nom?: string;
      qualite?: string;
    };
  };
}

// Fonction pour convertir le JSON en HTML formaté selon le nouveau modèle
function jsonToHtml(data: MiseEnDemeureData): string {
  const md = data.mise_en_demeure;
  if (!md) return "";

  // Page unique : Mise en demeure
  let html = '<div class="document-page document-content text-[11px]">';

  // En-tête avec date et lieu (en haut à droite)
  const villeAvocat = (md.avocat?.ville || md.meta?.lieu || "").trim();
  let dateAffichee = "";
  if (md.meta?.date) {
    dateAffichee = md.meta.date;
  } else {
    const dateActuelle = new Date();
    dateAffichee = dateActuelle.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  
  html += `<div style="text-align: right; margin-bottom: 32px; color: #4b5563;">`;
  if (villeAvocat) {
    html += `<span>${villeAvocat}, le ${dateAffichee}</span>`;
  } else {
    html += `<span>le ${dateAffichee}</span>`;
  }
  html += `</div>`;

  // Informations de l'avocat selon le nouveau format
  if (md.avocat) {
    html += `<div class="mb-6">`;
    // Logo du cabinet si disponible
    if (md.avocat.logoUrl) {
      html += `<div class="mb-4" style="margin-bottom: 16px;">`;
      html += `<img src="${md.avocat.logoUrl}" alt="Logo du cabinet" style="width: 64px; height: 64px; object-fit: contain; display: block; max-width: 64px; max-height: 64px;" />`;
      html += `</div>`;
    }
    // Qualité en premier
    if (md.avocat.qualite) {
      html += `<p class="font-semibold mb-2">${md.avocat.qualite}</p>`;
    }
    // Nom complet de l'avocat
    if (md.avocat.nom_complet) {
      html += `<p class="font-semibold mb-2">${md.avocat.nom_complet}</p>`;
    }
    // Email séparé
    if (md.avocat.email) {
      html += `<p class="mb-4">Email : ${md.avocat.email}</p>`;
    }
    html += `</div>`;
  }

  // "À l'attention de :" suivi du destinataire avec toutes les informations
  html += `<div style="margin-bottom: 20px; text-align: right !important;">`;
  html += `<p style="font-weight: 600; margin-bottom: 8px; text-align: right !important;">À l'attention de :</p>`;
  if (md.destinataire) {
    if (md.destinataire.nom_complet) {
      html += `<p style="margin-bottom: 4px; font-weight: 600; text-align: right !important;">${md.destinataire.nom_complet}</p>`;
    }
    if (md.destinataire.entreprise) {
      html += `<p style="margin-bottom: 4px; text-align: right !important;">${md.destinataire.entreprise}</p>`;
    }
    if (md.destinataire.siret) {
      html += `<p style="margin-bottom: 4px; text-align: right !important;">SIRET : ${md.destinataire.siret}</p>`;
    }
    if (md.destinataire.adresse) {
      html += `<p style="margin-bottom: 4px; text-align: right !important;">${md.destinataire.adresse}</p>`;
    }
    if (md.destinataire.codePostal && md.destinataire.ville) {
      html += `<p style="margin-bottom: 4px; text-align: right !important;">${md.destinataire.codePostal} ${md.destinataire.ville}</p>`;
    } else if (md.destinataire.ville) {
      html += `<p style="margin-bottom: 4px; text-align: right !important;">${md.destinataire.ville}</p>`;
    }
    if (md.destinataire.email) {
      html += `<p style="margin-bottom: 4px; text-align: right !important;">Email : ${md.destinataire.email}</p>`;
    }
    if (md.destinataire.telephone) {
      html += `<p style="margin-bottom: 4px; text-align: right !important;">Téléphone : ${md.destinataire.telephone}</p>`;
    }
  }
  html += `</div>`;

  // Objet avec mention "par courrier recommandé avec accusé de réception"
  if (md.objet) {
    html += `<div class="mb-6">`;
    html += `<p class="font-semibold mb-2">Objet : ${md.objet}</p>`;
    html += `</div>`;
  }

  // Salutation
  html += `<div class="mb-4">`;
  html += `<p>Madame, Monsieur,</p>`;
  html += `</div>`;

  // Corps de la lettre avec les phrases
  if (md.phrases && Array.isArray(md.phrases) && md.phrases.length > 0) {
    html += `<div class="mb-6 space-y-4">`;
    md.phrases.forEach((phrase: string) => {
      if (phrase && typeof phrase === 'string' && phrase.trim()) {
        html += `<p class="text-justify">${phrase}</p>`;
      }
    });
    html += `</div>`;
  }

  // Signature
  html += `<div class="mt-12">`;
  html += `<p class="mb-2">Cordialement,</p>`;
  if (md.signature) {
    if (md.signature.nom) {
      html += `<p class="font-semibold mb-1">${md.signature.nom}</p>`;
    }
    if (md.signature.qualite) {
      html += `<p>${md.signature.qualite}</p>`;
    }
  }
  html += `</div>`;

  // Footer avec mention légale
  html += `<div class="mt-16 pt-4 border-t border-gray-200 text-center text-[9px] text-gray-400">`;
  html += `<p>Ce document a été envoyé par un avocat diplômé et inscrit à l'ordre des avocats.</p>`;
  html += `</div>`;

  html += `</div>`; // Fin de la page

  return html;
}

// Fonction pour convertir le HTML en JSON
function htmlToJson(html: string, originalJson: MiseEnDemeureData): string {
  // Pour simplifier, on garde le JSON original et on stocke aussi le HTML
  // En production, on pourrait parser le HTML et reconstruire le JSON
  return JSON.stringify({
    ...originalJson,
    html_content: html,
  }, null, 2);
}

export function MiseEnDemeureEditor({
  procedureId,
  initialContent,
  procedureData,
  onSave,
  onCancel,
}: MiseEnDemeureEditorProps) {
  const [htmlContent, setHtmlContent] = useState("");
  const [jsonData, setJsonData] = useState<MiseEnDemeureData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPDF, setIsSavingPDF] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  // Fonction handleGenerate pour être utilisée dans useEffect et dans le bouton
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Non authentifié");
        return;
      }

      // Appeler l'API avec le procedureId pour générer la mise en demeure
      const response = await fetch("/api/ia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ procedureId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la génération");
      }

      const data = await response.json();
      setJsonData(data);
      setHtmlContent(jsonToHtml(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsGenerating(false);
    }
  };

  // Initialiser le contenu ou générer si vide
  useEffect(() => {
    if (initialContent) {
      try {
        const parsed = JSON.parse(initialContent);
        setJsonData(parsed);
        if (parsed.html_content) {
          setHtmlContent(parsed.html_content);
        } else {
          setHtmlContent(jsonToHtml(parsed));
        }
      } catch (e) {
        setHtmlContent(initialContent);
      }
    } else {
      handleGenerate(); // Generate if no initial content
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, procedureId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError("");

    try {
      if (!editorRef.current) {
        throw new Error("Éditeur non disponible");
      }

      const currentHtml = editorRef.current.innerHTML;
      const contentToSave = jsonData 
        ? htmlToJson(currentHtml, jsonData)
        : JSON.stringify({ html_content: currentHtml }, null, 2);

      await onSave(contentToSave);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsSaving(false);
    }
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const maintainCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // Trouver l'élément parent le plus proche (p, div, etc.)
    let element: HTMLElement | null = null;
    if (container.nodeType === Node.TEXT_NODE) {
      element = container.parentElement;
    } else if (container.nodeType === Node.ELEMENT_NODE) {
      element = container as HTMLElement;
    }

    if (element) {
      const computedStyle = window.getComputedStyle(element);
      const textAlign = computedStyle.textAlign;
      
      // Si l'élément est aligné à droite, maintenir le curseur à droite
      if (textAlign === 'right') {
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
          const length = textNode.textContent?.length || 0;
          range.setStart(textNode, length);
          range.setEnd(textNode, length);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  };

  const cleanHtml = (html: string): string => {
    // Supprimer les artefacts comme "iice" qui peuvent apparaître
    let cleaned = html.replace(/iice/gi, '');
    // Nettoyer les espaces multiples
    cleaned = cleaned.replace(/\s+/g, ' ');
    // S'assurer que les divs avec text-align: right le conservent
    cleaned = cleaned.replace(
      /<div([^>]*style="[^"]*text-align:\s*right[^"]*"[^>]*)>/gi,
      (match, attrs) => {
        if (!attrs.includes('text-align: right')) {
          return match.replace('style="', 'style="text-align: right; ');
        }
        return match;
      }
    );
    return cleaned;
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (editorRef.current) {
      const cleanedHtml = cleanHtml(editorRef.current.innerHTML);
      setHtmlContent(cleanedHtml);
      // Mettre à jour le contenu si nécessaire
      if (editorRef.current.innerHTML !== cleanedHtml) {
        editorRef.current.innerHTML = cleanedHtml;
        // Restaurer la position du curseur
        setTimeout(maintainCursorPosition, 0);
      }
    }
    // Maintenir le curseur à droite si nécessaire
    setTimeout(maintainCursorPosition, 0);
  };

  const handleDownloadPDF = async () => {
    if (!editorRef.current) {
      setError("Éditeur non disponible");
      return;
    }

    try {
      // Options pour html2pdf
      const opt = {
        margin: [0, 0, 0, 0] as [number, number, number, number],
        filename: `mise-en-demeure-${procedureId.slice(0, 8)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794, // 210mm en pixels à 96 DPI
          windowWidth: 794,
          onclone: (clonedDoc: Document) => {
            // Convertir toutes les couleurs lab() en rgb() dans le document cloné
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const computedStyle = window.getComputedStyle(htmlEl);
              
              // Remplacer les couleurs lab() par des valeurs RGB
              if (computedStyle.color && computedStyle.color.includes('lab')) {
                htmlEl.style.color = '#000000';
              }
              if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('lab')) {
                // Détecter les nuances de gris pour les arrière-plans
                const bgColor = computedStyle.backgroundColor;
                if (bgColor.includes('gray') || bgColor.includes('100') || bgColor.includes('50')) {
                  htmlEl.style.backgroundColor = '#f3f4f6';
                } else {
                  htmlEl.style.backgroundColor = '#ffffff';
                }
              }
              if (computedStyle.borderColor && computedStyle.borderColor.includes('lab')) {
                htmlEl.style.borderColor = '#e5e7eb';
              }
            });
            
            // S'assurer que les images (logos) ont la bonne taille
            const images = clonedDoc.querySelectorAll('img');
            images.forEach((img) => {
              const htmlImg = img as HTMLImageElement;
              if (htmlImg.alt && htmlImg.alt.includes('Logo')) {
                htmlImg.style.width = '64px';
                htmlImg.style.height = '64px';
                htmlImg.style.objectFit = 'contain';
                htmlImg.style.display = 'block';
                htmlImg.style.maxWidth = '64px';
                htmlImg.style.maxHeight = '64px';
              }
            });
            
            // S'assurer que le document-page est centré et a la bonne largeur
            const documentPages = clonedDoc.querySelectorAll('.document-page');
            documentPages.forEach((page) => {
              const htmlPage = page as HTMLElement;
              htmlPage.style.width = '210mm';
              htmlPage.style.margin = '0 auto';
              htmlPage.style.padding = '20mm';
              htmlPage.style.boxSizing = 'border-box';
              htmlPage.style.display = 'block';
              // Supprimer min-height pour éviter les pages vides
              htmlPage.style.minHeight = 'auto';
              htmlPage.style.height = 'auto';
            });
            
            // Centrer le conteneur parent si nécessaire
            const body = clonedDoc.body;
            if (body) {
              body.style.display = 'flex';
              body.style.flexDirection = 'column';
              body.style.alignItems = 'center';
              body.style.margin = '0';
              body.style.padding = '0';
              body.style.height = 'auto';
            }
            
            // Supprimer les éléments vides qui pourraient créer une page supplémentaire
            const allDivs = clonedDoc.querySelectorAll('div');
            allDivs.forEach((div) => {
              const htmlDiv = div as HTMLElement;
              if (htmlDiv.children.length === 0 && !htmlDiv.textContent?.trim()) {
                htmlDiv.style.display = 'none';
              }
            });
          }
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any, avoid: ['.document-page'] }
      };

      // Générer et télécharger le PDF directement depuis l'éditeur
      await html2pdf().set(opt).from(editorRef.current).save();
    } catch (err) {
      console.error("Erreur génération PDF:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de la génération du PDF");
    }
  };

  const handleSavePDF = async () => {
    if (!editorRef.current) {
      setError("Éditeur non disponible");
      return;
    }

    setIsSavingPDF(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Non authentifié");
        setIsSavingPDF(false);
        return;
      }

      // Options pour html2pdf (même que handleDownloadPDF)
      const opt = {
        margin: [0, 0, 0, 0] as [number, number, number, number],
        filename: `mise-en-demeure-${procedureId.slice(0, 8)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 794,
          windowWidth: 794,
          onclone: (clonedDoc: Document) => {
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const computedStyle = window.getComputedStyle(htmlEl);
              
              if (computedStyle.color && computedStyle.color.includes('lab')) {
                htmlEl.style.color = '#000000';
              }
              if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('lab')) {
                const bgColor = computedStyle.backgroundColor;
                if (bgColor.includes('gray') || bgColor.includes('100') || bgColor.includes('50')) {
                  htmlEl.style.backgroundColor = '#f3f4f6';
                } else {
                  htmlEl.style.backgroundColor = '#ffffff';
                }
              }
              if (computedStyle.borderColor && computedStyle.borderColor.includes('lab')) {
                htmlEl.style.borderColor = '#e5e7eb';
              }
            });
            
            const images = clonedDoc.querySelectorAll('img');
            images.forEach((img) => {
              const htmlImg = img as HTMLImageElement;
              if (htmlImg.alt && htmlImg.alt.includes('Logo')) {
                htmlImg.style.width = '64px';
                htmlImg.style.height = '64px';
                htmlImg.style.objectFit = 'contain';
                htmlImg.style.display = 'block';
                htmlImg.style.maxWidth = '64px';
                htmlImg.style.maxHeight = '64px';
              }
            });
            
            const documentPages = clonedDoc.querySelectorAll('.document-page');
            documentPages.forEach((page) => {
              const htmlPage = page as HTMLElement;
              htmlPage.style.width = '210mm';
              htmlPage.style.margin = '0 auto';
              htmlPage.style.padding = '20mm';
              htmlPage.style.boxSizing = 'border-box';
              htmlPage.style.display = 'block';
              htmlPage.style.minHeight = 'auto';
              htmlPage.style.height = 'auto';
            });
            
            const body = clonedDoc.body;
            if (body) {
              body.style.display = 'flex';
              body.style.flexDirection = 'column';
              body.style.alignItems = 'center';
              body.style.margin = '0';
              body.style.padding = '0';
              body.style.height = 'auto';
            }
            
            const allDivs = clonedDoc.querySelectorAll('div');
            allDivs.forEach((div) => {
              const htmlDiv = div as HTMLElement;
              if (htmlDiv.children.length === 0 && !htmlDiv.textContent?.trim()) {
                htmlDiv.style.display = 'none';
              }
            });
          }
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any, avoid: ['.document-page'] }
      };

      // Générer le PDF en base64
      const pdfBlob = await html2pdf().set(opt).from(editorRef.current).outputPdf('blob');
      
      // Convertir le blob en base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(pdfBlob);
      const pdfBase64 = await base64Promise;

      // Envoyer à l'API pour sauvegarder
      const response = await fetch(`/api/procedures/${procedureId}/save-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pdfBase64,
          fileName: `mise-en-demeure-${procedureId.slice(0, 8)}.pdf`,
          documentType: "mise-en-demeure",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde du PDF");
      }

      // Succès - fermer le sidebar
      onCancel();
    } catch (err) {
      console.error("Erreur sauvegarde PDF:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde du PDF");
    } finally {
      setIsSavingPDF(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* Header avec boutons de formatage */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="text-lg font-semibold">Mise en demeure</h3>
            <p className="text-sm text-muted-foreground">
              Document généré par l'IA. Modifiez directement le contenu ci-dessous.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Barre d'outils de formatage */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("bold")}
                className="h-8 w-8 p-0"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("italic")}
                className="h-8 w-8 p-0"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("underline")}
                className="h-8 w-8 p-0"
              >
                <Underline className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("justifyLeft")}
                className="h-8 w-8 p-0"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("justifyCenter")}
                className="h-8 w-8 p-0"
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("justifyRight")}
                className="h-8 w-8 p-0"
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Régénérer
                </>
              )}
            </Button>
            <Button
              onClick={handleDownloadPDF}
              disabled={isGenerating || !htmlContent}
              variant="outline"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger PDF
            </Button>
            <Button
              onClick={handleSavePDF}
              disabled={isGenerating || !htmlContent || isSavingPDF}
              variant="default"
              size="sm"
            >
              {isSavingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Zone d'erreur */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Éditeur de document A4 */}
        {isGenerating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Génération de la mise en demeure en cours...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-gray-50 p-8">
            <style>{`
              @media print {
                .page-break {
                  page-break-before: always;
                }
                .document-content {
                  page-break-inside: avoid;
                }
              }
              .document-page {
                width: 210mm;
                padding: 20mm;
                box-sizing: border-box;
                background: white;
                margin: 0 auto 20px auto;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                text-align: left;
              }
              .document-page * {
                max-width: 100%;
              }
              .document-page img[alt*="Logo"] {
                width: 64px !important;
                height: 64px !important;
                object-fit: contain !important;
                display: block !important;
                max-width: 64px !important;
                max-height: 64px !important;
              }
              [style*="text-align: right"] {
                text-align: right !important;
              }
              [style*="text-align: right"] p {
                text-align: right !important;
              }
            `}</style>
            <div 
              className="mx-auto"
              style={{
                width: "210mm",
              }}
            >
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="outline-none prose prose-sm max-w-none"
                style={{
                  fontFamily: "Times, 'Times New Roman', serif",
                  fontSize: "12pt",
                  lineHeight: "1.6",
                  color: "#000",
                }}
                dangerouslySetInnerHTML={{ __html: htmlContent || "<p>Cliquez ici pour commencer...</p>" }}
                onInput={handleInput}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer avec boutons */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={isSaving || isGenerating}
        >
          Annuler
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || isGenerating || !htmlContent.trim()}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer"
          )}
        </Button>
      </div>
    </div>
  );
}
