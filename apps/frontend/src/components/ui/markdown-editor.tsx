import CodeMirror, { type ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { cn } from '@/lib/utils'

const baseTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    fontSize: '14px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    lineHeight: '1.6',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--muted-foreground)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--accent)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--foreground)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--accent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--ring) !important',
    opacity: '0.3',
  },
  '.cm-line': {
    padding: '0 8px',
  },
})

const fullHeightTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-editor': {
    height: '100%',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-content': {
    minHeight: '100%',
    paddingBottom: '72px',
  },
})

const extensions = [
  yamlFrontmatter({
    content: markdown({ base: markdownLanguage, codeLanguages: languages }),
  }),
  EditorView.lineWrapping,
  baseTheme,
]

export type MarkdownEditorProps = {
  value: string
  onChange?: (value: string) => void
  resetKey?: string
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
  minHeight?: number | string
  fullHeight?: boolean
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  resetKey,
  placeholder = '开始编写 Markdown 内容',
  readOnly = false,
  disabled = false,
  minHeight = 320,
  fullHeight = false,
  className,
}: MarkdownEditorProps) {
  const editable = !readOnly && !disabled
  const minH = typeof minHeight === 'number' ? `${minHeight}px` : minHeight
  const editorExtensions = fullHeight ? [...extensions, fullHeightTheme] : extensions

  const basicSetup: ReactCodeMirrorProps['basicSetup'] = {
    lineNumbers: false,
    foldGutter: false,
    highlightActiveLine: editable,
    highlightSelectionMatches: true,
    bracketMatching: true,
    closeBrackets: true,
    autocompletion: false,
    searchKeymap: true,
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow]',
        fullHeight && 'flex min-h-0 flex-1 flex-col',
        editable && 'focus-within:border-ring',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <CodeMirror
        key={resetKey}
        value={value}
        onChange={onChange}
        extensions={editorExtensions}
        placeholder={placeholder}
        editable={editable}
        readOnly={!editable}
        basicSetup={basicSetup}
        className={cn(fullHeight && 'h-full')}
        height={fullHeight ? '100%' : undefined}
        style={fullHeight ? undefined : { minHeight: minH }}
        theme="none"
      />
    </div>
  )
}
