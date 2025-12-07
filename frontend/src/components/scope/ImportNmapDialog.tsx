import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useScopeStore, type ServiceStatus } from "@/store/scopeStore";
import { Upload, FileText, AlertCircle, CheckCircle2, Info } from "lucide-react";

interface ImportNmapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ImportNmapDialog({ open, onOpenChange, projectId }: ImportNmapDialogProps) {
  const { importNmapXml } = useScopeStore();

  const [xmlContent, setXmlContent] = useState("");
  const [openPortsOnly, setOpenPortsOnly] = useState(true);
  const [defaultStatus, setDefaultStatus] = useState<ServiceStatus>("not_tested");
  const [importStats, setImportStats] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!xmlContent.trim()) return;

    setImporting(true);
    setImportStats(null);

    try {
      const stats = await importNmapXml(projectId, xmlContent, {
        open_ports_only: openPortsOnly,
        default_status: defaultStatus
      });

      if (stats) {
        setImportStats(stats);
        setXmlContent("");
      }
    } catch (error) {
      console.error("Import failed:", error);
      setImportStats({
        hosts_processed: 0,
        services_created: 0,
        services_updated: 0,
        hostnames_linked: 0,
        vhosts_detected: 0,
        errors: ["Import failed. Please check your XML format."]
      });
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setXmlContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleReset = () => {
    setXmlContent("");
    setImportStats(null);
    setOpenPortsOnly(true);
    setDefaultStatus("not_tested");
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            Import Nmap XML
          </DialogTitle>
          <DialogDescription className="text-xs mt-1">
            Import services from an Nmap XML scan file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {/* File Upload */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full h-9"
              onClick={() => document.getElementById('xml-file')?.click()}
              disabled={importing}
            >
              <FileText className="h-4 w-4 mr-2" />
              Choose XML File
            </Button>
            <input
              id="xml-file"
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* XML Content */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">XML Content</Label>
            <Textarea
              placeholder="Or paste Nmap XML output here..."
              value={xmlContent}
              onChange={(e) => setXmlContent(e.target.value)}
              className="h-32 font-mono text-xs resize-none"
              disabled={importing}
            />
          </div>

          {/* Info about merge behavior */}
          {xmlContent.trim() && !importStats && (
            <div className="flex items-start gap-2 p-3 border rounded-md bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 max-w-full overflow-hidden">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300 break-words">
                Duplicate services (same IP:port) will be merged — new hostnames and notes will be added to existing entries.
              </p>
            </div>
          )}

          {/* Settings */}
          <div className="space-y-3 p-3 border rounded-md bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Open Ports Only</Label>
                <p className="text-xs text-muted-foreground">Skip closed/filtered ports</p>
              </div>
              <Switch
                checked={openPortsOnly}
                onCheckedChange={setOpenPortsOnly}
                disabled={importing}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Default Status</Label>
              <Select
                value={defaultStatus}
                onValueChange={(value) => setDefaultStatus(value as ServiceStatus)}
                disabled={importing}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_tested">Not Tested</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="clean">Clean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          {importStats && (
            <div className="space-y-3 p-3 border rounded-md">
              <div className="flex items-center gap-2">
                {importStats.errors?.length > 0 ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <span className="text-xs font-medium">
                  {importStats.errors?.length > 0 ? "Import completed with errors" : "Import successful"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hosts:</span>
                  <Badge variant="secondary" className="h-5 text-xs">{importStats.hosts_processed}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New:</span>
                  <Badge variant="secondary" className="h-5 text-xs bg-green-100 text-green-800">{importStats.services_created}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merged:</span>
                  <Badge variant="secondary" className="h-5 text-xs bg-blue-100 text-blue-800">{importStats.services_updated}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VHosts:</span>
                  <Badge variant="secondary" className="h-5 text-xs">{importStats.vhosts_detected}</Badge>
                </div>
              </div>

              {importStats.services_updated > 0 && importStats.errors?.length === 0 && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Existing services were updated with new hostnames and notes.
                </p>
              )}

              {importStats.errors?.length > 0 && (
                <div className="space-y-1">
                  {importStats.errors.map((error: string, i: number) => (
                    <p key={i} className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={importing}>
            Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={importing}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={!xmlContent.trim() || importing}
          >
            {importing ? "Importing..." : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
