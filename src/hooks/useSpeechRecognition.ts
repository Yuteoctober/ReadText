import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal ambient types for the (vendor-prefixed) Web Speech recognition API.
interface SRR {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SRResult) => void) | null
  onerror: ((e: SRError) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
interface SRResult {
  readonly resultIndex: number
  readonly results: ArrayLike<SRResultEntry>
}
interface SRResultEntry {
  readonly 0: { readonly transcript: string }
  readonly isFinal: boolean
}
interface SRError {
  readonly error: string
}
type SRConstructor = new () => SRR

function getSR(): SRConstructor | null {
  if (typeof window === 'undefined') return null
  return (
    (window as unknown as {
      SpeechRecognition?: SRConstructor
      webkitSpeechRecognition?: SRConstructor
    }).SpeechRecognition ??
    (window as unknown as {
      webkitSpeechRecognition?: SRConstructor
    }).webkitSpeechRecognition ??
    null
  )
}

export interface SpeechRecognitionApi {
  supported: boolean
  listening: boolean
  error: string | null
  lang: string
  setLang: (l: string) => void
  start: () => void
  stop: () => void
}

/**
 * Web Speech dictation. `onTranscript` is called with the newly-finalized
 * text (a single final result's transcript) so the caller can append it.
 */
export function useSpeechRecognition(
  onTranscript: (text: string) => void
): SpeechRecognitionApi {
  const supported = getSR() !== null
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLangState] = useState('en-US')

  const recRef = useRef<SRR | null>(null)
  const listeningRef = useRef(false)
  const langRef = useRef(lang)
  langRef.current = lang
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const stop = useCallback(() => {
    listeningRef.current = false
    try {
      recRef.current?.stop()
    } catch {
      /* already stopped */
    }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (listeningRef.current) return
    const SR = getSR()
    if (!SR) {
      setError('Dictation isn\'t supported in this browser.')
      return
    }
    setError(null)
    const rec = new SR()
    recRef.current = rec
    rec.lang = langRef.current
    rec.continuous = true
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onstart = () => {
      listeningRef.current = true
      setListening(true)
    }
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      if (last && last[0]) {
        const text = last[0].transcript
        if (text.trim()) onTranscriptRef.current(text)
      }
    }
    rec.onerror = (e) => {
      // 'not-allowed' / 'service-not-allowed' are permission errors — surface once.
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access was blocked. Allow it and try again.')
        listeningRef.current = false
        setListening(false)
      }
    }
    rec.onend = () => {
      // Auto-restart while the user still wants to record (continuous speech
      // can end on a silence timeout or a final result).
      if (listeningRef.current) {
        try {
          rec.start()
        } catch {
          listeningRef.current = false
          setListening(false)
        }
      } else {
        setListening(false)
      }
    }

    try {
      rec.start()
    } catch {
      // start() throws if called twice in quick succession.
    }
    listeningRef.current = true
  }, [])

  useEffect(() => {
    return () => {
      listeningRef.current = false
      try {
        recRef.current?.abort()
      } catch {
        /* noop */
      }
    }
  }, [])

  const setLang = useCallback((l: string) => {
    setLangState(l)
    langRef.current = l
  }, [])

  return { supported, listening, error, lang, setLang, start, stop }
}
