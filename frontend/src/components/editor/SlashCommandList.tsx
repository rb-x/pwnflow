import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Heading1,
  Heading2,
  Heading3,
  TextQuote,
  Code2,
  List,
  ListOrdered,
  Minus,
  Text,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  command?: (...args: unknown[]) => void;
  keywords?: string[];
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const DEFAULT_SLASH_ITEMS = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    keywords: ['h1', 'title', 'heading1'],
  },
  {
    title: 'Heading 2',
    description: 'Sub-section heading',
    icon: Heading2,
    keywords: ['h2', 'subtitle', 'heading2'],
  },
  {
    title: 'Heading 3',
    description: 'Tertiary heading',
    icon: Heading3,
    keywords: ['h3', 'subheading', 'heading3'],
  },
  {
    title: 'Paragraph',
    description: 'Plain paragraph text',
    icon: Text,
    keywords: ['text', 'body', 'paragraph'],
  },
  {
    title: 'Bullet List',
    description: 'Create an unordered list',
    icon: List,
    keywords: ['list', 'bullets', 'unordered'],
  },
  {
    title: 'Numbered List',
    description: 'Create an ordered list',
    icon: ListOrdered,
    keywords: ['ordered', 'numbers', 'ol'],
  },
  {
    title: 'Code Block',
    description: 'Insert a fenced code block',
    icon: Code2,
    keywords: ['code', 'snippet', 'developer'],
  },
  {
    title: 'Quote',
    description: 'Call out a quote',
    icon: TextQuote,
    keywords: ['blockquote', 'quote', 'remark'],
  },
  {
    title: 'Divider',
    description: 'Insert a horizontal rule',
    icon: Minus,
    keywords: ['divider', 'rule', 'line', 'hr'],
  },
] satisfies Omit<SlashCommandItem, 'command'>[];

export const SlashCommandList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  SlashCommandListProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    if (!items.length) return;
    const item = items[Math.max(0, Math.min(index, items.length - 1))];
    if (!item) return;
    command(item);
  };

  const upHandler = () => {
    setSelectedIndex((index) => (index + items.length - 1) % items.length);
  };

  const downHandler = () => {
    setSelectedIndex((index) => (index + 1) % items.length);
  };

  const enterHandler = () => {
    if (!items.length) return false;
    selectItem(selectedIndex);
    return true;
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        return enterHandler();
      }
      return false;
    },
  }));

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  if (!items.length) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No matches. Try searching for headings, lists, or code.
      </div>
    );
  }

  return (
    <div className="max-h-64 w-72 overflow-y-auto p-1">
      {items.map((item, index) => {
        const Icon = item.icon;
        const isActive = index === selectedIndex;

        return (
          <button
            key={item.title}
            className={cn(
              'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-foreground hover:bg-muted'
            )}
            onClick={() => selectItem(index)}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-medium leading-none">{item.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
});

SlashCommandList.displayName = 'SlashCommandList';
