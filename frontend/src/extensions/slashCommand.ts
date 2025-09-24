import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { SlashCommandList, DEFAULT_SLASH_ITEMS } from '@/components/editor/SlashCommandList';
import type { SlashCommandItem } from '@/components/editor/SlashCommandList';
import type { SuggestionProps } from '@tiptap/suggestion';
import type { Instance as TippyInstance } from 'tippy.js';

import 'tippy.js/dist/tippy.css';

interface CommandProps {
  editor: any;
  range: { from: number; to: number };
}

type SuggestionCommandItem = SlashCommandItem & {
  aliases: string[];
  command: (props: CommandProps) => void;
};

const COMMANDS: SuggestionCommandItem[] = DEFAULT_SLASH_ITEMS.map((item) => {
  switch (item.title) {
    case 'Heading 1':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
        },
      };
    case 'Heading 2':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
        },
      };
    case 'Heading 3':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
        },
      };
    case 'Paragraph':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setParagraph().run();
        },
      };
    case 'Bullet List':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      };
    case 'Numbered List':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      };
    case 'Code Block':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      };
    case 'Quote':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      };
    case 'Divider':
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      };
    default:
      return {
        ...item,
        aliases: item.keywords ?? [],
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setParagraph().run();
        },
      };
  }
});

const getSuggestionItems = ({ query }: { query: string }) => {
  if (!query) {
    return COMMANDS;
  }
  return COMMANDS.filter((item) => {
    const search = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(search) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(search))
    );
  });
};

export const SlashCommand = Extension.create({
  name: 'slash-command',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          if (!props?.item) {
            return;
          }
          props.item.command?.({ editor, range });
        },
        items: getSuggestionItems,
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance[] | null = null;

          const createProps = (props: SuggestionProps<SlashCommandItem>) => ({
            items: (props.items as SuggestionCommandItem[]) ?? [],
            command: (item: SuggestionCommandItem) => {
              item?.command?.({ editor: props.editor, range: props.range });
            },
          });

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(SlashCommandList, {
                props: createProps(props),
                editor: props.editor,
              });

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'light-border',
              });
            },

            onUpdate(props: SuggestionProps<SlashCommandItem>) {
              component?.updateProps(createProps(props));
              if (popup) {
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              }
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.[0].hide();
                return true;
              }

              if (!component?.ref) {
                return false;
              }

              return component.ref.onKeyDown(props);
            },

            onExit() {
              popup?.[0].destroy();
              component?.destroy();
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
