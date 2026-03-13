import CodeMirror, { type ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
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

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.meta, color: '#404740' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.heading, textDecoration: 'none', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.keyword, color: '#708' },
  { tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName], color: '#219' },
  { tag: [tags.literal, tags.inserted], color: '#164' },
  { tag: [tags.string, tags.deleted], color: '#a11' },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], color: '#e40' },
  { tag: tags.definition(tags.variableName), color: '#00f' },
  { tag: tags.local(tags.variableName), color: '#30a' },
  { tag: [tags.typeName, tags.namespace], color: '#085' },
  { tag: tags.className, color: '#167' },
  { tag: [tags.special(tags.variableName), tags.macroName], color: '#256' },
  { tag: tags.definition(tags.propertyName), color: '#00c' },
  { tag: tags.comment, color: '#940' },
  { tag: tags.invalid, color: '#f00' },
])

const extensions = [
  yamlFrontmatter({
    content: markdown({ base: markdownLanguage, codeLanguages: languages }),
  }),
  syntaxHighlighting(markdownHighlightStyle),
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
    syntaxHighlighting: false,
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
