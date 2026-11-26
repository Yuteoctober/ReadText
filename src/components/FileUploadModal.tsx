import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileWarning, Check } from 'lucide-react'
import { Modal } from './ui'
import { parseFile, isParseError } from '../utils/fileParser'

export type UploadResult = { title: string; content: string; source: string }

export function FileUploadModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (result: UploadResult) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastImport, setLastImport] = useState<UploadResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const runParse = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      setLastImport(null)
      try {
        const res = await parseFile(file)
        onImport(res)
        setLastImport(res)
      } catch (e) {
        if (isParseError(e)) setError(e.message)
        else setError("That file couldn't be read. Try a different one.")
      } finally {
        setBusy(false)
      }
    },
    [onImport]
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0]
      if (f) runParse(f)
    },
    [runParse]
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import a document"
      wide
    >
      <p className="mb-4 text-sm text-text-dim">
        Bring text into the reader. Upload a <strong>.txt</strong>,{' '}
        <strong>.md</strong>, <strong>.html</strong> or <strong>.pdf</strong> file,
        or drop it in the box below.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragging
            ? 'border-accent bg-accent-soft'
            : 'border-line bg-surface-inset hover:border-accent/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.html,.htm,.csv,.log,.json,.xml,.rtf,.pdf"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <UploadCloud
          className={`h-9 w-9 ${dragging ? 'text-accent' : 'text-text-faint'}`}
        />
        <div className="mt-3 text-sm font-medium text-text">
          Drop a file here, or browse
        </div>
        <div className="mt-1 text-xs text-text-faint">
          Plain text and PDFs read directly. Scanned PDFs without text can't be
          imported.
        </div>
      </label>

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-text-dim">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Reading the file…
        </p>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-text">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <span>{error}</span>
        </div>
      )}

      {lastImport && !busy && !error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-text">
          <Check className="h-4 w-4 text-success" />
          <span>
            Loaded <strong>{lastImport.title}</strong> — it's now in the editor.
          </span>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-text-dim transition hover:text-text"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
