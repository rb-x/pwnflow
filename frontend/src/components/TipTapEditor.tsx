import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { createLowlight, common } from 'lowlight';
import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Quote,
  Link as LinkIcon,
  Lock,
  Unlock,
  Highlighter,
  Minus,
  FileCode,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TipTapEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function TipTapEditor({
  initialContent = '',
  onChange,
  placeholder = 'Start typing...',
  readOnly = false,
}: TipTapEditorProps) {
  const [isLocked, setIsLocked] = useState(readOnly);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [rawMarkdown, setRawMarkdown] = useState(initialContent);
  const lastContentRef = useRef<string>('');
  const isInitializedRef = useRef(false);

  // Create lowlight instance with common languages
  const lowlight = createLowlight(common);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead
        history: {
          depth: 100,
        },
        // Disable aggressive heading shortcuts
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // Disable typography to prevent auto-conversion of markdown syntax
        typography: false,
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: false,  // Disable auto-linking
        breaks: false,
        transformPastedText: false,  // Don't auto-transform pasted text
        transformCopiedText: false,  // Don't transform when copying
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'rounded-md bg-muted p-4 font-mono text-sm overflow-x-auto',
        },
        defaultLanguage: 'plaintext',
      }),
      Placeholder.configure({
        placeholder,
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Underline,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none',
          'dark:prose-invert', // This makes prose work in dark mode
          'min-h-[200px] px-4 py-3',
          'text-foreground', // Ensure text uses the foreground color
          '[&_pre]:bg-muted [&_pre]:text-foreground',
          '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-foreground',
          // Syntax highlighting classes for lowlight/highlight.js
          '[&_.hljs-comment]:text-muted-foreground [&_.hljs-comment]:italic',
          '[&_.hljs-quote]:text-muted-foreground [&_.hljs-quote]:italic',
          '[&_.hljs-keyword]:text-purple-600 dark:[&_.hljs-keyword]:text-purple-400',
          '[&_.hljs-selector-tag]:text-purple-600 dark:[&_.hljs-selector-tag]:text-purple-400',
          '[&_.hljs-string]:text-green-600 dark:[&_.hljs-string]:text-green-400',
          '[&_.hljs-doctag]:text-green-600 dark:[&_.hljs-doctag]:text-green-400',
          '[&_.hljs-number]:text-cyan-600 dark:[&_.hljs-number]:text-cyan-400',
          '[&_.hljs-literal]:text-cyan-600 dark:[&_.hljs-literal]:text-cyan-400',
          '[&_.hljs-type]:text-cyan-600 dark:[&_.hljs-type]:text-cyan-400',
          '[&_.hljs-class]:text-cyan-600 dark:[&_.hljs-class]:text-cyan-400',
          '[&_.hljs-function]:text-blue-600 dark:[&_.hljs-function]:text-blue-400',
          '[&_.hljs-title]:text-blue-600 dark:[&_.hljs-title]:text-blue-400',
          '[&_.hljs-section]:text-blue-600 dark:[&_.hljs-section]:text-blue-400',
          '[&_.hljs-params]:text-orange-600 dark:[&_.hljs-params]:text-orange-400',
          '[&_.hljs-meta]:text-orange-600 dark:[&_.hljs-meta]:text-orange-400',
          '[&_.hljs-attribute]:text-yellow-600 dark:[&_.hljs-attribute]:text-yellow-400',
          '[&_.hljs-name]:text-yellow-600 dark:[&_.hljs-name]:text-yellow-400',
          '[&_.hljs-builtin-name]:text-yellow-600 dark:[&_.hljs-builtin-name]:text-yellow-400',
          '[&_.hljs-variable]:text-red-600 dark:[&_.hljs-variable]:text-red-400',
          '[&_.hljs-bullet]:text-red-600 dark:[&_.hljs-bullet]:text-red-400',
          '[&_.hljs-symbol]:text-red-600 dark:[&_.hljs-symbol]:text-red-400',
          '[&_.hljs-addition]:text-green-600 dark:[&_.hljs-addition]:text-green-400',
          '[&_.hljs-deletion]:text-red-600 dark:[&_.hljs-deletion]:text-red-400',
          '[&_.hljs-emphasis]:italic',
          '[&_.hljs-strong]:font-bold',
          '[&_ul]:list-disc [&_ol]:list-decimal',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground',
          '[&_p]:text-foreground [&_li]:text-foreground',
        ),
      },
      handleKeyDown: (view, event) => {
        // Stop propagation of all keyboard events when editor is focused
        event.stopPropagation();

        // Handle Tab key for indentation
        if (event.key === 'Tab') {
          event.preventDefault();
          if (event.shiftKey) {
            // Outdent
            return editor?.chain().liftListItem('listItem').run() ||
                   editor?.chain().outdent?.().run() || false;
          } else {
            // Indent
            return editor?.chain().sinkListItem('listItem').run() ||
                   editor?.chain().indent?.().run() || false;
          }
        }

        // Let TipTap handle other keys normally
        return false;
      },
    },
    editable: !isLocked,
    onUpdate: ({ editor }) => {
      // Get markdown content
      const markdown = editor.storage.markdown.getMarkdown();

      // Update raw markdown state
      setRawMarkdown(markdown);

      // Only call onChange if content actually changed
      if (markdown !== lastContentRef.current) {
        lastContentRef.current = markdown;
        onChange?.(markdown);
      }
    },
    immediatelyRender: false,
  });

  // Initialize content
  useEffect(() => {
    if (!editor || isInitializedRef.current) return;

    if (initialContent) {
      // Set content as markdown
      editor.commands.setContent(initialContent);
      lastContentRef.current = initialContent;
    }

    isInitializedRef.current = true;
  }, [editor, initialContent]);

  // Update content when it changes externally (but only if not currently editing)
  useEffect(() => {
    if (!editor || !isInitializedRef.current) return;

    // Don't update if the content is the same
    if (initialContent === lastContentRef.current) return;

    // Don't update if the editor is focused (user is editing)
    if (editor.isFocused) return;

    editor.commands.setContent(initialContent);
    lastContentRef.current = initialContent;
  }, [editor, initialContent]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isLocked);
    }
  }, [editor, isLocked]);

  // Toggle lock state
  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  if (!editor) {
    return null;
  }

  return (
    <div
      className="border rounded-md overflow-hidden"
      onKeyDown={(e) => {
        // Stop all keyboard events from bubbling up when editor is focused
        if (editor?.isFocused) {
          e.stopPropagation();
        }
      }}
    >
      {!readOnly && (
        <div className="flex items-center gap-1 p-2 border-b flex-wrap bg-background">
          {/* Lock/Unlock button */}
          <Button
            onClick={toggleLock}
            variant={isLocked ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-2 gap-1"
          >
            {isLocked ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                <span className="text-xs">Locked</span>
              </>
            ) : (
              <>
                <Unlock className="h-3.5 w-3.5" />
                <span className="text-xs">Editing</span>
              </>
            )}
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Text formatting */}
          <Button
            onClick={() => editor.chain().focus().toggleBold().run()}
            variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked || !editor.can().chain().focus().toggleBold().run()}
            className="h-8 w-8 p-0"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked || !editor.can().chain().focus().toggleItalic().run()}
            className="h-8 w-8 p-0"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked || !editor.can().chain().focus().toggleUnderline().run()}
            className="h-8 w-8 p-0"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleCode().run()}
            variant={editor.isActive('code') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked || !editor.can().chain().focus().toggleCode().run()}
            className="h-8 w-8 p-0"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            variant={editor.isActive('highlight') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked || !editor.can().chain().focus().toggleHighlight().run()}
            className="h-8 w-8 p-0"
          >
            <Highlighter className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Headings */}
          <Button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <Heading3 className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Lists */}
          <Button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Special blocks */}
          <Button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            variant="ghost"
            size="sm"
            disabled={isLocked}
            className="h-8 w-8 p-0"
          >
            <Minus className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Undo/Redo */}
          <Button
            onClick={() => editor.chain().focus().undo().run()}
            variant="ghost"
            size="sm"
            disabled={isLocked || !editor.can().chain().focus().undo().run()}
            className="h-8 w-8 p-0"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => editor.chain().focus().redo().run()}
            variant="ghost"
            size="sm"
            disabled={isLocked || !editor.can().chain().focus().redo().run()}
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Raw Markdown Toggle */}
          <Button
            onClick={() => setShowRawMarkdown(!showRawMarkdown)}
            variant={showRawMarkdown ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2 gap-1"
            title={showRawMarkdown ? 'Show Rich Text' : 'Show Raw Markdown'}
          >
            {showRawMarkdown ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span className="text-xs">Rich</span>
              </>
            ) : (
              <>
                <FileCode className="h-3.5 w-3.5" />
                <span className="text-xs">Raw</span>
              </>
            )}
          </Button>
        </div>
      )}

      {showRawMarkdown ? (
        <div className="relative">
          <Textarea
            value={rawMarkdown}
            onChange={(e) => {
              const newMarkdown = e.target.value;
              setRawMarkdown(newMarkdown);
              // Update the editor content
              editor?.commands.setContent(newMarkdown);
              // Call onChange
              onChange?.(newMarkdown);
            }}
            className="min-h-[200px] px-4 py-3 font-mono text-sm resize-none border-0 focus:outline-none"
            placeholder="Enter markdown..."
            readOnly={isLocked}
          />
        </div>
      ) : (
        <EditorContent
          editor={editor}
          onClick={() => {
            // Focus the editor when clicking anywhere in the content area
            if (!editor?.isFocused && !isLocked) {
              editor?.chain().focus().run();
            }
          }}
        />
      )}
    </div>
  );
}