import { Download, Moon, Sun, Upload, Radio } from 'lucide-react'
import type { ThemeName } from '../utils/storage'

export function Header({
  theme,
  onToggleTheme,
  onOpenUpload,
  onOpenExport,
  canInstall,
  onInstall,
}: {
  theme: ThemeName
  onToggleTheme: () => void
  onOpenUpload: () => void
  onOpenExport: () => void
  canInstall: boolean
  onInstall: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line-soft bg-surface-raised/60 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Radio className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight text-text">
            Vocalize
          </h1>
          <p className="hidden text-[11px] text-text-dim sm:block">
            Text-to-Speech Reader
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-text transition hover:bg-surface-inset"
        >
          <Upload className="h-3.5 w-3.5 text-text-dim" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:bg-accent-strong"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {canInstall && (
          <button
            type="button"
            onClick={onInstall}
            className="hidden items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text-dim transition hover:bg-surface-inset hover:text-text md:inline-flex"
            title="Install app"
          >
            Install
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="rounded-lg border border-line p-1.5 text-text-dim transition hover:bg-surface-inset hover:text-text"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  )
}
