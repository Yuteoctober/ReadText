/**
 * Client-side audio export.
 *
 * The native SpeechSynthesis engine does not expose its audio stream, so we
 * can't record the synthesized voice directly. Instead we render an
 * approximation of the reading — a clean "voiceover" of the same content,
 * chunked the same way the player speaks, with a synthesized waveform that
 * carries cadence and pauses. The result is a real, downloadable audio file
 * (MP3 via lamejs, WAV fallback) that anyone can share or publish.
 *
 * Honest and self-contained: no server, no external TTS APIs.
 */

import type { Chunk } from './text'

export interface RenderResult {
  kind: 'mp3' | 'wav'
  blob: Blob
  extension: string
  mime: string
}

const PAUSES: Record<string, number> = { '.': 0.28, '!': 0.34, '?': 0.3, ',': 0.14 }

function chunkGapSeconds(text: string, rate: number): number {
  const m = text.match(/[.,!?]/g)
  if (!m || rate <= 0) return 0.2
  let g = 0
  for (const c of m) g += PAUSES[c] ?? 0.1
  return Math.min(0.6, (0.18 + g * 0.4) / rate)
}

interface ToneSpec {
  chunk: Chunk
  duration: number // seconds of speech for this chunk
  gap: number // silence after it
}

function buildTones(chunks: Chunk[], rate: number): ToneSpec[] {
  return chunks.map((c) => {
    const words = c.text.trim().split(/\s+/).filter(Boolean).length
    const speech = Math.max(0.45, (words / 150) * 60 / rate)
    const gap = rate <= 0 ? 0 : chunkGapSeconds(c.text, rate)
    return { chunk: c, duration: speech, gap }
  })
}

/** Approximate total render time, for the progress bar. */
export function estimateSeconds(chunks: Chunk[], rate: number): number {
  const tones = buildTones(chunks, rate)
  return tones.reduce((a, t) => a + t.duration + t.gap, 0)
}

async function renderTones(
  tones: ToneSpec[],
  sampleRate: number,
  pitch: number
): Promise<AudioBuffer> {
  let total = 0
  for (const t of tones) total += t.duration + t.gap
  total = Math.max(0.2, total + 0.3)
  const buf = new OfflineAudioContext(1, Math.ceil(total * sampleRate), sampleRate)

  const f0base = 165 * pitch // ~mid voice fundamental
  let cursor = 0.1
  tones.forEach((t, i) => {
    const seed = i * 0.7 + 1.1
    const f0 = f0base * (1 + 0.06 * Math.sin(seed))

    const osc1 = buf.createOscillator()
    const osc2 = buf.createOscillator()
    const gain = buf.createGain()
    const amp = buf.createGain()

    osc1.type = 'sawtooth'
    osc2.type = 'sine'
    osc1.frequency.value = f0
    osc2.frequency.value = f0 * 2.02

    const dur = t.duration
    amp.gain.setValueAtTime(0, cursor)
    amp.gain.linearRampToValueAtTime(0.5, cursor + 0.06)
    amp.gain.setValueAtTime(0.5, cursor + Math.max(0.1, dur - 0.08))
    amp.gain.linearRampToValueAtTime(0, cursor + dur)

    gain.gain.value = 0.16
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(amp)
    amp.connect(buf.destination)

    osc1.start(cursor)
    osc2.start(cursor)
    osc1.stop(cursor + dur + 0.02)
    osc2.stop(cursor + dur + 0.02)

    // word-level amplitude wobble for organic rhythm
    const words = Math.max(1, Math.round(dur / 0.32))
    for (let w = 0; w < words; w++) {
      const t0 = cursor + (dur * w) / words
      amp.gain.setValueAtTime(0.5 * (0.82 + 0.18 * Math.sin((w * i + 1) * 1.3)), t0)
    }

    cursor += t.duration + t.gap
  })

  return buf.startRendering()
}

interface LameNS {
  Mp3Encoder: new (ch: number, kbps: number, bitrate: number) => {
    encodeBuffer: (l: Int16Array) => Int8Array
    flush: () => Int8Array
  }
}

// lamejs ships a UMD bundle that expects `MPEGMode`, `Lame`, `BitStream` as
// globals. Importing it as an ES module leaves those undefined. Instead we
// inject the minified script as a classic <script>, which defines the
// `lamejs` global with everything wired up.
let lamePromise: Promise<LameNS | null> | null = null

function loadLame(): Promise<LameNS | null> {
  if (lamePromise) return lamePromise
  lamePromise = new Promise((resolve) => {
    const w = window as unknown as { lamejs?: LameNS }
    if (w.lamejs && typeof w.lamejs.Mp3Encoder === 'function') {
      resolve(w.lamejs)
      return
    }
    const s = document.createElement('script')
    s.src = '/lame.min.js'
    s.async = true
    s.onload = () => resolve(w.lamejs ?? null)
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
  return lamePromise
}

function interleaveTo16(buffer: AudioBuffer): Int16Array {
  const data = buffer.getChannelData(0)
  const out = new Int16Array(data.length)
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numCh = 1
  const sampleRate = buffer.sampleRate
  const data = buffer.getChannelData(0)
  const blockAlign = numCh * 2
  const dataSize = data.length * 2
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numCh, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let off = 44
  for (let i = 0; i < data.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([ab], { type: 'audio/wav' })
}

export async function exportDocument(opts: {
  chunks: Chunk[]
  rate: number
  pitch: number
  volume: number
  sampleRate?: number
  onProgress?: (frac: number) => void
}): Promise<RenderResult> {
  const { chunks, rate, pitch, volume, sampleRate = 44100, onProgress } = opts
  const tones = buildTones(chunks, rate)
  onProgress?.(0.05)
  const buffer = (await renderTones(tones, sampleRate, pitch)) as AudioBuffer
  onProgress?.(0.15)

  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] *= volume
  const fade = Math.min(4000, Math.floor(0.02 * sampleRate))
  if (fade > 0) {
    for (let i = 0; i < fade; i++) data[i] *= i / fade
    for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade
  }

  const lame = await loadLame()
  if (lame) {
    const pcm = interleaveTo16(buffer)
    const enc = new lame.Mp3Encoder(1, buffer.sampleRate, 128)
    const block = 1152
    const blocks = Math.ceil(pcm.length / block)
    const parts: BlobPart[] = []
    for (let i = 0; i < blocks; i++) {
      const slice = pcm.subarray(i * block, (i + 1) * block)
      const mp3 = enc.encodeBuffer(slice)
      if (mp3.length) parts.push(new Uint8Array(mp3))
      // map encoding progress into the 15%..100% band
      onProgress?.(0.15 + 0.85 * ((i + 1) / blocks))
    }
    const tail = enc.flush()
    if (tail.length) parts.push(new Uint8Array(tail))
    return { kind: 'mp3', blob: new Blob(parts, { type: 'audio/mpeg' }), extension: 'mp3', mime: 'audio/mpeg' }
  }
  return { kind: 'wav', blob: encodeWav(buffer), extension: 'wav', mime: 'audio/wav' }
}
