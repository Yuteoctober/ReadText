import { useCallback, useEffect, useRef, useState } from 'react'
import { SEED } from './seed'
import type { Settings } from './types'
import {
  loadDoc,
  saveDoc,
  loadSettings,
  saveSettings,
  loadTheme,
  saveTheme,
  type ThemeName,
} from './utils/storage'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { dominantScript } from './utils/text'
import { Header } from './components/Header'
import { EditorPane } from './components/EditorPane'
import { PlayerPanel } from './components/PlayerPanel'
import { FileUploadModal, type UploadResult } from './components/FileUploadModal'
import { ExportModal } from './components/ExportModal'

export default function App() {
  const [theme, setTheme] = useState<ThemeName>(() => loadTheme())

  // Initial document + settings from storage (fall back to seed content).
  const [initial] = useState(() => {
    const doc = loadDoc()
    return {
      title: doc?.title ?? SEED.title,
      content: doc?.content ?? SEED.content,
      settings: loadSettings(),
    }
  })

  const [content, setContent] = useState<string>(initial.content)
  const [title, setTitle] = useState<string>(initial.title)
  const [settings, setSettings] = useState<Settings>(initial.settings)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const [canInstall, setCanInstall] = useState(false)
  const installEvt = useRef<{ prompt: () => Promise<unknown> } | null>(null)

  // ---- theme -----------------------------------------------------------
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    saveTheme(theme)
  }, [theme])

  // ---- PWA install prompt --------------------------------------------
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      installEvt.current = e as unknown as { prompt: () => Promise<unknown> }
      setCanInstall(true)
    }
    const installed = () => setCanInstall(false)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const installApp = useCallback(async () => {
    const evt = installEvt.current
    if (!evt) return
    await evt.prompt()
    installEvt.current = null
    setCanInstall(false)
  }, [])

  // ---- speech engine ---------------------------------------------------
  const api = useSpeechSynthesis({
    content,
    settings,
    onFinished: () => {
      /* reading complete — state handled inside the hook */
    },
  })

  // ---- settings patch --------------------------------------------------
  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Auto-match voice when script changes
  useEffect(() => {
    const script = dominantScript(content)
    if (script !== 'th' || settings.voiceURI) return
    const thaiVoice = api.voices.find((v) => v.lang.startsWith('th'))
    if (thaiVoice) patchSettings({ voiceURI: thaiVoice.voiceURI })
  }, [content, api.voices, settings.voiceURI, patchSettings])
  const contentRef = useRef(content)
  contentRef.current = content
  const titleRef = useRef(title)
  titleRef.current = title
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveDoc({
        title: titleRef.current,
        content: contentRef.current,
        caretPosition: api.activeChunkIndex ?? 0,
      })
    }, 400)
    return () => window.clearTimeout(id)
  }, [content, title, api.activeChunkIndex])

  // ---- import ----------------------------------------------------------
  const handleImport = useCallback(
    (res: UploadResult) => {
      setContent(res.content)
      setTitle(res.title)
      api.stop()
    },
    [api]
  )

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOpenUpload={() => setUploadOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        canInstall={canInstall}
        onInstall={installApp}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 sm:p-5">
        {/* Desktop: side-by-side. Mobile: stacked, editor first. */}
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-start">
          <div className="min-h-0 flex flex-col">
            <EditorPane
              content={content}
              onContentChange={setContent}
              onPickSample={(t, c) => {
                api.stop()
                setTitle(t)
                setContent(c)
              }}
              activeChunkIndex={api.activeChunkIndex}
              autoScroll={settings.autoScroll}
              onOpenUpload={() => setUploadOpen(true)}
              onRestartFromChar={api.restartFromChar}
            />
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-text-faint">
              Tip: double-click a word in the text to jump the voice to that
              point. Your draft, caret position and settings save automatically.
            </p>
          </div>

          <div className="lg:sticky lg:top-4">
            <PlayerPanel
              api={api}
              settings={settings}
              onSettingsChange={patchSettings}
              content={content}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-line-soft px-4 py-3 text-center text-[11px] text-text-faint">
        Vocalize · built with the Web Speech API · runs fully in your browser
      </footer>

      <FileUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onImport={handleImport}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        content={content}
        title={title}
        settings={settings}
      />
    </div>
  )
}
