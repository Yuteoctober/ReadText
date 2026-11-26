export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished'

export interface Settings {
  voiceURI: string | null
  speed: number // 0.5 – 3.0
  pitch: number // 0.5 – 2.0
  volume: number // 0 – 1
  autoScroll: boolean
}

export interface DocumentState {
  title: string
  content: string
  caretPosition: number // char index into content
}

export const DEFAULT_SETTINGS: Settings = {
  voiceURI: null,
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoScroll: true,
}

export const SPEED_MIN = 0.5
export const SPEED_MAX = 3.0
export const PITCH_MIN = 0.5
export const PITCH_MAX = 2.0
