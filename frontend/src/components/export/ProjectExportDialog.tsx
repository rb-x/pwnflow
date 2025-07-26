import { useState } from "react";
import { Download, Copy, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { exportApi } from "@/services/api/export";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

interface ProjectExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onOpenImportWithData?: (
    jobId: string,
    password: string,
    filename: string
  ) => void;
}

export function ProjectExportDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onOpenImportWithData,
}: ProjectExportDialogProps) {
  const [encryptionMethod, setEncryptionMethod] = useState<
    "none" | "password" | "generated"
  >("password");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [jobId, setJobId] = useState("");
  const [includeVariables, setIncludeVariables] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog is closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset all state when closing
      setPassword("");
      setPasswordConfirm("");
      setGeneratedPassword("");
      setJobId("");
      setIsExporting(false);
      setCopied(false);
      // Keep user preferences
      // setEncryptionMethod('password');
      // setIncludeVariables(true);
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
      const result = await exportApi.exportProject(projectId, {
        encryption: {
          method: encryptionMethod,
          password: encryptionMethod === "password" ? password : undefined,
        },
        options: {
          include_variables: includeVariables,
        },
      });

      // Store job ID for later download
      setJobId(result.job_id);

      // If generated password, show it
      if (result.generated_password) {
        setGeneratedPassword(result.generated_password);
        toast.success("Export ready! Save the generated password.");
      } else {
        // Download the file with authentication
        const filename = `${projectName
          .toLowerCase()
          .replace(/\s+/g, "-")}.penflow-project`;
        await exportApi.downloadFile(result.job_id, filename);

        toast.success("Project exported successfully");
        handleOpenChange(false);
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export project");
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

  const downloadPassword = async () => {
    if (generatedPassword && jobId) {
      // Download the file with authentication
      const filename = `${projectName
        .toLowerCase()
        .replace(/\s+/g, "-")}.penflow-project`;
      await exportApi.downloadFile(jobId, filename);

      // Also save password file
      const passwordBlob = new Blob(
        [
          `Penflow Export Password\n\nProject: ${projectName}\nPassword: ${generatedPassword}\n\nKeep this password safe! You'll need it to import the project.`,
        ],
        { type: "text/plain" }
      );
      const passwordUrl = URL.createObjectURL(passwordBlob);
      const passwordLink = document.createElement("a");
      passwordLink.href = passwordUrl;
      passwordLink.download = `${projectName
        .toLowerCase()
        .replace(/\s+/g, "-")}-password.txt`;
      document.body.appendChild(passwordLink);
      passwordLink.click();
      document.body.removeChild(passwordLink);
      URL.revokeObjectURL(passwordUrl);

      handleOpenChange(false);
    }
  };

  const handleImportNow = () => {
    if (onOpenImportWithData && jobId && generatedPassword) {
      const filename = `${projectName
        .toLowerCase()
        .replace(/\s+/g, "-")}.penflow-project`;
      onOpenImportWithData(jobId, generatedPassword, filename);
      handleOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="min-w-[40rem] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Export Project</DialogTitle>
          <DialogDescription>
            Export "{projectName}" as an encrypted file that can be imported
            later
          </DialogDescription>
        </DialogHeader>

        {!generatedPassword ? (
          <div className="space-y-6 py-6">
            <div className="space-y-3">
              <Label htmlFor="encryption-method">Encryption Method</Label>
              <Select
                value={encryptionMethod}
                onValueChange={(value) => setEncryptionMethod(value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select encryption method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Use my password</SelectItem>
                  <SelectItem value="generated">
                    Generate secure password
                  </SelectItem>
                  <SelectItem value="none">
                    No encryption (not recommended)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {encryptionMethod === "password" && (
              <div className="space-y-4">
                <div className="space-y-3">
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
                <div className="space-y-3">
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

            <div className="space-y-4">
              <Label>Export Options</Label>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="include-variables"
                    checked={includeVariables}
                    onCheckedChange={(checked) =>
                      setIncludeVariables(checked as boolean)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="include-variables"
                      className="font-normal cursor-pointer"
                    >
                      Include variable values
                    </Label>
                    <p className="text-muted-foreground text-xs mt-2">
                      Contains sensitive data like API keys and passwords
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {encryptionMethod === "none" && (
              <Alert variant="destructive">
                <AlertDescription>
                  ⚠️ Without encryption, anyone with the file can access your
                  data, including any sensitive information.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-6 py-6">
            <Alert>
              <AlertDescription className="space-y-4">
                <p className="font-medium text-foreground">
                  Generated Password:
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 p-3 bg-muted rounded text-sm font-mono select-all text-foreground">
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
                  Save this password! You'll need it to import the project.
                </p>
                {onOpenImportWithData && (
                  <div className="pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleImportNow}
                      className="w-full"
                    >
                      Import Now
                    </Button>
                  </div>
                )}
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
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          ) : (
            <Button onClick={downloadPassword}>
              <Download className="h-4 w-4" />
              Download Export
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
