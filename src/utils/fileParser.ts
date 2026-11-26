export interface ParsedFile {
  title: string
  content: string
  source: string // original file name
}

export interface ParseError {
  code: 'unsupported' | 'empty' | 'failed'
  message: string
}

const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'csv', 'log', 'json', 'yaml', 'yml',
  'xml', 'html', 'htm', 'rtf', 'epub', 'tsv',
])

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}

/** Strip simple HTML tags so a pasted web page reads as text. */
function htmlToText(html: string): string {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const text = noScript
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n')
    .replace(/<(br|hr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function readPdf(file: File): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist')
  const workerLib: any = await import('pdfjs-dist/build/pdf.worker.min.mjs')
  const pdfjsLib = pdfjs.default ?? pdfjs
  pdfjsLib.GlobalWorkerOptions.workerSrc = (workerLib.__esModule ? workerLib.default : workerLib) || ''
  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buf }).promise
  const parts: string[] = []
  const pages = Math.min(doc.numPages, 500)
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const pageText = (content.items as any[])
      .map((it) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
    parts.push(pageText)
  }
  return parts.join('\n\n')
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = extOf(file.name)
  const title = file.name.replace(/\.[^.]+$/, '')

  if (ext === 'pdf') {
    try {
      const text = await readPdf(file)
      const cleaned = text.replace(/\s+/g, ' ').trim()
      if (!cleaned) throw new Error('no text')
      return { title, content: cleaned, source: file.name }
    } catch {
      const err: ParseError = {
        code: 'failed',
        message: 'This PDF has no extractable text (it may be scanned). Try a text-based PDF.',
      }
      throw err
    }
  }

  if (TEXT_EXT.has(ext) || ext === '') {
    const raw = await file.text()
    let content = raw
    if (ext === 'html' || ext === 'htm') content = htmlToText(raw)
    if (ext === 'epub') {
      // .epub is a zip of XHTML; we can't unzip without a lib. Ask the user.
      const err: ParseError = {
        code: 'unsupported',
        message: 'EPUB import needs the HTML files inside. Export or copy the text from the book first.',
      }
      throw err
    }
    const cleaned = content.replace(/\r\n?/g, '\n').trim()
    if (!cleaned) {
      const err: ParseError = { code: 'empty', message: 'That file had no readable text.' }
      throw err
    }
    return { title, content: cleaned, source: file.name }
  }

  const err: ParseError = {
    code: 'unsupported',
    message: `Can't read ".${ext || 'unknown'}" files yet. Upload .txt, .md, .html or .pdf.`,
  }
  throw err
}

export function isParseError(e: unknown): e is ParseError {
  return typeof e === 'object' && e !== null && 'code' in e
}
