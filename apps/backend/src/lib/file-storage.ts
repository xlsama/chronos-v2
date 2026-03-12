import { createHash } from 'node:crypto'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env'

const dataRoot = path.resolve(env.DATA_DIR)
const skillsRoot = path.resolve(env.SKILLS_DIR)

type ProjectDocumentKind = 'knowledge' | 'runbook' | 'incident_history'

const kindDirectoryMap: Record<ProjectDocumentKind, string> = {
  knowledge: 'knowledge',
  runbook: 'runbooks',
  incident_history: 'incident-history',
}

export function slugifySegment(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return ascii || 'item'
}

export function toPublicFileUrl(relativePath: string) {
  return `/files/${relativePath.replace(/\\/g, '/')}`
}

export function resolveStoredPath(relativePath: string) {
  return path.resolve(dataRoot, relativePath)
}

export async function ensureDataRoots() {
  await Promise.all([
    fs.mkdir(dataRoot, { recursive: true }),
    fs.mkdir(skillsRoot, { recursive: true }),
  ])
}

export function ensureDataRootsSync() {
  fsSync.mkdirSync(dataRoot, { recursive: true })
  fsSync.mkdirSync(skillsRoot, { recursive: true })
}

export async function readStoredText(relativePath: string) {
  return fs.readFile(resolveStoredPath(relativePath), 'utf-8')
}

export async function readStoredBuffer(relativePath: string) {
  return fs.readFile(resolveStoredPath(relativePath))
}

export async function deleteStoredFile(relativePath: string) {
  await fs.rm(resolveStoredPath(relativePath), { force: true })
}

function buildProjectDirectory(projectSlug: string, kind: ProjectDocumentKind) {
  return path.join('projects', projectSlug, kindDirectoryMap[kind])
}

export async function writeUploadedProjectFile(input: {
  projectSlug: string
  kind: ProjectDocumentKind
  title: string
  originalName: string
  buffer: Buffer
}) {
  const extension = path.extname(input.originalName).toLowerCase()
  const titleSlug = slugifySegment(input.title)
  const fileName = `${titleSlug}-${crypto.randomUUID()}${extension}`
  const relativeDir = buildProjectDirectory(input.projectSlug, input.kind)
  const relativePath = path.join(relativeDir, fileName)
  const absolutePath = resolveStoredPath(relativePath)

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, input.buffer)

  return {
    fileName,
    relativePath,
    extension: extension.replace('.', ''),
    checksum: createHash('sha256').update(input.buffer).digest('hex'),
  }
}

export async function writeMarkdownProjectFile(input: {
  projectSlug: string
  kind: ProjectDocumentKind
  title: string
  content: string
}) {
  const titleSlug = slugifySegment(input.title)
  const fileName = `${titleSlug}.md`
  const relativeDir = buildProjectDirectory(input.projectSlug, input.kind)
  const relativePath = path.join(relativeDir, fileName)
  const absolutePath = resolveStoredPath(relativePath)
  const buffer = Buffer.from(input.content, 'utf-8')

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)

  return {
    fileName,
    relativePath,
    extension: 'md',
    checksum: createHash('sha256').update(buffer).digest('hex'),
  }
}

export function getSkillsRoot() {
  return skillsRoot
}
