import { useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  AudioLines,
  Repeat,
} from 'lucide-react'
import type { Settings } from '../types'
import { SPEED_MIN, SPEED_MAX, PITCH_MIN, PITCH_MAX } from '../types'
import type { SpeechSynthesisApi } from '../hooks/useSpeechSynthesis'
import { formatSeconds, readingSeconds, dominantScript } from '../utils/text'
import { Slider } from './ui'

interface Props {
  api: SpeechSynthesisApi
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
  content: string
  /** Preview a voice with a sample line. */
}

export function PlayerPanel({
  api,
  settings,
  onSettingsChange,
  content,
}: Props) {
  const {
    status,
    voices,
    supported,
    play,
    pause,
    resume,
    stop,
    skipBack,
    skipForward,
  } = api

  const selectedVoice = voices.find((v) => v.voiceURI === settings.voiceURI) ?? null
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const previewRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceBoxRef = useRef<HTMLDivElement>(null)

  // Close the voice dropdown on outside click / Escape.
  useEffect(() => {
    if (!voiceOpen) return
    const onDoc = (e: MouseEvent) => {
      if (voiceBoxRef.current && !voiceBoxRef.current.contains(e.target as Node))
        setVoiceOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVoiceOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [voiceOpen])

  const grouped = groupVoices(voices)

  const previewVoice = (uri: string) => {
    if (!supported || previewing) return
    const v = uri ? voices.find((x) => x.voiceURI === uri) : null
    stop()
    setPreviewing(true)
    const u = new SpeechSynthesisUtterance(
      'This is how the selected voice sounds. Pick it if the pace and tone feel right.'
    )
    if (v) u.voice = v
    u.rate = settings.speed
    u.pitch = settings.pitch
    u.onend = () => setPreviewing(false)
    u.onerror = () => setPreviewing(false)
    previewRef.current = u
    window.speechSynthesis.speak(u)
  }

  const hasContent = content.trim().length > 0
  const est = readingSeconds(content, settings.speed)
  const script = dominantScript(content)
  const hasLangVoice = (s: typeof script) =>
    s === 'th'
      ? voices.some((v) => v.lang.startsWith('th'))
      : s === 'latin'
        ? voices.some((v) => v.lang.startsWith('en'))
        : true

  const showLangWarning = hasContent && script === 'th' && !hasLangVoice('th')

  const stopAll = () => {
    if (previewRef.current) {
      previewRef.current = null
      if (supported) window.speechSynthesis.cancel()
    }
    stop()
  }

  const primaryLabel =
    status === 'playing' ? 'Pause' : status === 'paused' ? 'Resume' : 'Play'

  const primary = () => {
    if (!hasContent) return
    if (status === 'playing') pause()
    else if (status === 'paused') resume()
    else play()
  }

  return (
    <section
      aria-label="Player and settings"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-4"
    >
      {/* Progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-text-dim">
            {status === 'playing' || status === 'paused'
              ? `Part ${Math.min((api.activeChunkIndex ?? 0) + 1, api.totalChunks)} of ${api.totalChunks}`
              : status === 'finished'
                ? 'Finished'
                : 'Ready'}
          </span>
          <span className="tabular-nums text-text-faint">
            ~{formatSeconds(est)} left
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-inset"
          role="progressbar"
          aria-valuenow={Math.round(api.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.max(3, api.progress * 100)}%` }}
          />
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-2">
        <TransportBtn
          label="Skip back"
          onClick={skipBack}
          disabled={!hasContent}
        >
          <SkipBack className="h-4 w-4" />
        </TransportBtn>

        <button
          type="button"
          onClick={primary}
          disabled={!hasContent}
          aria-label={primaryLabel}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg shadow-accent/20 transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'playing' ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="ml-0.5 h-6 w-6" />
          )}
        </button>

        <TransportBtn label="Stop" onClick={stopAll}>
          <Square className="h-4 w-4" />
        </TransportBtn>

        <TransportBtn
          label="Skip forward"
          onClick={skipForward}
          disabled={!hasContent}
        >
          <SkipForward className="h-4 w-4" />
        </TransportBtn>
      </div>

      {/* Voice picker */}
      <div ref={voiceBoxRef} className="relative">
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="voice-select"
            className="text-xs font-medium text-text-dim"
          >
            Voice
          </label>
          {!supported && (
            <span className="text-[11px] text-danger">
              Speech unavailable in this browser
            </span>
          )}
        </div>
        <button
          id="voice-select"
          type="button"
          onClick={() => setVoiceOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={voiceOpen}
          className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm text-text transition hover:border-accent/40"
        >
          <span className="truncate">
            {selectedVoice ? selectedVoice.name : 'System default voice'}
          </span>
          <AudioLines className="h-4 w-4 shrink-0 text-text-dim" />
        </button>
        {voiceOpen && (
          <div
            role="listbox"
            className="animate-fade-in absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-lg border border-line bg-surface-raised p-1 shadow-xl"
          >
            <VoiceOption
              label="System default"
              selected={!selectedVoice}
              onClick={() => {
                onSettingsChange({ voiceURI: null })
                setVoiceOpen(false)
              }}
              onPreview={() => previewVoice('')}
              previewing={previewing}
            />
            {grouped.map(([region, vs]) => (
              <div key={region} className="mb-1">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  {region}
                </div>
                {vs.map((v) => (
                  <VoiceOption
                    key={v.voiceURI}
                    label={v.name}
                    selected={settings.voiceURI === v.voiceURI}
                    onClick={() => {
                      onSettingsChange({ voiceURI: v.voiceURI })
                      setVoiceOpen(false)
                    }}
                    onPreview={() => previewVoice(v.voiceURI)}
                    previewing={previewing}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        {showLangWarning && (
          <p className="mt-1.5 px-0.5 text-[10px] leading-tight text-warning">
            This content is Thai, but no Thai voice is installed in your system.
            Please add a Thai language pack in your OS settings.
          </p>
        )}
      </div>

      {/* Settings sliders */}
      <div className="flex flex-col gap-3.5 rounded-xl border border-line-soft bg-surface p-3.5">
        <Slider
          id="speed"
          label="Speed"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={0.1}
          value={settings.speed}
          onChange={(v) => onSettingsChange({ speed: Math.round(v * 10) / 10 })}
          format={(v) => `${v.toFixed(1)}×`}
        />
        <Slider
          id="pitch"
          label="Pitch"
          min={PITCH_MIN}
          max={PITCH_MAX}
          step={0.1}
          value={settings.pitch}
          onChange={(v) => onSettingsChange({ pitch: Math.round(v * 10) / 10 })}
          format={(v) => v.toFixed(1)}
        />
        <Slider
          id="volume"
          label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(v) => onSettingsChange({ volume: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-line-soft pt-3 text-xs">
          <span className="flex items-center gap-2 text-text-dim">
            <Repeat className="h-3.5 w-3.5" /> Auto-scroll text
          </span>
          <span
            role="switch"
            tabIndex={0}
            aria-checked={settings.autoScroll}
            aria-label="Auto-scroll text"
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                onSettingsChange({ autoScroll: !settings.autoScroll })
              }
            }}
            onClick={() => onSettingsChange({ autoScroll: !settings.autoScroll })}
            className={`relative h-5 w-9 rounded-full transition ${
              settings.autoScroll ? 'bg-accent' : 'bg-surface-inset'
            }`}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
              style={{ left: settings.autoScroll ? 18 : 2 }}
            />
          </span>
        </label>
      </div>
    </section>
  )
}

function TransportBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-text-dim transition hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function VoiceOption({
  label,
  selected,
  onClick,
  onPreview,
  previewing,
}: {
  label: string
  selected: boolean
  onClick: () => void
  onPreview: () => void
  previewing: boolean
}) {
  return (
    <div
      className={`group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
        selected ? 'bg-accent-soft text-accent' : 'text-text hover:bg-surface-inset'
      }`}
      role="option"
      aria-selected={selected}
    >
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 flex-1 truncate text-left"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onPreview}
        disabled={previewing}
        aria-label={selected ? 'Preview this voice' : 'Preview voice'}
        className="shrink-0 rounded p-1 text-text-faint opacity-0 transition hover:text-text focus:opacity-100 group-hover:opacity-100 disabled:opacity-40"
      >
        {previewing ? (
          <VolumeX className="h-3.5 w-3.5" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

function groupVoices(
  voices: SpeechSynthesisVoice[]
): Array<[string, SpeechSynthesisVoice[]]> {
  const map = new Map<string, SpeechSynthesisVoice[]>()
  for (const v of voices) {
    const tag = (v.lang || 'other').toUpperCase()
    const arr = map.get(tag) ?? []
    arr.push(v)
    map.set(tag, arr)
  }
  // Default languages first, alphabetical otherwise
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a.startsWith('EN') && !b.startsWith('EN')) return -1
    if (b.startsWith('EN') && !a.startsWith('EN')) return 1
    return a.localeCompare(b)
  })
  return keys.map((k) => [k, map.get(k)!])
}
