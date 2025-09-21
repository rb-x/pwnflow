import { useCallback, useEffect, useRef, useState } from "react";
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

import ExampleTheme from "@/components/lexical/themes/ExampleTheme";
import ToolbarPluginComponent from "@/components/lexical/plugins/ToolbarPlugin";
import ActionsPlugin from "@/components/lexical/plugins/ActionsPlugin";
import CodeHighlightPlugin from "@/components/lexical/plugins/CodeHighlightPlugin";
import ShortcutBlockerPlugin from "@/components/lexical/plugins/ShortcutBlockerPlugin";
import { PLAYGROUND_TRANSFORMERS } from "@/components/lexical/plugins/MarkdownTransformers";
import "@/components/lexical/lexical.css";

// Lexical nodes
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { OverflowNode } from "@lexical/overflow";
import { MarkNode } from "@lexical/mark";

import { editingManager } from "@/store/isolatedEditingStore";
import { cn } from "@/lib/utils";

interface UltraLexicalEditorProps {
  nodeId: string;
  field: string;
  serverValue: string;
  placeholder?: string;
  readOnly?: boolean;
  projectId?: string;
  onCommit?: (value: string) => void;
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="editor-placeholder">
      {text || "Start typing..."}
    </div>
  );
}

// Ultra-isolated content management plugin
function UltraContentPlugin({
  nodeId,
  field,
  serverValue,
  projectId,
  onCommit
}: {
  nodeId: string;
  field: string;
  serverValue: string;
  projectId?: string;
  onCommit?: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const isInitializedRef = useRef(false);
  const lastServerValueRef = useRef(serverValue);
  const ignoreNextUpdateRef = useRef(false);

  // Initialize content only once
  useEffect(() => {
    if (isInitializedRef.current) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (serverValue && serverValue.trim()) {
        $convertFromMarkdownString(serverValue, PLAYGROUND_TRANSFORMERS);
      }

      isInitializedRef.current = true;
    });
  }, [editor, serverValue]);

  // Handle content changes from editor - NEVER triggers re-renders
  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (ignoreNextUpdateRef.current) {
        ignoreNextUpdateRef.current = false;
        return;
      }

      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
        return;
      }

      editorState.read(() => {
        const currentMarkdown = $convertToMarkdownString(PLAYGROUND_TRANSFORMERS);

        // Start or update editing session without triggering React updates
        if (!editingManager.isActive(nodeId, field)) {
          editingManager.startEditing(nodeId, field, currentMarkdown);
        } else {
          editingManager.updateValue(nodeId, field, currentMarkdown);
        }
      });
    });

    return removeUpdateListener;
  }, [editor, nodeId, field]);

  // Handle server value changes only when not actively editing
  useEffect(() => {
    if (lastServerValueRef.current === serverValue) return;
    if (editingManager.isActive(nodeId, field)) return;

    ignoreNextUpdateRef.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (serverValue && serverValue.trim()) {
        $convertFromMarkdownString(serverValue, PLAYGROUND_TRANSFORMERS);
      }
    });

    lastServerValueRef.current = serverValue;
  }, [serverValue, editor, nodeId, field]);

  // Focus management
  useEffect(() => {
    const handleFocus = () => {
      editingManager.setFocus(nodeId, field);
    };

    const handleBlur = () => {
      // Small delay to check if focus moved to related element
      setTimeout(() => {
        const rootElement = editor.getRootElement();
        if (!rootElement?.contains(document.activeElement)) {
          // Commit changes when losing focus
          if (editingManager.isActive(nodeId, field)) {
            editingManager.commitEditing(nodeId, field, projectId).then((success) => {
              if (success && onCommit) {
                const value = editingManager.getValue(nodeId, field, serverValue);
                onCommit(value);
              }
            });
          }
        }
      }, 100);
    };

    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.addEventListener('focus', handleFocus);
      rootElement.addEventListener('blur', handleBlur);

      return () => {
        rootElement.removeEventListener('focus', handleFocus);
        rootElement.removeEventListener('blur', handleBlur);
      };
    }
  }, [editor, nodeId, field, onCommit, serverValue]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to commit
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (editingManager.isActive(nodeId, field)) {
          editingManager.commitEditing(nodeId, field, projectId).then((success) => {
            if (success && onCommit) {
              const value = editingManager.getValue(nodeId, field, serverValue);
              onCommit(value);
            }
          });
        }
      }

      // Escape to cancel
      if (event.key === 'Escape') {
        event.preventDefault();
        editingManager.cancelEditing(nodeId, field);

        // Restore original content
        ignoreNextUpdateRef.current = true;
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          if (serverValue && serverValue.trim()) {
            $convertFromMarkdownString(serverValue, PLAYGROUND_TRANSFORMERS);
          }
        });
      }
    };

    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.addEventListener('keydown', handleKeyDown);
      return () => rootElement.removeEventListener('keydown', handleKeyDown);
    }
  }, [editor, nodeId, field, onCommit, serverValue]);

  return null;
}

const editorConfig = {
  theme: ExampleTheme,
  onError(error: Error) {
    console.error('Ultra Lexical error:', error);
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

export default function UltraLexicalEditor({
  nodeId,
  field,
  serverValue,
  placeholder = "Start typing...",
  readOnly = false,
  projectId,
  onCommit,
}: UltraLexicalEditorProps) {
  const [initialConfig] = useState({
    ...editorConfig,
    editable: !readOnly,
  });

  // Get editing state without causing re-renders
  const isEditing = editingManager.isActive(nodeId, field);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn(
        "editor-container text-foreground",
        isEditing ? "ring-2 ring-orange-300 dark:ring-orange-600" : ""
      )}>
        {!readOnly && <ToolbarPluginComponent />}
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={<ContentEditable className="editor-input text-foreground" />}
            placeholder={<Placeholder text={placeholder} />}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={PLAYGROUND_TRANSFORMERS} />
          <CodeHighlightPlugin />
          <HorizontalRulePlugin />
          <ShortcutBlockerPlugin />

          {/* Ultra-isolated content management */}
          <UltraContentPlugin
            nodeId={nodeId}
            field={field}
            serverValue={serverValue}
            projectId={projectId}
            onCommit={onCommit}
          />
        </div>
        {!readOnly && <ActionsPlugin />}

        {/* Visual indicator for active editing */}
        {isEditing && (
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
            Editing (auto-save)
          </div>
        )}
      </div>
    </LexicalComposer>
  );
}