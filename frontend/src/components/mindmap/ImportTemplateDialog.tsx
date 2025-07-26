import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Loader2 } from "lucide-react";
import { useTemplates } from "@/hooks/api/useTemplates";
import { useImportTemplate } from "@/hooks/api/useProjects";
import type { Template } from "@/types/api";

interface ImportTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export function ImportTemplateDialog({
  isOpen,
  onClose,
  projectId,
}: ImportTemplateDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  const { data: templates, isLoading } = useTemplates();
  const importTemplate = useImportTemplate();

  const filteredTemplates =
    templates?.filter(
      (template) =>
        template.name.toLowerCase().includes(search.toLowerCase()) ||
        template.description?.toLowerCase().includes(search.toLowerCase()) ||
        template.category_tags?.some((tag) =>
          tag.toLowerCase().includes(search.toLowerCase())
        )
    ) || [];

  const handleImport = async () => {
    if (!selectedTemplate) return;

    try {
      await importTemplate.mutateAsync({
        projectId,
        templateId: selectedTemplate.id,
      });
      onClose();
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplate(null);
      setSearch("");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-[40rem] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Template</DialogTitle>
          <DialogDescription>
            Import a template to add its nodes and structure to your current
            project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates by name, description, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-lg p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No templates found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <h4 className="font-medium">{template.name}</h4>
                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        {template.category_tags &&
                          template.category_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.category_tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedTemplate || importTemplate.isPending}
          >
            {importTemplate.isPending && (
              <Loader2 className=" h-4 w-4 animate-spin" />
            )}
            Import Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
