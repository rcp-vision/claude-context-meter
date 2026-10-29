import { expect, test } from 'claude-code/testing'

import { colorAt, filledSegments, segmentsFor, toFill } from './register'

test('stays blue up to 50% and reaches red at 100%', () => {
  expect(colorAt(10)).toBe('#3b82f6')
  expect(colorAt(50)).toBe('#3b82f6')
  expect(colorAt(65)).toBe('#eab308')
  expect(colorAt(100)).toBe('#dc2626')
})

test('fills segments in proportion to the percentage', () => {
  expect(filledSegments(0)).toBe(0)
  expect(filledSegments(16)).toBe(2)
  expect(filledSegments(100)).toBe(10)
  expect(filledSegments(50, 6)).toBe(3)
})

test('uses the per-category estimate against the model window', () => {
  const fill = toFill({
    tokens: 600_000,
    window: 1_000_000,
    percent: 60,
    breakdown: { totalTokens: 635_843 } as never,
  })

  expect(fill).toEqual({ tokens: 635_843, window: 1_000_000, percent: 64 })
})

test('falls back to the last response without an estimate', () => {
  expect(toFill({ tokens: 88_529, window: 1_000_000, percent: 9 })?.percent).toBe(9)
  expect(toFill({ window: 1_000_000 })).toBeNull()
})

test('gives up segments as the desktop footer narrows', () => {
  // Measured: a maximized window, an 800 px window, a 600 px window.
  expect(segmentsFor(98, 30, '')).toBe(10)
  expect(segmentsFor(45, 30, '')).toBe(6)
  expect(segmentsFor(32, 30, '')).toBe(0)
  expect(segmentsFor(45, 30, 'focus  ')).toBe(3)
  expect(segmentsFor(undefined, 30, '')).toBe(10)
})

const SESSION_MODE = {
  plugin: 'context-meter',
  component: 'SessionMode',
  requestId: 'session-mode',
} as const

async function start($: Parameters<Parameters<typeof test>[1]>[0], on: Parameters<Parameters<typeof test>[1]>[1]) {
  // These hooks stand for the engine: a call on `$` is answered `{ value }`.
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 160_000, window: 1_000_000, percent: 16 },
      rateLimits: [],
    },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

test('writes the percentage after the bar, on every surface', async ($, on) => {
  await start($, on)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      ...SESSION_MODE,
      surface,
      viewport: { columns: 98, rows: 46 },
      props: { modes: ['focus'] },
    })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)

    expect(texts[0]).toBe('focus  ')
    expect(texts[texts.length - 1]).toBe(' 16%')
    expect(texts.join('')).toBe('focus  ▰▰▱▱▱▱▱▱▱▱ 16%')
    await ui.unmount()
  }
})

test('keeps the percentage in a narrow desktop window', async ($, on) => {
  await start($, on)

  const narrow = await $.ui.mount({
    ...SESSION_MODE,
    surface: 'desktop',
    viewport: { columns: 45, rows: 29 },
    props: { modes: [] },
  })
  expect((await narrow.findAll({ type: 'Text' })).map(t => t.text).join('')).toBe('▰▱▱▱▱▱ 16%')
  await narrow.unmount()

  const tiny = await $.ui.mount({
    ...SESSION_MODE,
    surface: 'desktop',
    viewport: { columns: 32, rows: 29 },
    props: { modes: [] },
  })
  expect((await tiny.findAll({ type: 'Text' })).map(t => t.text).join('')).toBe('16%')
  await tiny.unmount()

  // The terminal keeps the whole bar: its footer is not capped.
  const terminal = await $.ui.mount({
    ...SESSION_MODE,
    surface: 'terminal',
    viewport: { columns: 45, rows: 29 },
    props: { modes: [] },
  })
  expect((await terminal.findAll({ type: 'Text' })).map(t => t.text).join('')).toBe('▰▰▱▱▱▱▱▱▱▱ 16%')
  await terminal.unmount()
})
