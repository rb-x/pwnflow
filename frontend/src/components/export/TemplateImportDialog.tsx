import { useState, useCallback } from "react";
import { Upload, FileUp, Info } from "lucide-react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { exportApi } from "@/services/api/export";
import type { ImportPreviewResponse } from "@/services/api/export";
import { formatDistanceToNow } from "date-fns";

interface TemplateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function TemplateImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: TemplateImportDialogProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      // Validate file extension
      if (!file.name.endsWith(".penflow-template")) {
        toast.error(
          "Invalid file type. Please select a .penflow-template file"
        );
        return;
      }

      setFile(file);
      setPassword("");
      setNeedsPassword(false);
      setPreview(null);

      // Try to preview without password first
      await handlePreview(file, "");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    // Don't restrict by MIME type - we'll validate the extension ourselves
    // react-dropzone has issues with custom extensions
  });

  const handlePreview = async (fileToPreview: File, passwordToUse: string) => {
    setIsPreviewing(true);

    try {
      const result = await exportApi.previewTemplateImport(
        fileToPreview,
        passwordToUse || undefined
      );
      setPreview(result);
      setNeedsPassword(false);
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail;

      if (typeof errorDetail === "string") {
        if (errorDetail.includes("Password required")) {
          setNeedsPassword(true);
          toast.error("This file is encrypted. Please enter the password.");
        } else if (errorDetail.includes("Invalid password")) {
          toast.error("Invalid password. Please try again.");
        } else {
          toast.error(errorDetail);
        }
      } else if (Array.isArray(errorDetail)) {
        // Handle validation errors array
        const errorMessage = errorDetail[0]?.msg || "Invalid file format";
        toast.error(errorMessage);
      } else {
        console.error("Preview failed:", error);
        toast.error("Failed to preview file");
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!file || !password) return;
    await handlePreview(file, password);
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    setIsImporting(true);

    try {
      const result = await exportApi.importTemplate(
        file,
        password || undefined
      );

      toast.success(result.message);
      onImportComplete?.();
      onOpenChange(false);

      // Navigate to the imported template
      navigate(`/templates/${result.template_id}`);
    } catch (error: any) {
      console.error("Import failed:", error);

      const errorDetail = error.response?.data?.detail;
      let errorMessage = "Failed to import template";

      if (typeof errorDetail === "string") {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        // Handle validation errors array
        errorMessage = errorDetail[0]?.msg || errorMessage;
      }

      toast.error(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPassword("");
    setNeedsPassword(false);
    setPreview(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) reset();
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Template</DialogTitle>
          <DialogDescription>
            Import a template from a .penflow-template file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!file ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors hover:border-primary/50
                ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }
              `}
            >
              <input {...getInputProps()} />
              <FileUp className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm font-medium">
                {isDragActive
                  ? "Drop the file here..."
                  : "Drop a .penflow-template file here"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                or click to browse your files
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Selected File</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">
                    {file.name}
                  </span>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    Change
                  </Button>
                </div>
              </div>

              {needsPassword && (
                <div className="space-y-2">
                  <Label htmlFor="import-password">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="import-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter the export password"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePasswordSubmit();
                      }}
                    />
                    <Button
                      onClick={handlePasswordSubmit}
                      disabled={!password || isPreviewing}
                    >
                      {isPreviewing ? "Checking..." : "Unlock"}
                    </Button>
                  </div>
                </div>
              )}

              {preview && (
                <>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{preview.name}</strong>
                      {preview.description && (
                        <p className="mt-1 text-sm">{preview.description}</p>
                      )}
                      <ul className="mt-2 text-sm space-y-1">
                        <li>• {preview.node_count} nodes</li>
                        <li>• {preview.context_count} contexts</li>
                        <li>• {preview.command_count} commands</li>
                        <li>
                          • Exported{" "}
                          {formatDistanceToNow(new Date(preview.exported_at), {
                            addSuffix: true,
                          })}
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <AlertDescription>
                      <strong>Security Notice:</strong> All imported data will
                      be assigned new IDs. Variable values have been removed
                      from this template for security.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {preview && (
            <Button onClick={handleImport} disabled={isImporting}>
              <Upload className=" h-4 w-4" />
              {isImporting ? "Importing..." : "Import Template"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
