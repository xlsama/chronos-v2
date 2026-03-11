import { MDocument } from '@mastra/rag'

export interface Chunk {
  content: string
  index: number
}

export async function chunkText(text: string): Promise<Chunk[]> {
  const doc = MDocument.fromText(text)
  const chunks = await doc.chunk({ strategy: 'recursive', maxSize: 1000, overlap: 100 })
  return chunks.map((c, i) => ({ content: c.text, index: i }))
}

export async function chunkMarkdown(text: string): Promise<Chunk[]> {
  const doc = MDocument.fromMarkdown(text)
  const chunks = await doc.chunk({ strategy: 'markdown', maxSize: 1000, overlap: 100 })
  return chunks.map((c, i) => ({ content: c.text, index: i }))
}

export function chunkTabularText(text: string): Chunk[] {
  const CHUNK_SIZE = 1000
  const lines = text.split('\n')
  const chunks: Chunk[] = []
  let current = ''
  let header = ''
  let index = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('## Sheet:') || (!header && trimmed.includes(' | '))) {
      if (current.trim()) {
        chunks.push({ content: current.trim(), index: index++ })
      }
      header = trimmed.startsWith('## Sheet:') ? '' : trimmed
      current = trimmed
      continue
    }

    if (current.length + trimmed.length + 1 > CHUNK_SIZE && current.length > 0) {
      chunks.push({ content: current.trim(), index: index++ })
      current = header ? header + '\n' + trimmed : trimmed
    } else {
      current = current ? current + '\n' + trimmed : trimmed
    }
  }

  if (current.trim()) {
    chunks.push({ content: current.trim(), index: index++ })
  }

  return chunks
}
