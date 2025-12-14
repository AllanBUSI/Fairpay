"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, Calendar, Download, Save } from "lucide-react";
import html2pdf from "html2pdf.js";

interface Echeance {
  date: string;
  montant: number;
}

interface EcheancierEditorProps {
  procedureId: string;
  initialEcheancier: Echeance[] | null;
  onSave: (echeancier: Echeance[]) => Promise<void>;
  onCancel: () => void;
}

interface EcheancierData {
  echeancier?: {
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
    creancier?: {
      nom?: string;
      qualite?: string;
      adresse?: string;
    };
    objet?: string;
    montant_total?: {
      chiffres?: number;
      lettres?: string;
    };
    echeances?: Array<{
      numero?: number;
      date?: string;
      montant?: number;
      montantLettres?: string;
    }>;
    phrases?: string[];
    signature?: {
      nom?: string;
      qualite?: string;
    };
  };
}

// Fonction pour convertir le JSON en HTML formaté
function jsonToHtml(data: EcheancierData): string {
  const ech = data.echeancier;
  if (!ech) return "";

  let html = '<div class="document-page document-content" style="width: 210mm; padding: 30mm 20mm 20mm 20mm; box-sizing: border-box; background: white; font-size: 10px; line-height: 1.5; color: #000; font-family: Times, \'Times New Roman\', serif; min-height: 297mm;">';

  // En-tête avec date et lieu
  if (ech.meta) {
    html += `<div style="text-align: right; margin-bottom: 40px; color: #4b5563;">`;
    if (ech.meta.lieu) html += `${ech.meta.lieu}, `;
    if (ech.meta.date) {
      html += `le ${ech.meta.date}`;
    }
    html += `</div>`;
  }

  // Destinataire
  html += `<div style="margin-bottom: 20px; text-align: right;">`;
  html += `<p style="font-weight: 600; margin-bottom: 8px; text-align: right;">À l'attention de :</p>`;
  if (ech.destinataire) {
    if (ech.destinataire.nom_complet) {
      html += `<p style="margin-bottom: 4px; font-weight: 600; text-align: right;">${ech.destinataire.nom_complet}</p>`;
    }
    if (ech.destinataire.entreprise) {
      html += `<p style="margin-bottom: 4px; text-align: right;">${ech.destinataire.entreprise}</p>`;
    }
    if (ech.destinataire.siret) {
      html += `<p style="margin-bottom: 4px; text-align: right;">SIRET : ${ech.destinataire.siret}</p>`;
    }
    if (ech.destinataire.adresse) {
      html += `<p style="margin-bottom: 4px; text-align: right;">${ech.destinataire.adresse}</p>`;
    }
    if (ech.destinataire.codePostal && ech.destinataire.ville) {
      html += `<p style="margin-bottom: 4px; text-align: right;">${ech.destinataire.codePostal} ${ech.destinataire.ville}</p>`;
    } else if (ech.destinataire.ville) {
      html += `<p style="margin-bottom: 4px; text-align: right;">${ech.destinataire.ville}</p>`;
    }
    if (ech.destinataire.email) {
      html += `<p style="margin-bottom: 4px; text-align: right;">Email : ${ech.destinataire.email}</p>`;
    }
    if (ech.destinataire.telephone) {
      html += `<p style="margin-bottom: 4px; text-align: right;">Téléphone : ${ech.destinataire.telephone}</p>`;
    }
  }
  html += `</div>`;

  // Objet
  if (ech.objet) {
    html += `<div style="margin-bottom: 12px;">`;
    html += `<p style="font-weight: 600; margin-bottom: 4px;">Objet : ${ech.objet}</p>`;
    html += `</div>`;
  }

  // Salutation
  html += `<div style="margin-bottom: 10px;">`;
  html += `<p>Madame, Monsieur,</p>`;
  html += `</div>`;

  // Corps de la lettre
  if (ech.phrases && Array.isArray(ech.phrases) && ech.phrases.length > 0) {
    html += `<div style="margin-bottom: 16px;">`;
    ech.phrases.forEach((phrase: string) => {
      if (phrase && typeof phrase === 'string' && phrase.trim()) {
        html += `<p style="text-align: justify; margin-bottom: 12px;">${phrase}</p>`;
      }
    });
    html += `</div>`;
  }

  // Tableau des échéances - avec gestion des sauts de page
  if (ech.echeances && ech.echeances.length > 0) {
    html += `<div class="echeancier-section" style="margin-bottom: 12px; margin-top: 50px; page-break-inside: avoid; break-inside: avoid;">`;
    html += `<p style="font-weight: 600; margin-bottom: 8px; page-break-after: avoid;">Échéancier de paiement :</p>`;
    html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid #d1d5db; page-break-inside: avoid; break-inside: avoid; font-size: 10px;">`;
    html += `<thead>`;
    html += `<tr style="background-color: #f3f4f6;">`;
      html += `<th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; font-weight: 600;">N°</th>`;
      html += `<th style="border: 1px solid #d1d5db; padding: 6px; text-align: left; font-weight: 600;">Date d'échéance</th>`;
      html += `<th style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-weight: 600;">Montant</th>`;
    html += `</tr>`;
    html += `</thead>`;
    html += `<tbody>`;
    ech.echeances.forEach((echeance) => {
      html += `<tr>`;
      html += `<td style="border: 1px solid #d1d5db; padding: 6px;">${echeance.numero || ""}</td>`;
      html += `<td style="border: 1px solid #d1d5db; padding: 6px;">${echeance.date || ""}</td>`;
      html += `<td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${echeance.montant?.toFixed(2) || "0.00"} €</td>`;
      html += `</tr>`;
    });
    html += `</tbody>`;
    html += `<tfoot>`;
    html += `<tr style="background-color: #f9fafb; font-weight: 600;">`;
      html += `<td colspan="2" style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">Total :</td>`;
      html += `<td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${ech.montant_total?.chiffres?.toFixed(2) || "0.00"} €</td>`;
    html += `</tr>`;
    html += `</tfoot>`;
    html += `</table>`;
    if (ech.montant_total?.lettres) {
      html += `<p style="font-size: 10px; color: #4b5563; font-style: italic;">Soit ${ech.montant_total.lettres} euros</p>`;
    }
    html += `</div>`;
  }

  // Signature
  html += `<div style="margin-top: 20px;">`;
  html += `<p style="margin-bottom: 8px;">Cordialement,</p>`;
  if (ech.signature) {
    if (ech.signature.nom) {
      html += `<p style="font-weight: 600; margin-bottom: 4px;">${ech.signature.nom}</p>`;
    }
    if (ech.signature.qualite) {
      html += `<p>${ech.signature.qualite}</p>`;
    }
  }
  html += `</div>`;

  html += `</div>`;

  return html;
}

export function EcheancierEditor({
  procedureId,
  initialEcheancier,
  onSave,
  onCancel,
}: EcheancierEditorProps) {
  const [error, setError] = useState("");
  const [jsonData, setJsonData] = useState<EcheancierData | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [htmlContent, setHtmlContent] = useState("");
  const [isSavingPDF, setIsSavingPDF] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Générer automatiquement le courrier au chargement
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedureId]);

  const handleGenerate = async () => {
    if (!initialEcheancier || initialEcheancier.length === 0) {
      setError("Aucun écheancier trouvé pour cette procédure");
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Non authentifié");
        setIsGenerating(false);
        return;
      }

      // Appeler l'API pour générer le courrier
      const response = await fetch("/api/ia/echeancier", {
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

  const handleDownloadPDF = async () => {
    if (!editorRef.current) {
      setError("Éditeur non disponible");
      return;
    }

    try {
      const opt = {
        margin: [0, 0, 0, 0] as [number, number, number, number],
        filename: `echeancier-${procedureId.slice(0, 8)}.pdf`,
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
            
            const documentPages = clonedDoc.querySelectorAll('.document-page');
            documentPages.forEach((page) => {
              const htmlPage = page as HTMLElement;
              htmlPage.style.width = '210mm';
              htmlPage.style.minHeight = '297mm';
              htmlPage.style.margin = '0 auto';
              htmlPage.style.padding = '15mm 20mm 20mm 20mm';
              htmlPage.style.boxSizing = 'border-box';
              htmlPage.style.display = 'block';
              htmlPage.style.height = 'auto';
              htmlPage.style.fontSize = '10px';
              htmlPage.style.lineHeight = '1.5';
              htmlPage.style.color = '#000';
              htmlPage.style.fontFamily = 'Times, "Times New Roman", serif';
            });
            
            // Appliquer les styles aux tableaux
            const tables = clonedDoc.querySelectorAll('table');
            tables.forEach((table) => {
              const htmlTable = table as HTMLElement;
              htmlTable.style.width = '100%';
              htmlTable.style.borderCollapse = 'collapse';
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
          }
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const,
          putOnlyUsedFonts: true,
          floatPrecision: 16
        },
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'] as any, 
          avoid: ['.document-page', 'table', '.echeancier-section'],
          before: '.page-break'
        }
      };

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
        filename: `echeancier-${procedureId.slice(0, 8)}.pdf`,
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
            
            const documentPages = clonedDoc.querySelectorAll('.document-page');
            documentPages.forEach((page) => {
              const htmlPage = page as HTMLElement;
              htmlPage.style.width = '210mm';
              htmlPage.style.minHeight = '297mm';
              htmlPage.style.margin = '0 auto';
              htmlPage.style.padding = '15mm 20mm 20mm 20mm';
              htmlPage.style.boxSizing = 'border-box';
              htmlPage.style.display = 'block';
              htmlPage.style.height = 'auto';
              htmlPage.style.fontSize = '10px';
              htmlPage.style.lineHeight = '1.5';
              htmlPage.style.color = '#000';
              htmlPage.style.fontFamily = 'Times, "Times New Roman", serif';
            });
            
            const tables = clonedDoc.querySelectorAll('table');
            tables.forEach((table) => {
              const htmlTable = table as HTMLElement;
              htmlTable.style.width = '100%';
              htmlTable.style.borderCollapse = 'collapse';
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
          }
        },
        jsPDF: { 
          unit: 'mm' as const, 
          format: 'a4' as const, 
          orientation: 'portrait' as const,
          putOnlyUsedFonts: true,
          floatPrecision: 16
        },
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'] as any, 
          avoid: ['.document-page', 'table', '.echeancier-section'],
          before: '.page-break'
        }
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
          fileName: `echeancier-${procedureId.slice(0, 8)}.pdf`,
          documentType: "echeancier",
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Courrier d'écheancier</h2>
            <p className="text-sm text-muted-foreground">
              Courrier d'écheancier de paiement généré à partir de l'écheancier défini
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isGenerating}
            >
              <X className="mr-2 h-4 w-4" />
              Fermer
            </Button>
            {!isGenerating && htmlContent && (
              <>
                <Button
                  onClick={handleDownloadPDF}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger PDF
                </Button>
                <Button
                  onClick={handleSavePDF}
                  disabled={isSavingPDF}
                  variant="default"
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {isGenerating ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                Génération du courrier d'écheancier en cours...
              </p>
            </div>
          </div>
        ) : htmlContent ? (
          <div>
            <style>{`
              @media print {
                .page-break {
                  page-break-before: always;
                }
              .document-content {
                page-break-inside: avoid;
              }
              table {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .echeancier-section {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              }
              .document-page {
                width: 210mm;
                min-height: 297mm;
                padding: 15mm 20mm 20mm 20mm;
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
                dangerouslySetInnerHTML={{ __html: htmlContent || "<p>Génération en cours...</p>" }}
                onInput={(e) => {
                  if (editorRef.current) {
                    setHtmlContent(editorRef.current.innerHTML);
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Aucun écheancier trouvé pour cette procédure
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

