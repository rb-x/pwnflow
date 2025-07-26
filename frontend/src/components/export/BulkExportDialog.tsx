import { useState } from "react";
import { Download, Check, X, Copy, Key } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { exportApi } from "@/services/api/export";
import type { ExportEncryption } from "@/services/api/export";
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";

interface BulkExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Array<{
    id: string;
    name: string;
    description?: string;
    type: "project" | "template";
  }>;
  type: "projects" | "templates";
}

export function BulkExportDialog({
  open,
  onOpenChange,
  items,
  type,
}: BulkExportDialogProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(items.map((item) => item.id))
  );
  const [encryptionMethod, setEncryptionMethod] =
    useState<ExportEncryption["method"]>("password");
  const [password, setPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [includeVariables, setIncludeVariables] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResults, setExportResults] = useState<
    Array<{
      id: string;
      name: string;
      status: "pending" | "success" | "error";
      downloadUrl?: string;
      error?: string;
    }>
  >([]);

  // Generate a secure password
  const generatePassword = () => {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
    let password = "";
    for (let i = 0; i < 24; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleSelectAll = () => {
    setSelectedItems(new Set(items.map((item) => item.id)));
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleExport = async () => {
    if (encryptionMethod === "password" && !password) {
      toast.error("Please enter a password");
      return;
    }

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to export");
      return;
    }

    setIsExporting(true);
    const selectedItemsList = items.filter((item) =>
      selectedItems.has(item.id)
    );
    const results = selectedItemsList.map((item) => ({
      id: item.id,
      name: item.name,
      status: "pending" as const,
    }));
    setExportResults(results);

    // Generate a single password for all exports if using generated method
    let exportPassword = password;
    if (encryptionMethod === "generated") {
      exportPassword = generatePassword();
      setGeneratedPassword(exportPassword);
    }

    // Export items one by one with the same password
    for (let i = 0; i < selectedItemsList.length; i++) {
      const item = selectedItemsList[i];
      try {
        let response;
        if (type === "projects") {
          response = await exportApi.exportProject(item.id, {
            encryption: {
              method:
                encryptionMethod === "generated"
                  ? "password"
                  : encryptionMethod,
              password: exportPassword,
            },
            options: { include_variables: includeVariables },
          });
        } else {
          response = await exportApi.exportTemplate(item.id, {
            encryption: {
              method:
                encryptionMethod === "generated"
                  ? "password"
                  : encryptionMethod,
              password: exportPassword,
            },
          });
        }

        results[i] = {
          ...results[i],
          status: "success",
          downloadUrl: response.job_id, // Store job_id instead of URL
        };
        setExportResults([...results]);
      } catch (error) {
        results[i] = {
          ...results[i],
          status: "error",
          error: error instanceof Error ? error.message : "Export failed",
        };
        setExportResults([...results]);
      }
    }

    setIsExporting(false);
  };

  const handleDownloadAll = async () => {
    const successfulExports = exportResults.filter(
      (r) => r.status === "success" && r.downloadUrl
    );
    for (const result of successfulExports) {
      const filename = `${result.name}.penflow-${type.slice(0, -1)}`;
      await exportApi.downloadFile(result.downloadUrl!, filename);
    }
  };

  const successCount = exportResults.filter(
    (r) => r.status === "success"
  ).length;
  const errorCount = exportResults.filter((r) => r.status === "error").length;

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast.success("Password copied to clipboard");
  };

  const downloadPasswordFile = () => {
    const content = `Penflow Bulk Export Password

Password for all exports: ${generatedPassword}

This password is used for all ${successCount} exported files.
Keep this password safe!`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "penflow-export-password.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Bulk Export {type === "projects" ? "Projects" : "Templates"}
          </DialogTitle>
          <DialogDescription>
            Select {type} to export. Each will be exported as a separate
            encrypted file.
          </DialogDescription>
        </DialogHeader>

        {exportResults.length === 0 ? (
          <>
            <div className="space-y-4">
              {/* Selection controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
                  >
                    Deselect All
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  {selectedItems.size} of {items.length} selected
                </span>
              </div>

              {/* Items list */}
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={item.id}
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => handleItemToggle(item.id)}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={item.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {item.name}
                        </label>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Encryption options */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Encryption Method</Label>
                  <div className="space-y-2">
                    <select
                      value={encryptionMethod}
                      onChange={(e) =>
                        setEncryptionMethod(
                          e.target.value as ExportEncryption["method"]
                        )
                      }
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="password">Password Protection</option>
                      <option value="generated">
                        Generate Random Password
                      </option>
                      <option value="none">No Encryption</option>
                    </select>
                  </div>
                </div>

                {encryptionMethod === "password" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a strong password"
                    />
                    <PasswordStrengthMeter password={password} />
                  </div>
                )}

                {type === "projects" && (
                  <div className="space-y-2">
                    <Label>Export Options</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="includeVariables"
                          checked={includeVariables}
                          onCheckedChange={(checked) =>
                            setIncludeVariables(checked as boolean)
                          }
                        />
                        <label
                          htmlFor="includeVariables"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Include variables (may contain sensitive data)
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {encryptionMethod === "none" && (
                  <Alert>
                    <AlertDescription>
                      Without encryption, your data will be readable by anyone
                      who has access to the file.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                <Download className=" h-4 w-4" />
                Export Selected ({selectedItems.size})
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-2">
                {exportResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <span className="text-sm font-medium">{result.name}</span>
                    <div className="flex items-center gap-2">
                      {result.status === "pending" && (
                        <span className="text-sm text-muted-foreground">
                          Exporting...
                        </span>
                      )}
                      {result.status === "success" && (
                        <>
                          <Check className="h-4 w-4 text-green-600" />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const filename = `${
                                result.name
                              }.penflow-${type.slice(0, -1)}`;
                              await exportApi.downloadFile(
                                result.downloadUrl!,
                                filename
                              );
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {result.status === "error" && (
                        <>
                          <X className="h-4 w-4 text-red-600" />
                          <span className="text-xs text-red-600">
                            {result.error}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {generatedPassword && (
              <Alert className="mb-4">
                <Key className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Generated Password:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono select-all">
                        {generatedPassword}
                      </code>
                      <Button size="sm" variant="ghost" onClick={copyPassword}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadPasswordFile}
                      >
                        <Download className=" h-3 w-3" />
                        Download Password
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {successCount} successful, {errorCount} failed
              </div>
              {successCount > 0 && (
                <Button onClick={handleDownloadAll} variant="outline">
                  <Download className=" h-4 w-4" />
                  Download All Successful
                </Button>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
