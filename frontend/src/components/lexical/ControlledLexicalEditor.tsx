import { useCallback, useEffect, useRef } from "react";

import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";

import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { $getRoot } from "lexical";

import ExampleTheme from "./themes/ExampleTheme";
import ToolbarPluginComponent from "./plugins/ToolbarPlugin";
import ActionsPlugin from "./plugins/ActionsPlugin";
import CodeHighlightPlugin from "./plugins/CodeHighlightPlugin";
import ShortcutBlockerPlugin from "./plugins/ShortcutBlockerPlugin";
import { PLAYGROUND_TRANSFORMERS } from "./plugins/MarkdownTransformers";
import "./lexical.css";

// Lexical nodes
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { OverflowNode } from "@lexical/overflow";
import { MarkNode } from "@lexical/mark";

import { useFieldEditing, useFocusManagement } from "@/store/editingStore";

interface ControlledLexicalEditorProps {
  nodeId: string;
  field: string;
  projectId: string;
  serverValue: string;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onCommit?: (value: string) => void;
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="editor-placeholder">
      {text || "Start typing..."}
    </div>
  );
}

// Plugin to handle content synchronization with editing store
function EditingStorePlugin({
  nodeId,
  field,
  projectId,
  serverValue,
  onCommit
}: {
  nodeId: string;
  field: string;
  projectId: string;
  serverValue: string;
  onCommit?: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const fieldEditing = useFieldEditing(nodeId, field);
  const { isFocused } = useFocusManagement();

  const isCurrentlyFocused = isFocused(nodeId, field);
  const lastSetValueRef = useRef<string>('');
  const initializationCompleteRef = useRef(false);

  // Get the display value (editing value takes precedence over server value)
  const displayValue = fieldEditing.getDisplayValue(serverValue);

  // Handle content changes from editor
  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Only process updates when there are actual changes
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
        return;
      }

      editorState.read(() => {
        const currentMarkdown = $convertToMarkdownString(PLAYGROUND_TRANSFORMERS);

        // Avoid infinite loops by checking if this is the same value we just set
        if (currentMarkdown === lastSetValueRef.current) {
          return;
        }

        // Start editing if not already editing
        if (!fieldEditing.isEditing) {
          fieldEditing.startEditing(currentMarkdown);
        } else {
          // Update the editing store with new value
          fieldEditing.updateField(currentMarkdown, true); // Enable auto-save
        }
      });
    });

    return removeUpdateListener;
  }, [editor, fieldEditing]);

  // Handle external value changes (from server or editing store)
  useEffect(() => {
    // Don't update editor content if user is actively focused on this field
    // This prevents interrupting the user's typing
    if (isCurrentlyFocused && fieldEditing.isEditing) {
      return;
    }

    // Don't update if the display value is the same as what we last set
    if (displayValue === lastSetValueRef.current) {
      return;
    }

    // Update editor content with the display value
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (displayValue && displayValue.trim()) {
        $convertFromMarkdownString(displayValue, PLAYGROUND_TRANSFORMERS);
      }

      lastSetValueRef.current = displayValue;
    });
  }, [displayValue, editor, isCurrentlyFocused, fieldEditing.isEditing]);

  // Initialize editor content on mount
  useEffect(() => {
    if (initializationCompleteRef.current) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (displayValue && displayValue.trim()) {
        $convertFromMarkdownString(displayValue, PLAYGROUND_TRANSFORMERS);
      }

      lastSetValueRef.current = displayValue;
      initializationCompleteRef.current = true;
    });
  }, [editor, displayValue]);

  // Handle focus events
  useEffect(() => {
    const handleFocus = () => {
      fieldEditing.setFocus();
    };

    const handleBlur = () => {
      // Small delay to allow for focus to move to related elements
      setTimeout(() => {
        if (!document.activeElement || !editor.getRootElement()?.contains(document.activeElement)) {
          // Commit changes when losing focus
          if (fieldEditing.isDirty) {
            fieldEditing.commitEdit().then((success) => {
              if (success && onCommit) {
                const currentValue = fieldEditing.getDisplayValue(serverValue);
                onCommit(currentValue);
              }
            });
          }
        }
      }, 100);
    };

    const removeBlurListener = editor.registerRootListener((rootElement, prevRootElement) => {
      if (prevRootElement !== null) {
        prevRootElement.removeEventListener('focus', handleFocus);
        prevRootElement.removeEventListener('blur', handleBlur);
      }
      if (rootElement !== null) {
        rootElement.addEventListener('focus', handleFocus);
        rootElement.addEventListener('blur', handleBlur);
      }
    });

    return removeBlurListener;
  }, [editor, fieldEditing, onCommit, serverValue]);

  return null;
}

// Plugin to handle keyboard shortcuts for commit/cancel
function KeyboardShortcutPlugin({
  nodeId,
  field,
  onCommit
}: {
  nodeId: string;
  field: string;
  onCommit?: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const fieldEditing = useFieldEditing(nodeId, field);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to commit
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (fieldEditing.isDirty) {
          fieldEditing.commitEdit().then((success) => {
            if (success && onCommit) {
              const currentValue = fieldEditing.getDisplayValue();
              onCommit(currentValue);
            }
          });
        }
      }

      // Escape to cancel
      if (event.key === 'Escape') {
        event.preventDefault();
        fieldEditing.cancelEdit();
      }
    };

    const removeKeyDownListener = editor.registerRootListener((rootElement, prevRootElement) => {
      if (prevRootElement !== null) {
        prevRootElement.removeEventListener('keydown', handleKeyDown);
      }
      if (rootElement !== null) {
        rootElement.addEventListener('keydown', handleKeyDown);
      }
    });

    return removeKeyDownListener;
  }, [editor, fieldEditing, onCommit]);

  return null;
}

const editorConfig = {
  theme: ExampleTheme,
  onError(error: Error) {
    console.error('Lexical error:', error);
  },
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    AutoLinkNode,
    LinkNode,
    HorizontalRuleNode,
    OverflowNode,
    MarkNode
  ]
};

export default function ControlledLexicalEditor({
  nodeId,
  field,
  projectId,
  serverValue,
  placeholder = "Start typing...",
  autoFocus = false,
  readOnly = false,
  onCommit,
}: ControlledLexicalEditorProps) {
  const fieldEditing = useFieldEditing(nodeId, field);

  const initialConfig = {
    ...editorConfig,
    editable: !readOnly,
  };

  // Show visual indicator when field is dirty
  const isDirty = fieldEditing.isDirty;

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={`editor-container text-foreground ${isDirty ? 'border-orange-300 dark:border-orange-600' : ''}`}>
        {!readOnly && <ToolbarPluginComponent />}
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={<ContentEditable className="editor-input text-foreground" />}
            placeholder={<Placeholder text={placeholder} />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          {autoFocus && <AutoFocusPlugin />}
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={PLAYGROUND_TRANSFORMERS} />
          <CodeHighlightPlugin />
          <HorizontalRulePlugin />
          <ShortcutBlockerPlugin />

          {/* Our custom plugins for editing store integration */}
          <EditingStorePlugin
            nodeId={nodeId}
            field={field}
            projectId={projectId}
            serverValue={serverValue}
            onCommit={onCommit}
          />
          <KeyboardShortcutPlugin
            nodeId={nodeId}
            field={field}
            onCommit={onCommit}
          />
        </div>
        {!readOnly && <ActionsPlugin />}

        {/* Visual indicator for dirty state */}
        {isDirty && (
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
            Unsaved changes
          </div>
        )}
      </div>
    </LexicalComposer>
  );
}