import { Streamdown } from 'streamdown'

export function MarkdownStream({
  children,
  isStreaming,
}: {
  children: string
  isStreaming?: boolean
}) {
  return (
    <Streamdown
      mode={isStreaming ? 'streaming' : 'static'}
      className="prose prose-sm dark:prose-invert break-words"
    >
      {children}
    </Streamdown>
  )
}
