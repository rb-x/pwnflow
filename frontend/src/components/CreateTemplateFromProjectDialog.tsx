import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/TagInput";
import { Loader2 } from "lucide-react";
import { useCreateTemplate } from "@/hooks/api/useTemplates";
import { useCategoryTags } from "@/hooks/api/useCategoryTags";

interface CreateTemplateFromProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function CreateTemplateFromProjectDialog({
  isOpen,
  onClose,
  projectId,
  projectName,
}: CreateTemplateFromProjectDialogProps) {
  const [name, setName] = useState(`${projectName} Template`);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const { data: categoryTags } = useCategoryTags();
  const createTemplate = useCreateTemplate();

  const tagSuggestions = categoryTags?.map((tag) => tag.name) || [];

  const handleCreate = async () => {
    if (!name.trim()) return;

    const uniqueTags = Array.from(
      new Set(tags.map((tag) => tag.toLowerCase()))
    ).map((lowerTag) => tags.find((tag) => tag.toLowerCase() === lowerTag)!);

    try {
      await createTemplate.mutateAsync({
        name,
        description: description || null,
        source_project_id: projectId,
        category_tags: uniqueTags.length > 0 ? uniqueTags : undefined,
      });
      onClose();
    } catch (error) {
      // Error is handled by the mutation hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Template from Project</DialogTitle>
          <DialogDescription>
            Create a reusable template from "{projectName}". Sensitive data will
            be automatically removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template includes"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Category Tags</Label>
            <TagInput
              value={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              placeholder="Add tags to categorize your template..."
            />
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">
              This template will include:
            </p>
            <ul className="text-sm space-y-1">
              <li>• All nodes and their connections</li>
              <li>• Commands and findings</li>
              <li>
                • Non-sensitive variables (sensitive values will be cleared)
              </li>
              <li>• Project structure and organization</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createTemplate.isPending}
          >
            {createTemplate.isPending && (
              <Loader2 className=" h-4 w-4 animate-spin" />
            )}
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
