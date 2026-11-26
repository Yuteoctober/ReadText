import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  Eraser,
  FileText,
  Upload,
  ClipboardPaste,
  BookOpen,
  Mic,
  MicOff,
  GripVertical,
} from 'lucide-react'
import { splitSentences, wordCount, charCount } from '../utils/text'
import { SAMPLES } from '../seed'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import {
  loadEditorHeight,
  saveEditorHeight,
  clampEditorHeight,
  EDITOR_HEIGHT_MIN,
  EDITOR_HEIGHT_MAX,
} from '../utils/storage'

interface Props {
  content: string
  onContentChange: (next: string) => void
  onPickSample: (title: string, content: string) => void
  activeChunkIndex: number | null
  autoScroll: boolean
  onOpenUpload: () => void
  onRestartFromChar: (charIndex: number) => void
}

export function EditorPane({
  content,
  onContentChange,
  onPickSample,
  activeChunkIndex,
  autoScroll,
  onOpenUpload,
  onRestartFromChar,
}: Props) {
  const chunks = useMemo(() => splitSentences(content), [content])
  const words = useMemo(() => wordCount(content), [content])
  const chars = useMemo(() => charCount(content), [content])

  const [samplesOpen, setSamplesOpen] = useState(false)
  const samplesRef = useRef<HTMLDivElement>(null)

  // Resizable editor box — height persists to LocalStorage.
  const [height, setHeight] = useState(() => loadEditorHeight())
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ y: 0, h: 0 })

  const sectionRef = useRef<HTMLElement>(null)

  const startDrag = useCallback(
    (e: PointerEvent) => {
      e.preventDefault()
      // Capture so the drag keeps tracking even when the finger moves off the handle.
      const handle = e.currentTarget
      try {
        handle.setPointerCapture(e.pointerId)
      } catch {
        /* pointer capture is best-effort */
      }
      dragStart.current = { y: e.clientY, h: height }
      setDragging(true)
      const move = (ev: globalThis.PointerEvent) => {
        const next = clampEditorHeight(dragStart.current.h + (ev.clientY - dragStart.current.y))
        setHeight(next)
      }
      const up = (ev: globalThis.PointerEvent) => {
        setDragging(false)
        saveEditorHeight(clampEditorHeight(dragStart.current.h + (ev.clientY - dragStart.current.y)))
        try {
          handle.releasePointerCapture(ev.pointerId)
        } catch {
          /* noop */
        }
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
      }
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
    },
    [height]
  )

  // Keyboard: arrow up/down resizes, Home/End reset to min/max.
  const handleResizeKey = useCallback(
    (e: KeyboardEvent) => {
      let next: number | null = null
      if (e.key === 'ArrowUp') next = clampEditorHeight(height - 16)
      else if (e.key === 'ArrowDown') next = clampEditorHeight(height + 16)
      else if (e.key === 'Home') next = EDITOR_HEIGHT_MIN
      else if (e.key === 'End') next = EDITOR_HEIGHT_MAX
      if (next !== null) {
        e.preventDefault()
        setHeight(next)
        saveEditorHeight(next)
      }
    },
    [height]
  )

  const taRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const activeSpanRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef(content)
  contentRef.current = content

  // Dictation: append each finalized phrase into the document.
  const dictation = useSpeechRecognition((phrase) => {
    const base = contentRef.current
    const sep = base.length === 0 ? '' : base.endsWith(' ') ? '' : ' '
    onContentChange(base + sep + phrase.trimEnd() + ' ')
  })

  useEffect(() => {
    if (!samplesOpen) return
    const onDoc = (e: MouseEvent) => {
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node))
        setSamplesOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setSamplesOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [samplesOpen])

  // Overlay mirrors the textarea's scroll so the highlight stays on the text.
  const handleTextareaScroll = useCallback(() => {
    if (taRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = taRef.current.scrollTop
      overlayRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }, [])

  // Glide to the newly-active sentence when auto-scroll is on.
  useEffect(() => {
    if (!autoScroll || activeChunkIndex === null) return
    const span = activeSpanRef.current
    const ta = taRef.current
    if (!span || !ta) return
    const top = span.offsetTop
    const bottom = top + span.offsetHeight
    if (top < ta.scrollTop + 48) ta.scrollTo({ top: top - 56, behavior: 'smooth' })
    else if (bottom > ta.scrollTop + ta.clientHeight - 48)
      ta.scrollTo({ top: bottom - ta.clientHeight + 56, behavior: 'smooth' })
  }, [activeChunkIndex, autoScroll])

  const handleInput = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => onContentChange(e.target.value),
    [onContentChange]
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      if (!text) return
      const el = e.target as HTMLTextAreaElement
      const s = el.selectionStart
      const en = el.selectionEnd
      onContentChange(content.slice(0, s) + text + content.slice(en))
      requestAnimationFrame(() => {
        el.focus()
        const pos = s + text.length
        el.setSelectionRange(pos, pos)
      })
    },
    [content, onContentChange]
  )

  const clearAll = useCallback(() => {
    onContentChange('')
    requestAnimationFrame(() => taRef.current?.focus())
  }, [onContentChange])

  const overlay = useMemo(() => {
    return (
      <div className="text-editor">
        {chunks.map((c, i) => (
          <span
            key={i}
            ref={i === activeChunkIndex ? activeSpanRef : undefined}
            className={i === activeChunkIndex ? 'editor-active-sentence' : 'editor-sentence'}
          >
            {c.text}
          </span>
        ))}
        {chunks.length === 0 && <span className="editor-sentence">{' '}</span>}
      </div>
    )
  }, [chunks, activeChunkIndex])

  return (
    <section
      ref={sectionRef}
      aria-label="Text editor"
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised"
    >
      {/* Toolbar — Row 1: Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-text-dim transition hover:text-text"
          >
            <Upload className="h-3.5 w-3.5" /> Upload
          </button>
          <button
            type="button"
            onClick={() => requestAnimationFrame(() => taRef.current?.focus())}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-text-dim transition hover:text-text"
          >
            <ClipboardPaste className="h-3.5 w-3.5" /> Paste
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={content.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-text-dim transition hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>

          <div ref={samplesRef} className="relative">
            <button
              type="button"
              onClick={() => setSamplesOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={samplesOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-text-dim transition hover:text-text"
            >
              <BookOpen className="h-3.5 w-3.5" /> Samples
            </button>
            {samplesOpen && (
              <div
                role="menu"
                className="animate-fade-in absolute z-30 mt-1.5 w-64 overflow-auto rounded-lg border border-line bg-surface-raised p-1 shadow-xl"
              >
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  Sample documents
                </div>
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPickSample(s.title, s.content)
                      setSamplesOpen(false)
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-surface-inset"
                  >
                    <span className="min-w-0 truncate">{s.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-text-faint">
                      {s.langCode}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
          disabled={!dictation.supported}
          aria-pressed={dictation.listening}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
            dictation.listening
              ? 'bg-warning text-surface animate-pulse-glow shadow-lg shadow-warning/20'
              : 'border border-line bg-surface text-text-dim hover:text-text'
          }`}
        >
          {dictation.listening ? (
            <>
              <MicOff className="h-3.5 w-3.5" /> Listening…
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" /> Dictate
            </>
          )}
        </button>
      </div>

      {/* Toolbar — Row 2: Status & Lang */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-inset/40 px-3 py-1.5 text-[10px] font-medium tracking-tight text-text-faint">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5" title="Word count">
            <FileText className="h-3 w-3" /> {words.toLocaleString()} words
          </span>
          <span className="inline-flex items-center gap-1.5" title="Character count">
            <FileText className="h-3 w-3" /> {chars.toLocaleString()} characters
          </span>
        </div>

        {dictation.supported && (
          <label className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider text-text-dim">
              Dictate language
            </span>
            <select
              aria-label="Dictation language"
              value={dictation.lang}
              onChange={(e) => dictation.setLang(e.target.value)}
              disabled={dictation.listening}
              className="cursor-pointer rounded border border-line-soft bg-surface px-1.5 py-0.5 text-[10px] text-text-dim outline-none transition hover:border-text-faint hover:text-text focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <option value="en-US">English</option>
              <option value="th-TH">ไทย (Thai)</option>
              <option value="ja-JP">日本語 (Japanese)</option>
              <option value="zh-CN">中文 (Mandarin)</option>
              <option value="hi-IN">हिन्दी (Hindi)</option>
              <option value="es-ES">Español</option>
              <option value="fr-FR">Français</option>
              <option value="de-DE">Deutsch</option>
            </select>
          </label>
        )}
      </div>

      {/* Editor: resizable box — transition off while dragging so it tracks the finger */}
      <div
        className={`relative overflow-hidden bg-surface-inset/20 ${dragging ? '' : 'transition-[height] duration-75'}`}
        style={{ height, touchAction: 'none' }}
      >
        <div
          ref={overlayRef}
          aria-hidden
          className="text-editor pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          {overlay}
        </div>
        <textarea
          ref={taRef}
          value={content}
          onChange={handleInput}
          onScroll={handleTextareaScroll}
          onPaste={handlePaste}
          onDoubleClick={(e) => {
            const idx = (e.target as HTMLTextAreaElement).selectionStart ?? 0
            onRestartFromChar(idx)
          }}
          className="editor-surface absolute inset-0 z-10 resize-none overflow-auto bg-transparent outline-none"
          aria-label="Text to read aloud"
          spellCheck={false}
        />
        {content.trim().length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm text-text-faint">
            Paste a document, upload a file, or start typing to begin.
          </div>
        )}

        {/* Drag handle — full-width strip on mobile, corner-grip on desktop */}
        <div
          role="separator"
          tabIndex={0}
          aria-label="Resize editor height"
          aria-valuenow={height}
          aria-valuemin={EDITOR_HEIGHT_MIN}
          aria-valuemax={EDITOR_HEIGHT_MAX}
          onPointerDown={startDrag}
          onKeyDown={handleResizeKey}
          className={`absolute bottom-0 left-0 right-0 z-30 flex cursor-ns-resize touch-none items-center justify-center transition ${
            dragging
              ? 'bg-accent-soft text-accent'
              : 'text-text-faint hover:bg-surface-inset hover:text-text-dim'
          }`}
          style={{
            height: 'max(1.5rem, 32px)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div className="mx-auto flex h-full w-full items-center justify-center gap-1.5">
            <span className="text-[9px] font-medium tracking-wider uppercase">
              {dragging ? 'Resizing' : 'Resize'}
            </span>
            <GripVertical className="h-3 w-3 rotate-90" />
            <span className="font-mono text-[9px] tabular-nums text-text-dim">
              {Math.round(height / 8)} rows
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
