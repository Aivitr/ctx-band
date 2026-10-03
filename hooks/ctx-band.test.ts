import { describe, test, expect } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'

import { cacheTone } from '../hooks/register'

type On = Parameters<TestBody>[1]

const USAGE = {
  model: 'test-model',
  input_tokens: 1_000,
  cache_creation_input_tokens: 2_000,
  cache_read_input_tokens: 95_300,
  output_tokens: 5_000,
}

// 引擎之下的一次响应；usage 由各测试决定，band 上的一切数字都从它来
const reply = (on: On, usage: unknown = USAGE) =>
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage }
  })

// 一次模型请求：把 turn.step 的流跑到底，桩给的 usage 才会落进 band
const request = async ($: Engine, index = 0) => {
  const step = $.turn.step({ turnId: 't1', index, model: 'test-model', messageCount: 1 })
  while (!(await step.next()).done);
}

const mount = ($: Engine, props: Record<string, unknown> = {}) =>
  $.ui.mount({ plugin: 'ctx-band', surface: 'terminal', component: 'AbovePrompt', props })

// 左端在祝福语的用例里只有一行 idle，其余 Text 就是祝福语本身
const blessingText = (texts: { text: string }[]) => texts.find(t => t.text !== 'idle')?.text

describe('ctx-band', () => {
  test('cache tone steps through five colours', () => {
    expect(cacheTone(0)).toBe('#e5484d')
    expect(cacheTone(19)).toBe('#e5484d')
    expect(cacheTone(20)).toBe('#f76b15')
    expect(cacheTone(39)).toBe('#f76b15')
    expect(cacheTone(40)).toBe('#ffb224')
    expect(cacheTone(59)).toBe('#ffb224')
    expect(cacheTone(60)).toBe('#4a9eff')
    expect(cacheTone(79)).toBe('#4a9eff')
    expect(cacheTone(80)).toBe('#30a46c')
    expect(cacheTone(100)).toBe('#30a46c')
  })

  test('a fresh session shows idle', async ($: Engine, on) => {
    on('ui.render', ($_, e) => e)

    const band = await mount($)
    await expect(band.find({ type: 'Text', text: 'idle' })).resolves.toBeDefined()
  })

  test('one request fills the band: request, tokens and cache hit', async ($: Engine, on) => {
    reply(on)
    on('ui.render', ($_, e) => e)

    await request($)

    const band = await mount($)
    await expect(band.find({ type: 'Text', text: '1 request' })).resolves.toBeDefined()
    // ↑ 绿色：uncached + cache write + cache read = 98.3k；↓ 红色：5k；命中 95.3k/98.3k = 97%
    await expect(band.find({ type: 'Text', text: '↑ 98.3k' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Text', text: '↓ 5k' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Text', text: 'cache 97%' })).resolves.toBeDefined()
  })

  test('every request in the turn adds up', async ($: Engine, on) => {
    reply(on)
    on('ui.render', ($_, e) => e)

    await request($, 0)
    await request($, 1)
    await request($, 2)

    const band = await mount($)
    await expect(band.find({ type: 'Text', text: '3 requests' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Text', text: '↑ 294.9k' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Text', text: '↓ 15k' })).resolves.toBeDefined()
  })

  test('tool calls count and a failure stands out', async ($: Engine, on) => {
    reply(on)
    let bad = false
    on('tool.call', () => (bad ? { isError: true, result: 'boom', text: 'boom' } : { result: {} }))
    on('ui.render', ($_, e) => e)

    await $.tool.call({ tool: 'Read', file_path: 'a.md' })
    await $.tool.call({ tool: 'Read', file_path: 'b.md' })
    bad = true
    await $.tool.call({ tool: 'Read', file_path: 'c.md' })

    const band = await mount($)
    await expect(band.find({ type: 'Text', text: '3 tools' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Text', text: '1 failed' })).resolves.toBeDefined()
  })

  test('a new turn clears the band', async ($: Engine, on) => {
    reply(on)
    on('turn.start', ($_, e) => ({ turnId: e.turnId }))
    on('ui.render', ($_, e) => e)

    await request($)
    await $.turn.start({ text: '', turnId: 't2' })

    const band = await mount($)
    await expect(band.find({ type: 'Text', text: 'idle' })).resolves.toBeDefined()
  })

  test('idle blessing is static text with a reroll button', async ($: Engine, on) => {
    on('clock.now', () => ({ value: 1 }))
    on('session.start', ($_, e) => ({ cwd: e.cwd }))
    on('ui.render', ($_, e) => e)

    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

    const band = await mount($)
    // clock.now 为 1 → 初始句 idx 1；空闲时静态、无转轮
    await expect(band.find({ type: 'Text', text: 'Love yourself, dear me.' })).resolves.toBeDefined()
    await expect(band.find({ type: 'Raster' })).resolves.toBeUndefined()

    await band.press({ key: 'bless' })
    const after = blessingText(await band.findAll({ type: 'Text' }))
    expect(after).toBeDefined()
    expect(after).not.toBe('Love yourself, dear me.')
  })

  test('while working the blessing breathes behind a spinner', async ($: Engine, on) => {
    on('clock.now', () => ({ value: 1 }))
    on('session.start', ($_, e) => ({ cwd: e.cwd }))
    on('ui.render', ($_, e) => e)

    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

    const band = await mount($, { isWorking: true })
    await expect(band.find({ type: 'Raster' })).resolves.toBeDefined()
    expect(blessingText(await band.findAll({ type: 'Text' }))).toBeDefined()
  })

  test('blessing rerolls itself every three turns', async ($: Engine, on) => {
    on('clock.now', () => ({ value: 1 }))
    on('session.start', ($_, e) => ({ cwd: e.cwd }))
    on('turn.complete', ($_, e) => ({ text: e.answer }))
    on('ui.render', ($_, e) => e)

    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

    const band = await mount($)
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
    expect(after).not.toBe('Love yourself, dear me.')
  })
})
