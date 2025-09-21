import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
// import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useScopeStore, type ServiceStatus } from "@/store/scopeStore";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";

interface ImportNmapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ImportNmapDialog({ open, onOpenChange, projectId }: ImportNmapDialogProps) {
  const { importNmapXml, loading } = useScopeStore();
  
  const [xmlContent, setXmlContent] = useState("");
  const [openPortsOnly, setOpenPortsOnly] = useState(true);
  const [defaultStatus, setDefaultStatus] = useState<ServiceStatus>("not_tested");
  const [importStats, setImportStats] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!xmlContent.trim()) {
      return;
    }

    setImporting(true);
    setImportStats(null);

    try {
      const stats = await importNmapXml(projectId, xmlContent, {
        open_ports_only: openPortsOnly,
        default_status: defaultStatus
      });

      if (stats) {
        setImportStats(stats);
        // Clear the XML content after successful import
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
    if (file && file.type === "text/xml") {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Nmap Scan
          </DialogTitle>
          <DialogDescription>
            Import services and hosts from Nmap XML scan results into your project scope.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* File Upload Section */}
          <div className="space-y-2">
            <Label>Upload XML File</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => document.getElementById('xml-file')?.click()}
              >
                <FileText className="h-4 w-4 mr-2" />
                Choose Nmap XML File
              </Button>
              <input
                id="xml-file"
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* XML Content Input */}
          <div className="space-y-2">
            <Label>XML Content</Label>
            <Textarea
              placeholder="Paste your Nmap XML output here..."
              value={xmlContent}
              onChange={(e) => setXmlContent(e.target.value)}
              className="h-40 font-mono text-sm"
              disabled={importing}
            />
          </div>

          {/* Import Settings */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <h4 className="text-sm font-semibold">Import Settings</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm">Open Ports Only</Label>
                <p className="text-xs text-muted-foreground">
                  Only import open ports, skip closed/filtered ports
                </p>
              </div>
              <input
                type="checkbox"
                checked={openPortsOnly}
                onChange={(e) => setOpenPortsOnly(e.target.checked)}
                disabled={importing}
                className="rounded"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Default Status</Label>
              <Select value={defaultStatus} onValueChange={(value) => setDefaultStatus(value as ServiceStatus)} disabled={importing}>
                <SelectTrigger>
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

          {/* Import Results */}
          {importStats && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                {importStats.errors && importStats.errors.length > 0 ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                Import Results
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Hosts Processed:</span>
                    <Badge variant="outline">{importStats.hosts_processed}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Services Created:</span>
                    <Badge variant="outline">{importStats.services_created}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Services Updated:</span>
                    <Badge variant="outline">{importStats.services_updated}</Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Hostnames Linked:</span>
                    <Badge variant="outline">{importStats.hostnames_linked}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">VHosts Detected:</span>
                    <Badge variant="outline">{importStats.vhosts_detected}</Badge>
                  </div>
                </div>
              </div>

              {importStats.errors && importStats.errors.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-red-600">Errors:</Label>
                  <div className="space-y-1">
                    {importStats.errors.map((error: string, index: number) => (
                      <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={importing}>
            Reset
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Close
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!xmlContent.trim() || importing}
            className="min-w-[100px]"
          >
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}