import type { ProjectDocument, ProjectDocumentIndexingReason } from '@chronos/shared'

const indexingReasonLabels: Record<ProjectDocumentIndexingReason, string> = {
  empty_content: '文档内容为空',
  empty_chunks: '没有可切分的内容',
  image_without_ocr: '图片暂未做 OCR',
  index_write_skipped: '向量索引未写入',
}

export function getDocumentIndexingLabel(document: ProjectDocument) {
  return document.indexingStatus === 'indexed' ? '已索引' : '未索引'
}

export function getDocumentIndexingReasonLabel(reason: ProjectDocument['indexingReason']) {
  return reason ? indexingReasonLabels[reason] : '等待索引结果'
}

export function getDocumentIndexingSummary(document: ProjectDocument) {
  if (document.indexingStatus === 'indexed') {
    return `${document.vectorCount} chunks`
  }

  return getDocumentIndexingReasonLabel(document.indexingReason)
}

export function shouldShowDocumentIndexing(document: ProjectDocument) {
  return document.status === 'ready'
}
