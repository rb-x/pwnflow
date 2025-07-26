import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRendererImproved({ content, className }: MarkdownRendererProps) {
  const components: Components = {
    // Override code rendering to ensure inline code stays inline
    code({ node, className, children, ...props }) {
      // Check if this is a code block (has language class) or inline code
      const isCodeBlock = className?.startsWith('language-') || 
                         node?.position?.start.line !== node?.position?.end.line;
      
      if (isCodeBlock) {
        return (
          <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-2">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        );
      }
      
      // Inline code - ensure it stays inline with proper styling
      return (
        <code 
          className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono inline-block align-baseline" 
          {...props}
        >
          {children}
        </code>
      );
    },
    // Override paragraph to prevent excessive margins
    p({ children, ...props }) {
      return (
        <p className="mb-2 last:mb-0" {...props}>
          {children}
        </p>
      );
    },
    // Headers with reduced margins
    h1: ({ children, ...props }) => (
      <h1 className="text-xl font-semibold mb-2 mt-4 first:mt-0" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-lg font-semibold mb-2 mt-3 first:mt-0" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-base font-semibold mb-1 mt-2 first:mt-0" {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props}>{children}</h4>
    ),
    // Lists with proper spacing
    ul: ({ children, ...props }) => (
      <ul className="list-disc pl-5 mb-2 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal pl-5 mb-2 space-y-1" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }) => (
      <li className="mb-1" {...props}>{children}</li>
    ),
    // Blockquotes
    blockquote: ({ children, ...props }) => (
      <blockquote 
        className="border-l-4 border-border pl-4 italic my-2 text-muted-foreground" 
        {...props}
      >
        {children}
      </blockquote>
    ),
    // Links
    a: ({ children, href, ...props }) => (
      <a 
        className="text-primary underline underline-offset-2 hover:text-primary/80" 
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
    // Tables
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-2">
        <table className="border-collapse w-full" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-muted" {...props}>{children}</thead>
    ),
    th: ({ children, ...props }) => (
      <th className="border border-border p-2 text-left font-semibold" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border border-border p-2" {...props}>{children}</td>
    ),
    // Horizontal rule
    hr: ({ ...props }) => (
      <hr className="my-4 border-border" {...props} />
    ),
    // Strong/bold
    strong: ({ children, ...props }) => (
      <strong className="font-semibold" {...props}>{children}</strong>
    ),
    // Emphasis/italic
    em: ({ children, ...props }) => (
      <em className="italic" {...props}>{children}</em>
    ),
  };

  return (
    <div className={cn("text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}