import { useCallback, useMemo, useState } from 'react'
import { Download, Loader2, FileAudio, Check, Info } from 'lucide-react'
import { Modal } from './ui'
import { splitSentences, formatSeconds, wordCount } from '../utils/text'
import { exportDocument, estimateSeconds } from '../utils/audioExport'
import type { Settings } from '../types'

type Phase = 'idle' | 'rendering' | 'ready' | 'error'

export function ExportModal({
  open,
  onClose,
  content,
  title,
  settings,
}: {
  open: boolean
  onClose: () => void
  content: string
  title: string
  settings: Settings
}) {
  const chunks = useMemo(() => splitSentences(content), [content])
  const estSecs = useMemo(() => estimateSeconds(chunks, settings.speed), [chunks, settings.speed])
  const words = useMemo(() => wordCount(content), [content])

  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ kind: 'mp3' | 'wav'; url: string } | null>(null)
  const [errMsg, setErrMsg] = useState<string>('')

  const hasContent = content.trim().length > 0

  const reset = useCallback(() => {
    setPhase('idle')
    setProgress(0)
    setErrMsg('')
    if (result) {
      URL.revokeObjectURL(result.url)
      setResult(null)
    }
  }, [result])

  const close = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const start = useCallback(async () => {
    if (!hasContent) return
    setPhase('rendering')
    setProgress(0)
    try {
      const res = await exportDocument({
        chunks,
        rate: settings.speed,
        pitch: settings.pitch,
        volume: settings.volume,
        onProgress: (f) => setProgress(f),
      })
      const url = URL.createObjectURL(res.blob)
      setResult({ kind: res.kind, url })
      setPhase('ready')
      setProgress(1)
    } catch (e) {
      setPhase('error')
      setErrMsg(e instanceof Error ? e.message : 'Export failed.')
    }
  }, [chunks, settings, hasContent])

  const filename = `${(title || 'vocalize').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'vocalize'}.${result?.kind ?? 'mp3'}`

  return (
    <Modal open={open} onClose={close} title="Export audio">
      <p className="mb-4 text-sm text-text-dim">
        Render a downloadable copy of this reading. Vocalize approximates the
        voice as a synthesized voiceover of your content — no server, no
        external TTS.{' '}
        <span className="text-text-faint">
          {hasContent ? `~${formatSeconds(estSecs)} · ${words.toLocaleString()} words` : 'Nothing to export yet.'}
        </span>
      </p>

      {!hasContent ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-inset px-3 py-3 text-sm text-text-dim">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" />
          Add some text in the editor first, then export it here.
        </div>
      ) : phase === 'rendering' ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-text-dim">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Rendering… {Math.round(progress * 100)}%
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-inset">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-150"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </div>
        </div>
      ) : phase === 'error' ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-text">
          {errMsg}
          <button
            type="button"
            onClick={start}
            className="ml-2 text-accent underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : phase === 'ready' && result ? (
        <div>
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-3 py-3">
            <FileAudio className="h-5 w-5 shrink-0 text-success" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-text">
                {filename}
              </div>
              <div className="text-xs text-text-dim">
                {result.kind.toUpperCase()} · {formatSeconds(estSecs)}
              </div>
            </div>
            <Check className="ml-auto h-4 w-4 shrink-0 text-success" />
          </div>
          <a
            href={result.url}
            download={filename}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
          >
            <Download className="h-4 w-4" />
            Download {result.kind.toUpperCase()}
          </a>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
        >
          <Loader2 className="h-4 w-4" />
          Render audio
        </button>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={close}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-text-dim transition hover:text-text"
        >
          {phase === 'rendering' ? 'Cancel' : 'Close'}
        </button>
      </div>
    </Modal>
  )
}
