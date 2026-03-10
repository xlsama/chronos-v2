import { useEffect } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { CodeNode, CodeHighlightNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown'
import type { EditorState } from 'lexical'

const theme = {
  paragraph: 'mb-2',
  heading: {
    h1: 'text-3xl font-bold mb-4',
    h2: 'text-2xl font-bold mb-3',
    h3: 'text-xl font-bold mb-2',
  },
  list: {
    ul: 'list-disc ml-4 mb-2',
    ol: 'list-decimal ml-4 mb-2',
    listitem: 'mb-1',
  },
  quote: 'border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground mb-2',
  code: 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
  codeHighlight: {},
  link: 'text-primary underline',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    strikethrough: 'line-through',
    code: 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
  },
}

const nodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  HorizontalRuleNode,
]

interface RunbookEditorProps {
  initialContent: string
  onChange: (markdown: string) => void
}

function SetInitialContentPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editor.update(() => {
      $convertFromMarkdownString(content, TRANSFORMERS)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export function RunbookEditor({ initialContent, onChange }: RunbookEditorProps) {
  const handleChange = (editorState: EditorState) => {
    editorState.read(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS)
      onChange(markdown)
    })
  }

  const initialConfig = {
    namespace: 'RunbookEditor',
    theme,
    nodes,
    onError: (error: Error) => console.error(error),
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative flex-1 overflow-hidden rounded-lg border">
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="min-h-[calc(100vh-16rem)] p-4 outline-none" />
          }
          ErrorBoundary={({ children }) => <>{children}</>}
        />
        <HistoryPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <OnChangePlugin onChange={handleChange} />
        <SetInitialContentPlugin content={initialContent} />
      </div>
    </LexicalComposer>
  )
}
