import { useEffect, useState, useRef } from "react";
import { X, Check, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMindMapStore } from "@/store/mindMapStore";
import { useNode, useUpdateNode } from "@/hooks/api/useNodes";
import UltraLexicalEditor from "@/components/stable/UltraLexicalEditor";
import { useOptimisticStatusUpdate } from "@/hooks/api/useOptimisticNodes";
import { editingManager, useEditingState } from "@/store/isolatedEditingStore";
import { cn } from "@/lib/utils";
import type { NodeData } from "@/types";

interface UltraSimpleNodeEditorProps {
  projectId: string;
  isReadOnly?: boolean;
  centerModal?: boolean;
  modalOpen?: boolean;
  onModalClose?: () => void;
}

export function UltraSimpleNodeEditor({
  projectId,
  isReadOnly = false,
  centerModal = false,
  modalOpen = false,
  onModalClose,
}: UltraSimpleNodeEditorProps) {
  const { selectedNodeId } = useMindMapStore();

  // Only work in centered modal mode
  const isOpen = centerModal ? modalOpen : false;
  const handleClose = centerModal ? onModalClose : () => {};

  // Get node data
  const { data: node } = useNode(projectId, selectedNodeId || "");

  // API mutations
  const updateNodeMutation = useUpdateNode();

  // New architecture hooks
  const optimisticStatusUpdate = useOptimisticStatusUpdate();

  // Register the mutation with the editing manager
  useEffect(() => {
    if (projectId) {
      editingManager.registerMutation(projectId, updateNodeMutation.mutateAsync);
    }
  }, [projectId, updateNodeMutation.mutateAsync]);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset editing when modal closes
  useEffect(() => {
    if (!isOpen && selectedNodeId) {
      editingManager.cancelEditing(selectedNodeId, 'title');
    }
  }, [isOpen, selectedNodeId]);

  // Handle ESC key to close centered modal
  useEffect(() => {
    if (!isOpen || !centerModal) return;

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, centerModal, handleClose]);

  // Track title editing state reactively
  const titleEditingState = useEditingState(selectedNodeId || '', 'title');
  const isTitleEditing = titleEditingState.isEditing;

  // Focus input when editing starts
  useEffect(() => {
    if (isTitleEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isTitleEditing]);

  // Handle title save with new architecture
  const handleTitleSave = async () => {
    if (!selectedNodeId) return;
    const success = await editingManager.commitEditing(selectedNodeId, 'title', projectId);
    if (success) {
      // Title editing automatically manages state and provides feedback
    }
  };

  // Handle status change with optimistic updates
  const handleStatusChange = async (status: string) => {
    if (!selectedNodeId) return;

    try {
      await optimisticStatusUpdate.mutateAsync({
        projectId,
        nodeId: selectedNodeId,
        status,
      });
    } catch (error) {
      // Error handling is done by the hook
    }
  };

  // Keyboard shortcuts for title editing
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === "Escape") {
      editingManager.cancelEditing(selectedNodeId || '', 'title');
    }
  };

  if (!node) return null;

  // Ultra-clean main content focused ONLY on description
  const NodeContent = () => (
    <>
      {/* Header */}
      <div className="flex flex-col space-y-2 text-center sm:text-left border-b border-border shrink-0">
        <div className="flex p-3 pr-12 items-center justify-between gap-4">
          {/* Title */}
          <div className="font-semibold flex items-center text-foreground flex-1 text-base">
            {isTitleEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  ref={titleInputRef}
                  value={titleEditingState.value || node.title}
                  onChange={(e) => {
                    e.stopPropagation();
                    editingManager.updateValue(selectedNodeId || '', 'title', e.target.value);
                  }}
                  onKeyDown={handleTitleKeyDown}
                  className="text-base font-semibold"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleTitleSave}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => editingManager.cancelEditing(selectedNodeId || '', 'title')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group rounded-lg px-2 flex-1 min-w-0 cursor-pointer hover:bg-muted/50">
                <div
                  className="py-1 rounded flex items-center gap-2 w-full"
                  onClick={() => !isReadOnly && editingManager.startEditing(selectedNodeId || '', 'title', node.title || '')}
                >
                  <span className="truncate max-w-[420px] flex-1">
                    {node.title}
                  </span>
                  <Edit2 className="h-3.5 w-3.5 transition-opacity shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Status selector */}
          <Select
            value={node.status}
            onValueChange={handleStatusChange}
            disabled={isReadOnly}
          >
            <SelectTrigger
              className="w-[180px] shrink-0 font-medium"
              disabled={isReadOnly}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_STARTED">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Not Started
                </div>
              </SelectItem>
              <SelectItem value="IN_PROGRESS">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  In Progress
                </div>
              </SelectItem>
              <SelectItem value="SUCCESS">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Success
                </div>
              </SelectItem>
              <SelectItem value="FAILED">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  Failed
                </div>
              </SelectItem>
              <SelectItem value="NOT_APPLICABLE">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-500" />
                  Not Applicable
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ULTRA-CLEAN DESCRIPTION SECTION - LASER FOCUSED */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-3 py-2 bg-muted/30">
          <h3 className="text-sm font-medium text-foreground">Description</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            <UltraLexicalEditor
              nodeId={selectedNodeId || ''}
              field="description"
              serverValue={node.description || ''}
              placeholder="Add a description (supports rich text and Markdown shortcuts)..."
              readOnly={isReadOnly}
              projectId={projectId}
              onCommit={(value) => {
                console.log('Description committed with ultra-stable architecture:', value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              🎯 Ultra-stable editor • Zero focus loss • Auto-save • No re-renders
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {centerModal ? (
        /* Centered Modal */
        <div className={cn(
          "fixed inset-0 z-[60] flex items-center justify-center bg-black/50",
          isOpen ? "visible" : "invisible"
        )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <div
            className={cn(
              "relative z-[70] bg-background border rounded-lg shadow-xl",
              "w-full max-w-6xl h-[90vh] mx-4",
              "flex flex-col overflow-hidden",
              "transition-all duration-300",
              isOpen
                ? "scale-100 opacity-100"
                : "scale-95 opacity-0"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-3 right-3 h-8 w-8 z-10"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>

            <NodeContent />
          </div>
        </div>
      ) : null}
    </>
  );
}