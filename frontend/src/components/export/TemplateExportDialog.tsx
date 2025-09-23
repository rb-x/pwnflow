import { useState } from "react";
import { Download, Copy, Check, Info } from "lucide-react";
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
// import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { exportApi } from "@/services/api/export";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

interface TemplateExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
}

export function TemplateExportDialog({
  open,
  onOpenChange,
  templateId,
  templateName,
}: TemplateExportDialogProps) {
  const [encryptionMethod, setEncryptionMethod] = useState<
    "none" | "password" | "generated"
  >("password");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog is closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset all state when closing
      setPassword("");
      setPasswordConfirm("");
      setGeneratedPassword("");
      setIsExporting(false);
      setCopied(false);
    }
    onOpenChange(newOpen);
  };

  const handleExport = async () => {
    // Validate password if using custom password
    if (encryptionMethod === "password") {
      if (!password) {
        toast.error("Please enter a password");
        return;
      }
      if (password.length < 12) {
        toast.error("Password must be at least 12 characters");
        return;
      }
      if (password !== passwordConfirm) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setIsExporting(true);

    try {
      const result = await exportApi.exportTemplate(templateId, {
        encryption: {
          method: encryptionMethod,
          password: encryptionMethod === "password" ? password : undefined,
        },
      });

      // If generated password, show it
      if (result.generated_password) {
        setGeneratedPassword(result.generated_password);
        toast.success("Export ready! Save the generated password.");
      } else {
        // Download the file with authentication
        const filename = `${templateName
          .toLowerCase()
          .replace(/\s+/g, "-")}.pwnflow-template`;
        await exportApi.downloadFile(result.job_id, filename);

        toast.success("Template exported successfully");
        handleOpenChange(false);
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export template");
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Password copied to clipboard");
  };

  const downloadPassword = () => {
    if (generatedPassword) {
      // Download the file and password
      const result = exportApi.getDownloadUrl(
        `export_${templateId}_${generatedPassword}`
      );
      const link = document.createElement("a");
      link.href = result;
      link.download = `${templateName
        .toLowerCase()
        .replace(/\s+/g, "-")}.pwnflow-template`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Also save password file
      const passwordBlob = new Blob(
        [
          `Pwnflow Export Password\n\nTemplate: ${templateName}\nPassword: ${generatedPassword}\n\nKeep this password safe! You'll need it to import the template.`,
        ],
        { type: "text/plain" }
      );
      const passwordUrl = URL.createObjectURL(passwordBlob);
      const passwordLink = document.createElement("a");
      passwordLink.href = passwordUrl;
      passwordLink.download = `${templateName
        .toLowerCase()
        .replace(/\s+/g, "-")}-password.txt`;
      document.body.appendChild(passwordLink);
      passwordLink.click();
      document.body.removeChild(passwordLink);
      URL.revokeObjectURL(passwordUrl);

      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Template</DialogTitle>
          <DialogDescription>
            Export "{templateName}" as an encrypted file that can be shared
          </DialogDescription>
        </DialogHeader>

        {!generatedPassword ? (
          <div className="space-y-4 py-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Template exports are sanitized for security:</strong>
                <ul className="mt-2 text-sm list-disc list-inside">
                  <li>Variable values are removed</li>
                  <li>Command outputs are cleared</li>
                  <li>Only structure and content are preserved</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label htmlFor="encryption-method">Encryption Method</Label>
              <select
                id="encryption-method"
                value={encryptionMethod}
                onChange={(e) => setEncryptionMethod(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="password">Use my password</option>
                <option value="generated">Generate secure password</option>
                <option value="none">No encryption (for public sharing)</option>
              </select>
            </div>

            {encryptionMethod === "password" && (
              <div className="space-y-3">
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
                <div className="space-y-2">
                  <Label htmlFor="password-confirm">Confirm Password</Label>
                  <Input
                    id="password-confirm"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Confirm your password"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription className="space-y-3">
                <p className="font-medium">Generated Password:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono select-all">
                    {generatedPassword}
                  </code>
                  <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Save this password! You'll need it to import the template.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {!generatedPassword ? (
            <Button onClick={handleExport} disabled={isExporting}>
              <Download className=" h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          ) : (
            <Button onClick={downloadPassword}>
              <Download className=" h-4 w-4" />
              Download Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
