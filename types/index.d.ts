export type Stats = { tools: number; failed: number; requests: number; in: number; out: number; cached: number }

declare module 'claude-code' {
  interface PluginState {
    'ctx-band': { stats: Stats; bless: number | null; turns: number; frame: number; gen: number }
  }
}
