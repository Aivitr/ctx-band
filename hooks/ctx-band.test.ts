import { describe, test, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const USAGE = {
  model: 'test-model',
  input_tokens: 1_000,
  cache_creation_input_tokens: 2_000,
  cache_read_input_tokens: 95_300,
  output_tokens: 5_000,
}

// 祝福语文本按「不含 %」从全部 Text 里挑（天气行都带百分号）；语料池本身不进测试
const blessingText = (texts: { text: string }[]) => texts.find(t => !t.text.includes('%'))

describe('ctx-band', () => {
  test('band shows weather, figures and per-turn input/output tokens', async ($: Engine, on) => {
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('turn.complete', ($_, e) => ({ text: e.answer }))
    on('ui.render', ($_, e) => e)

    await $.session.measure({
      context: { tokens: 134_400, window: 200_000, percent: 67 },
      rateLimits: [],
      changed: ['context'],
    })
    await $.turn.complete({
      answer: 'ok',
      durationMs: 1_000,
      isAborted: false,
      turnId: 't1',
      reason: 'answered',
      usage: USAGE,
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {},
    })

    await expect(band.find({ type: 'Text', text: 'context 67% · 134.4k / 200k' })).resolves.toBeDefined()
    // ↑ 绿色：uncached + cache write + cache read = 98.3k；↓ 红色：5k
    await expect(band.find({ type: 'Text', text: '↑ 98.3k' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Text', text: '↓ 5k' })).resolves.toBeDefined()

    // 与上下文无关的测量不改数字
    await $.session.measure({
      context: { tokens: 134_400, window: 200_000, percent: 67 },
      rateLimits: [],
      changed: ['cost'],
    })
    await expect(band.find({ type: 'Text', text: 'context 67% · 134.4k / 200k' })).resolves.toBeDefined()
  })

  test('at 95% the context field shows unchanged', async ($: Engine, on) => {
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('ui.render', ($_, e) => e)

    await $.session.measure({
      context: { tokens: 190_000, window: 200_000, percent: 95 },
      rateLimits: [],
      changed: ['context'],
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {},
    })

    await expect(band.find({ type: 'Text', text: 'context 95% · 190k / 200k' })).resolves.toBeDefined()
  })

  test('model switch shows the live window from usage, not the last measure', async ($: Engine, on) => {
    on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 108_200, window: 1_000_000, percent: 10 }, rateLimits: [] } }))
    on('clock.now', () => ({ value: 1 }))
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('ui.render', ($_, e) => e)

    // 旧模型 200k 时的测量快照
    await $.session.measure({
      context: { tokens: 108_200, window: 200_000, percent: 54 },
      rateLimits: [],
      changed: ['context'],
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {},
    })

    await expect(band.find({ type: 'Text', text: 'context 10% · 108.2k / 1M' })).resolves.toBeDefined()
  })

  test('before any turn there is no input/output line', async ($: Engine, on) => {
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('ui.render', ($_, e) => e)

    await $.session.measure({
      context: { tokens: 36_100, window: 200_000, percent: 18 },
      rateLimits: [],
      changed: ['context'],
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {},
    })

    await expect(band.find({ type: 'Text', text: 'context 18% · 36.1k / 200k' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Text', text: '↑' })).resolves.toBeUndefined()
  })

  test('subagent turns do not update the band', async ($: Engine, on) => {
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('turn.complete', ($_, e) => ({ text: e.answer }))
    on('ui.render', ($_, e) => e)

    await $.session.measure({
      context: { tokens: 36_100, window: 200_000, percent: 18 },
      rateLimits: [],
      changed: ['context'],
    })
    await $.turn.complete({
      answer: 'ok',
      durationMs: 1_000,
      isAborted: false,
      turnId: 't1',
      agentId: 'agent-1',
      reason: 'answered',
      usage: USAGE,
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {},
    })

    await expect(band.find({ type: 'Text', text: '↑' })).resolves.toBeUndefined()
  })

  test('idle blessing is static text with a reroll button', async ($: Engine, on) => {
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
    on('clock.now', () => ({ value: 1 }))
    on('session.start', ($_, e) => ({ cwd: e.cwd }))
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('ui.render', ($_, e) => e)

    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
    await $.session.measure({
      context: { tokens: 36_100, window: 200_000, percent: 18 },
      rateLimits: [],
      changed: ['context'],
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {},
    })

    // clock.now 为 1 → 初始句 idx 1；空闲时静态、无转轮
    await expect(band.find({ type: 'Text', text: 'Love yourself, dear me.' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Raster' })).resolves.toBeUndefined()

    await band.press({ key: 'bless' })
    const after = blessingText(await band.findAll({ type: 'Text' }))
    expect(after).toBeDefined()
    expect(after?.text).not.toBe('Love yourself, dear me.')
  })

  test('while working the blessing breathes behind a spinner', async ($: Engine, on) => {
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
    on('clock.now', () => ({ value: 1 }))
    on('session.start', ($_, e) => ({ cwd: e.cwd }))
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('ui.render', ($_, e) => e)

    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
    await $.session.measure({
      context: { tokens: 134_400, window: 200_000, percent: 67 },
      rateLimits: [],
      changed: ['context'],
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { isWorking: true },
    })

    await expect(band.find({ type: 'Raster' })).resolves.toBeDefined()
    expect(blessingText(await band.findAll({ type: 'Text' }))).toBeDefined()
    await expect(band.find({ type: 'Text', text: 'context 67% · 134.4k / 200k' })).resolves.toBeDefined()
  })

  test('blessing rerolls itself every three turns', async ($: Engine, on) => {
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
    on('clock.now', () => ({ value: 1 }))
    on('session.start', ($_, e) => ({ cwd: e.cwd }))
    on('session.measure', ($_, e) => ({ changed: e.changed }))
    on('turn.complete', ($_, e) => ({ text: e.answer }))
    on('ui.render', ($_, e) => e)

    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
    await $.session.measure({
      context: { tokens: 36_100, window: 200_000, percent: 18 },
      rateLimits: [],
      changed: ['context'],
    })

    const band = await $.ui.mount({
      plugin: 'ctx-band',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: {},
    })

    await expect(band.find({ type: 'Text', text: 'Love yourself, dear me.' })).resolves.toBeDefined()

    for (const turnId of ['t1', 't2', 't3']) {
      await $.turn.complete({
        answer: 'ok',
        durationMs: 1_000,
        isAborted: false,
        turnId,
        reason: 'answered',
        usage: USAGE,
      })
    }

    const after = blessingText(await band.findAll({ type: 'Text' }))
    expect(after).toBeDefined()
    expect(after?.text).not.toBe('Love yourself, dear me.')
  })
})