"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, File, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  type: string;
  preview?: string;
}

interface FileUploadProps {
  type: string;
  label: string;
  onFilesChange: (files: UploadedFile[]) => void;
  uploadedFiles?: UploadedFile[];
}

export function FileUpload({
  type,
  label,
  onFilesChange,
  uploadedFiles = [],
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(uploadedFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Vous devez être connecté pour uploader des fichiers");
        setUploading(false);
        return;
      }

      const uploadPromises = Array.from(selectedFiles).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);

        const response = await fetch("/api/files/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Erreur lors de l'upload");
        }

        const data = await response.json();

        // Créer une preview pour les images (utiliser l'URL Supabase)
        let preview: string | undefined;
        if (file.type.startsWith("image/")) {
          // Utiliser l'URL Supabase comme preview
          preview = data.filePath;
        }

        return {
          ...data,
          preview,
        };
      });

      const uploaded = await Promise.all(uploadPromises);
      const newFiles = [...files, ...uploaded];
      setFiles(newFiles);
      onFilesChange(newFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");
  const isPDF = (mimeType: string) => mimeType === "application/pdf";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id={`file-upload-${type}`}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Upload en cours..." : "Ajouter des fichiers"}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            Images (JPEG, PNG, GIF, WebP) ou PDF uniquement. Taille max: 10MB par fichier.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="grid gap-3">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                {isImage(file.mimeType) && (file.preview || file.filePath) ? (
                  <img
                    src={file.preview || file.filePath}
                    alt={file.fileName}
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : isPDF(file.mimeType) ? (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-red-100 dark:bg-red-900/20">
                    <File className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

