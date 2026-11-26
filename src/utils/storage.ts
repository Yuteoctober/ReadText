import { DEFAULT_SETTINGS, type Settings } from '../types'

const K = {
  content: 'vocalize_doc',
  settings: 'vocalize_settings',
  theme: 'vocalize_theme',
  editorHeight: 'vocalize_editor_height',
}

export const EDITOR_HEIGHT_MIN = 160
export const EDITOR_HEIGHT_MAX = 900
export const EDITOR_HEIGHT_DEFAULT = 380

export function clampEditorHeight(n: number): number {
  return Math.min(EDITOR_HEIGHT_MAX, Math.max(EDITOR_HEIGHT_MIN, Math.round(n)))
}

export function loadEditorHeight(): number {
  const raw = safeGet(K.editorHeight)
  const n = raw ? parseInt(raw, 10) : NaN
  return clampEditorHeight(Number.isFinite(n) ? n : EDITOR_HEIGHT_DEFAULT)
}

export function saveEditorHeight(n: number): void {
  safeSet(K.editorHeight, String(Math.round(clampEditorHeight(n))))
}

export interface PersistedDoc {
  title: string
  content: string
  caretPosition: number
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export function loadDoc(): PersistedDoc | null {
  const raw = safeGet(K.content)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDoc>
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      content: typeof parsed.content === 'string' ? parsed.content : '',
      caretPosition:
        typeof parsed.caretPosition === 'number' ? parsed.caretPosition : 0,
    }
  } catch {
    return null
  }
}

export function saveDoc(doc: PersistedDoc): void {
  safeSet(K.content, JSON.stringify(doc))
}

export function loadSettings(): Settings {
  const raw = safeGet(K.settings)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings): void {
  safeSet(K.settings, JSON.stringify(s))
}

export type ThemeName = 'dark' | 'light'

export function loadTheme(): ThemeName {
  return safeGet(K.theme) === 'light' ? 'light' : 'dark'
}
export function saveTheme(t: ThemeName): void {
  safeSet(K.theme, t)
}
