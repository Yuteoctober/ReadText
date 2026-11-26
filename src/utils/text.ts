export interface Chunk {
  text: string
  start: number // char offset in source
  end: number // exclusive char offset in source
}

function isSpace(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === undefined
}

/**
 * Split text into speakable chunks (sentences / paragraphs) with accurate
 * character offsets. A chunk ends at a paragraph break, or at a run of
 * `.!?` that is followed by whitespace and not by a digit (so decimals like
 * "3.5" stay intact). Offlets drive the live highlight and the skip controls.
 */
export function splitSentences(content: string): Chunk[] {
  const chunks: Chunk[] = []
  const n = content.length
  let i = 0
  while (i < n) {
    let j = i
    let end = -1 // exclusive index where this chunk ends
    while (j < n) {
      const c = content[j]
      if (c === '\n' || c === '\r') {
        end = j + 1
        j = end
        break
      }
      if (c === '.' || c === '!' || c === '?') {
        const runChar = c
        let k = j + 1
        while (k < n && content[k] === runChar) k++ // absorb "..."
        const after = content[k]
        // A sentence break when followed by whitespace, OR when followed by
        // a letter that is not part of a decimal (e.g. "5. Next" handled
        // below); but NOT when the run is a decimal point mid-number.
        if (isSpace(after)) {
          end = j + 1
          j = k
          break
        }
        // Not a break (decimal like "3.5" or ellipsis mid-word): keep going.
      }
      j++
    }
    if (end === -1) end = n
    const text = content.slice(i, end)
    if (text.trim().length > 0) chunks.push({ text, start: i, end })
    i = end
  }
  return chunks
}

// Word counting that respects space-less scripts (Thai, CJK). Intl.Segmenter
// segments "word-like" units correctly for each locale; a naive \S+ count
// would report a whole Thai paragraph as a single word.
const THAI_RE = /[฀-๿]/
const CJK_RE = /[㐀-䶿一-鿿]/
type Segmenter = { segment(input: string): Array<{ isWordLike: boolean }> }
let segEn: Segmenter | null = null
let segTh: Segmenter | null = null
let segJp: Segmenter | null = null
try {
  const Seg = (Intl as any).Segmenter
  if (Seg) {
    segEn = new Seg('en', { granularity: 'word' })
    segTh = new Seg('th', { granularity: 'word' })
    segJp = new Seg('ja', { granularity: 'word' })
  }
} catch {
  segEn = segTh = segJp = null
}

export function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  const seg = THAI_RE.test(t)
    ? segTh
    : CJK_RE.test(t)
      ? segJp
      : segEn
  if (seg) {
    let n = 0
    for (const s of seg.segment(t)) if (s.isWordLike) n++
    return n
  }
  const m = t.match(/\S+/g)
  return m ? m.length : 0
}

export function charCount(text: string): number {
  return text.length
}

/** A short BCP-47 tag hint for the dominant script of the content. */
export function dominantScript(text: string): 'th' | 'latin' | 'mixed' | null {
  if (!text.trim()) return null
  const hasThai = THAI_RE.test(text)
  const hasLatin = /[A-Za-z]/.test(text)
  if (hasThai && hasLatin) return 'mixed'
  if (hasThai) return 'th'
  return 'latin'
}

/** Rough spoken seconds at a given rate (≈ 150 wpm at 1.0x). */
export function readingSeconds(text: string, rate: number): number {
  if (rate <= 0) return 0
  const words = wordCount(text)
  return Math.round((words / 150) * 60 / rate)
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `0:${r.toString().padStart(2, '0')}`
}
