import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { splitSentences, type Chunk } from '../utils/text'
import type { PlaybackState, Settings } from '../types'

export interface SpeechSynthesisApi {
  status: PlaybackState
  activeChunkIndex: number | null
  totalChunks: number
  /** 0..1 position estimate (by completed chunks). */
  progress: number
  voices: SpeechSynthesisVoice[]
  supported: boolean
  play: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  skipBack: () => void
  skipForward: () => void
  /** Restart playback from the chunk containing the given character offset. */
  restartFromChar: (charIndex: number) => void
  /** Current chunk bounds (for highlighting) or null. */
  activeChunk: Chunk | null
}

interface Args {
  content: string
  settings: Settings
  onChunkChange?: (index: number) => void
  onFinished?: () => void
}

export function useSpeechSynthesis({ content, settings, onChunkChange, onFinished }: Args): SpeechSynthesisApi {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const chunks: Chunk[] = useMemo(() => splitSentences(content), [content])

  const [status, setStatus] = useState<PlaybackState>('idle')
  const [activeChunkIndex, setActiveChunkIndex] = useState<number | null>(null)

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  // --- refs that must survive re-render without going stale -------------
  const chunkIdxRef = useRef(0)
  const statusRef = useRef<PlaybackState>('idle')
  const pausedRef = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const chunksRef = useRef(chunks)
  chunksRef.current = chunks
  const onChunkChangeRef = useRef(onChunkChange)
  onChunkChangeRef.current = onChunkChange
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  const setStatusBoth = useCallback((s: PlaybackState) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  // --- voices ------------------------------------------------------------
  useEffect(() => {
    if (!supported) return
    const load = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length) setVoices(v)
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  const resolveVoice = useCallback(
    (uri: string | null): SpeechSynthesisVoice | null => {
      if (!uri) return null
      return voices.find((v) => v.voiceURI === uri) ?? null
    },
    [voices]
  )

  // Cancel any pending speech.
  const cancel = useCallback(() => {
    if (!supported) return
    pausedRef.current = false
    window.speechSynthesis.cancel()
  }, [supported])

  const speakChunkAt = useCallback(
    (i: number, force: boolean) => {
      const cs = chunksRef.current
      if (!supported) return
      const s = settingsRef.current
      const idx = Math.max(0, Math.min(i, cs.length - 1))
      chunkIdxRef.current = idx
      setActiveChunkIndex(idx)
      onChunkChangeRef.current?.(idx)
      setStatusBoth('playing')

      const chunk = cs[idx]
      const u = new SpeechSynthesisUtterance(chunk.text)
      const v = resolveVoice(s.voiceURI)
      if (v) {
        u.voice = v
        if (v.lang) u.lang = v.lang
      }
      u.rate = s.speed
      u.pitch = s.pitch
      u.volume = s.volume

      u.onend = () => {
        // If the user paused natively, onend may fire in some engines; ignore.
        if (pausedRef.current) {
          pausedRef.current = false
          return
        }
        const next = chunkIdxRef.current + 1
        if (next < chunksRef.current.length) {
          speakChunkAt(next, false)
        } else {
          setStatusBoth('finished')
          setActiveChunkIndex(null)
          onFinishedRef.current?.()
        }
      }
      u.onerror = () => {
        // An error in one chunk should not kill the whole session.
        if (pausedRef.current) return
        const next = chunkIdxRef.current + 1
        if (next < chunksRef.current.length) speakChunkAt(next, false)
        else {
          setStatusBoth('finished')
          setActiveChunkIndex(null)
          onFinishedRef.current?.()
        }
      }

      if (force) cancel()
      window.speechSynthesis.speak(u)
    },
    [cancel, resolveVoice, setStatusBoth, supported]
  )

  // --- public controls ---------------------------------------------------
  const play = useCallback(() => {
    if (statusRef.current === 'playing') return
    if (statusRef.current === 'paused') {
      pausedRef.current = false
      setStatusBoth('playing')
      window.speechSynthesis.resume()
      return
    }
    // finished or idle: start from the beginning
    chunkIdxRef.current = 0
    speakChunkAt(0, true)
  }, [speakChunkAt, setStatusBoth])

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return
    pausedRef.current = true
    setStatusBoth('paused')
    window.speechSynthesis.pause()
  }, [setStatusBoth])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    pausedRef.current = false
    setStatusBoth('playing')
    window.speechSynthesis.resume()
  }, [setStatusBoth])

  const stop = useCallback(() => {
    cancel()
    chunkIdxRef.current = 0
    setActiveChunkIndex(null)
    setStatusBoth('idle')
  }, [cancel, setStatusBoth])

  const skipBack = useCallback(() => {
    if (chunksRef.current.length === 0) return
    const target = Math.max(0, chunkIdxRef.current - 1)
    if (statusRef.current === 'idle' || statusRef.current === 'finished') {
      chunkIdxRef.current = target
      speakChunkAt(target, true)
    } else {
      speakChunkAt(target, true) // resumes playing the earlier chunk
    }
  }, [speakChunkAt])

  const skipForward = useCallback(() => {
    if (chunksRef.current.length === 0) return
    const target = Math.min(chunksRef.current.length - 1, chunkIdxRef.current + 1)
    speakChunkAt(target, true)
  }, [speakChunkAt])

  const restartFromChar = useCallback(
    (charIndex: number) => {
      const cs = chunksRef.current
      if (cs.length === 0) return
      let idx = cs.findIndex((c) => charIndex < c.end)
      if (idx === -1) idx = cs.length - 1
      chunkIdxRef.current = Math.max(0, idx)
      speakChunkAt(chunkIdxRef.current, true)
    },
    [speakChunkAt]
  )

  // --- live settings changes while playing ------------------------------
  // Rate/pitch/voice are fixed per-utterance, so re-speak the current chunk.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (statusRef.current === 'playing') speakChunkAt(chunkIdxRef.current, true)
  }, [settings.speed, settings.pitch, settings.voiceURI, speakChunkAt])

  // --- content changes invalidate offsets ------------------------------
  const contentKey = useRef(content)
  useEffect(() => {
    if (contentKey.current === content) return
    contentKey.current = content
    cancel()
    chunkIdxRef.current = 0
    setActiveChunkIndex(null)
    setStatusBoth('idle')
  }, [content, cancel, setStatusBoth])

  // --- cleanup -----------------------------------------------------------
  useEffect(() => () => cancel(), [cancel])

  const progress =
    chunks.length === 0
      ? 0
      : Math.min(1, (activeChunkIndex === null ? 0 : activeChunkIndex) / chunks.length)

  const activeChunk =
    activeChunkIndex !== null && chunks[activeChunkIndex] ? chunks[activeChunkIndex] : null

  return {
    status,
    activeChunkIndex,
    totalChunks: chunks.length,
    progress,
    voices,
    supported,
    play,
    pause,
    resume,
    stop,
    skipBack,
    skipForward,
    restartFromChar,
    activeChunk,
  }
}
