import type { CSSProperties } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  CodeToggle,
  codeBlockPlugin,
  codeMirrorPlugin,
  ConditionalContents,
  CreateLink,
  headingsPlugin,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor'
import { cn } from '@/lib/utils'

const CODE_BLOCK_LANGUAGES: Record<string, string> = {
  plaintext: 'Plain text',
  markdown: 'Markdown',
  bash: 'Bash',
  shell: 'Shell',
  sh: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  sql: 'SQL',
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  python: 'Python',
  py: 'Python',
}

export type MarkdownEditorProps = {
  value: string
  onChange?: (value: string) => void
  resetKey?: string
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
  minHeight?: number | string
  className?: string
}

function renderToolbar() {
  return (
    <ConditionalContents
      options={[
        {
          when: (editor) => editor?.editorType === 'codeblock',
          contents: () => (
            <>
              <UndoRedo />
              <Separator />
              <ChangeCodeMirrorLanguage />
            </>
          ),
        },
        {
          fallback: () => (
            <>
              <UndoRedo />
              <Separator />
              <BlockTypeSelect />
              <Separator />
              <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
              <CodeToggle />
              <Separator />
              <ListsToggle />
              <CreateLink />
              <Separator />
              <InsertTable />
              <InsertThematicBreak />
              <InsertCodeBlock />
            </>
          ),
        },
      ]}
    />
  )
}

function createPlugins(editable: boolean) {
  return [
    headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
    quotePlugin(),
    listsPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    tablePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: 'plaintext' }),
    codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
    ...(editable
      ? [
          toolbarPlugin({
            toolbarClassName: 'markdown-editor-toolbar',
            toolbarContents: renderToolbar,
          }),
        ]
      : []),
  ]
}

export function MarkdownEditor({
  value,
  onChange,
  resetKey,
  placeholder = '开始编写 Markdown 内容',
  readOnly = false,
  disabled = false,
  minHeight = 320,
  className,
}: MarkdownEditorProps) {
  const editable = !readOnly && !disabled

  const style = {
    '--markdown-editor-min-height':
      typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
  } as CSSProperties

  return (
    <div
      data-markdown-editor=""
      style={style}
      className={cn(
        'overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]',
        editable && 'focus-within:border-ring',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <MDXEditor
        key={resetKey}
        markdown={value}
        trim={false}
        readOnly={!editable}
        spellCheck={editable}
        placeholder={placeholder}
        onChange={(markdown) => onChange?.(markdown)}
        className="markdown-editor-root"
        contentEditableClassName="markdown-editor-content prose prose-sm max-w-none"
        plugins={createPlugins(editable)}
      />
    </div>
  )
}
