import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage } from 'claude-code'

import type { Fill } from '../types'

const fill = atom({ plugin: 'context-meter', key: 'fill' } as const, null)

const SEGMENTS = 10

// Blue up to 50%, then yellow, orange and red at 100%.
const STOPS: ReadonlyArray<readonly [number, [number, number, number]]> = [
  [0, [59, 130, 246]],
  [50, [59, 130, 246]],
  [65, [234, 179, 8]],
  [82, [249, 115, 22]],
  [100, [220, 38, 38]],
]

// The desktop's own context indicator sums the per-category estimate that
// /context shows, against the model's window. The meter uses the same figure,
// so the two always agree; it falls back to the last response's input tokens
// where no estimate is available.
export function toFill(context: SessionContextUsage): Fill | null {
  const tokens = context.breakdown?.totalTokens ?? context.tokens

  if (tokens === undefined || context.window <= 0) {
    return null
  }

  return { tokens, window: context.window, percent: Math.round((tokens / context.window) * 100) }
}

async function refresh($: EngineInterface): Promise<void> {
  const { context } = await $.session.usage({ breakdown: 'summary' })
  await update($, fill, () => toFill(context))
}

function toHex([r, g, b]: readonly number[]): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')
}

export function colorAt(percent: number): string {
  const p = Math.max(0, Math.min(100, percent))

  for (let i = 1; i < STOPS.length; i++) {
    const [p0, c0] = STOPS[i - 1]
    const [p1, c1] = STOPS[i]

    if (p <= p1) {
      const t = p1 === p0 ? 0 : (p - p0) / (p1 - p0)

      return toHex(c0.map((c, j) => c + (c1[j] - c) * t))
    }
  }

  return toHex(STOPS[STOPS.length - 1][1])
}

export function filledSegments(percent: number, segments = SEGMENTS): number {
  return Math.min(segments, Math.round((percent / 100) * segments))
}

// The desktop draws this slot in a frame of at most 24 characters that
// shrinks with the footer and cuts the end, where the percentage is, with an
// ellipsis. Measured on the desktop, the frame's room comes to about
// 0.9 × viewport.columns − 23 characters; a segment takes about 1.7, the
// number about 1.05 per digit plus 2, the mode label about 0.75 per letter.
// The bar gives up segments, with a margin of 2, so the number stays.
export function segmentsFor(columns: number | undefined, percent: number, label: string): number {
  if (columns === undefined) {
    return SEGMENTS
  }

  const room = 0.9 * columns - 25
  const number = 2 + 1.05 * String(percent).length
  const modes = 0.75 * label.length

  return Math.max(0, Math.min(SEGMENTS, Math.floor((room - number - modes) / 1.7)))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })

  // A tool result grows the context before the next response reports it.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    await refresh($)

    return result
  })

  // Drawn in the slot of the mode labels, under the model name.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const current = await read($, fill)

    if (current === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const modes = e.props.modes.length > 0 ? `${e.props.modes.join(' & ')}  ` : ''
    const count =
      e.surface === 'desktop' ? segmentsFor(e.viewport?.columns, current.percent, modes) : SEGMENTS
    const full = filledSegments(current.percent, count)
    const segments = Array.from({ length: count }, (_, i) =>
      i < full ? (
        <Text key={`s${i}`} color={colorAt(((i + 1) / count) * 100)}>
          ▰
        </Text>
      ) : (
        <Text key={`s${i}`} dimColor>
          ▱
        </Text>
      ),
    )

    return (
      <Box flexDirection="row">
        {modes !== '' && <Text dimColor>{modes}</Text>}
        {segments}
        <Text color={colorAt(current.percent)} bold={current.percent > 50} tabular>
          {`${count > 0 ? ' ' : ''}${current.percent}%`}
        </Text>
      </Box>
    )
  })
}
