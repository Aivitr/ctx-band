export type Fill = { pct: number; tokens: number; win: number }
export type Io = { in: number; out: number }

declare module 'claude-code' {
  interface PluginState {
    'ctx-band': { fill: Fill | null; io: Io | null; bless: number | null; turns: number; frame: number; gen: number }
  }
}