import fs from 'node:fs/promises'
import path from 'node:path'

export async function extractText(filePath: string, type: string): Promise<string> {
  switch (type) {
    case 'pdf':
      return extractPdf(filePath)
    case 'xlsx':
      return extractExcel(filePath)
    case 'csv':
      return extractCsv(filePath)
    case 'docx':
      return extractDocx(filePath)
    default:
      throw new Error(`Unsupported file type: ${type}`)
  }
}

async function extractPdf(filePath: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ url: filePath })
  const result = await parser.getText()
  await parser.destroy()
  return result.text
}

async function extractExcel(filePath: string): Promise<string> {
  const XLSX = await import('xlsx')
  const buffer = await fs.readFile(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    if (rows.length === 0) continue

    lines.push(`## Sheet: ${sheetName}`)
    const header = rows[0] as string[]
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as string[]
      if (i === 0) {
        lines.push(row.join(' | '))
      } else {
        const parts = row.map((cell, j) => `${header[j] ?? `col${j}`}: ${cell ?? ''}`)
        lines.push(parts.join(', '))
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

async function extractCsv(filePath: string): Promise<string> {
  const { parse } = await import('csv-parse/sync')
  const content = await fs.readFile(filePath, 'utf-8')
  const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[]

  if (records.length === 0) return ''
  const headers = Object.keys(records[0])
  const lines = [headers.join(' | ')]
  for (const record of records) {
    lines.push(headers.map((h) => `${h}: ${record[h] ?? ''}`).join(', '))
  }
  return lines.join('\n')
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth')
  const buffer = await fs.readFile(filePath)
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}
