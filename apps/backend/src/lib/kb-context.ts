import type { SearchResult } from '../services/knowledge-base.service'

export function formatKbContext(results: SearchResult[]): string {
  const header = '以下是用户引用的知识库中与当前问题相关的内容，请参考这些信息来分析和解决问题：\n'

  const items = results.map((r, i) => {
    const score =
      r.rerankScore !== undefined
        ? `相关度: ${(r.rerankScore * 100).toFixed(1)}%`
        : `相似度: ${(r.similarity * 100).toFixed(1)}%`
    return `[${i + 1}] (项目: ${r.projectName} | 文档: ${r.documentTitle} | ${score})\n${r.chunkContent}`
  })

  return header + '\n' + items.join('\n\n---\n\n')
}
