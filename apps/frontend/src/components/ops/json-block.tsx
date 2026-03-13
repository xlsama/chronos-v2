export function JsonBlock(props: { value: unknown; className?: string }) {
  return (
    <pre className={`overflow-x-auto rounded-lg border bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-100 ${props.className ?? ''}`}>
      {JSON.stringify(props.value, null, 2)}
    </pre>
  )
}
