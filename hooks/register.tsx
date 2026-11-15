import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import type { Mood } from '../types'

import { makeColors } from './make-colors.js'
import { SPRITES } from './sprites'

// Milky rice paper by day, a dark earthenware jar by night, celadon glaze for the accent.
const { theme, problems } = makeColors({
  label: 'Rice wine',
  roles: { accent: '#3f8f78', danger: '#b5402f', success: '#5d8a3a', warning: '#b07a1a', pro: '#7a5c9c' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#ebe7da',
        'surface-1': '#f2efe4',
        'surface-2': '#f8f6ee',
        'text-primary': '#22271f',
        'text-secondary': '#484e42',
        'text-muted': '#5f6558',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#161a17',
        'surface-1': '#1d221e',
        'surface-2': '#242a25',
        'surface-3': '#29302a',
        'text-primary': '#ece9dd',
        'text-secondary': '#c9c7b8',
        'text-muted': '#a5a696',
      },
    },
  },
})

const SCENE_NAME = 'rice-wine-grains'

// Rice grains drifting slowly upward, like sediment stirred in a bowl. Placed by a
// fixed sequence, and each one's place in its drift is taken from the clock, so a
// redraw carries every grain on from where it was and none jumps.
const buildGrains = (seconds: number): string => {
  let seed = 7
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647

    return seed / 2147483647
  }
  const grains: string[] = []

  for (let i = 0; i < 46; i++) {
    const x = Math.round(rand() * 1600)
    const y = Math.round(rand() * 1000)
    const rx = (5 + rand() * 5).toFixed(1)
    const ry = (2 + rand() * 1.6).toFixed(1)
    const turn = Math.round(rand() * 180)
    const period = Math.round(38 + rand() * 40)
    const delay = (-((rand() * 60 + seconds) % period)).toFixed(2)
    const opacity = (0.1 + rand() * 0.16).toFixed(2)

    grains.push(
      `<g style="animation:rise ${period}s linear ${delay}s infinite">` +
        `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" opacity="${opacity}" transform="rotate(${turn} ${x} ${y})"/></g>`,
    )
  }

  return (
    '<defs><radialGradient id="glow" cx="80%" cy="10%" r="70%">' +
    '<stop offset="0" stop-color="#3f8f78" stop-opacity="0.16"/><stop offset="1" stop-color="#3f8f78" stop-opacity="0"/>' +
    '</radialGradient></defs>' +
    '<rect width="1600" height="1000" fill="url(#glow)"/>' +
    // Two copies, one a screen below, so the field never runs empty.
    `<g fill="#8fae9c">${grains.join('')}<g transform="translate(0 1000)">${grains.join('')}</g></g>`
  )
}

const mood = atom({ plugin: 'rice-wine', key: 'mood' } as const, { isWorking: false, fill: 0, phase: 0, since: 0, tick: 0 })

// Where it stays: low on the right, clear of the chat and the message box.
const SPOT = { x: 1300, y: 690 }
// Seconds it eats before it nods off, and seconds on one thing while working.
const SIP = 25
const SWAP = 12
// What it does while the model works, one after another.
const WORK = ['laptop', 'lift', 'sprint'] as const

// One pose of the mascot, 92 units square with its feet at y = 40. A pose is
// rows of short strokes on a grid of 144 cells a side (about one cell to a
// screen dot at the size it is shown: finer only makes the scene slow to paint), a little thicker and
// longer than their cells so no gap shows between them.
const pose = (strokes: string): string =>
  `<g transform="translate(-46 -51.8) scale(${(92 / 144).toFixed(4)})" fill="none" stroke-width="1.3" stroke-linecap="square">${strokes}</g>`

// The character: the bowl-of-rice mascot, drawn from its pose pictures (as
// strokes: the app drops a picture embedded in a scene). It stays in one spot
// and only what it does changes, so nothing depends on a move being animated.
// While the model works it types at a laptop, lifts weights or runs on the
// spot, a new one every few seconds. Resting, it eats for a while, then
// falls asleep; once the context window is 80% full it frets instead. A small
// bar under it shows how full the window is: green, amber past 60%, red past 80%.
const buildScene = (state: Mood, now: number): string => {
  const rested = Math.max(0, now - state.since) / 1000
  const fill = Math.min(100, Math.max(0, state.fill))
  const isWorried = fill >= 80
  const gauge = isWorried ? '#cf5a45' : fill >= 60 ? '#d9a441' : '#5fa88f'
  const sweat = isWorried ? '<path class="sweat" d="M30 -44 q4 7 0 10 q-4 -3 0 -10z" fill="#8fd0e8"/>' : ''
  // Three Zs that float up once it has nodded off.
  const zs =
    '<g stroke="#3f8f78" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
    '<path class="z" d="M40 -56 h10 l-10 11 h10"/>' +
    '<path class="z" style="animation-delay:1s" d="M56 -74 h8 l-8 9 h8"/>' +
    '<path class="z" style="animation-delay:2s" d="M68 -90 h6 l-6 7 h6"/></g>'
  const doing = WORK[(state.tick ?? 0) % WORK.length]
  const working =
    doing === 'laptop'
      ? `<g class="tap">${pose(SPRITES.laptop)}${sweat}</g>`
      : doing === 'lift'
        ? `<g class="pump">${pose(SPRITES.lift)}${sweat}</g>`
        : `<g class="trot">${pose(SPRITES.sprint)}${sweat}</g>`
  const resting = isWorried
    ? `<g class="tremble">${pose(SPRITES.worry)}${sweat}</g>`
    : rested < SIP
      ? `<g class="nod">${pose(SPRITES.eat)}</g>`
      : `<g class="breathe">${pose(SPRITES.sleep)}</g>${zs}`

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">' +
    '<style>@keyframes rise{from{transform:translateY(60px)}to{transform:translateY(-1060px)}}' +
    // Typing: a quick little bob. Lifting: a slow squat and push.
    '@keyframes tap{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.6px)}}' +
    '@keyframes pump{0%,100%{transform:scale(1.04,0.95)}50%{transform:scale(0.98,1.04)}}' +
    // Running on the spot: the typing bob, only higher.
    '@keyframes trot{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
    '@keyframes nod{0%,55%,100%{transform:rotate(0)}70%,85%{transform:rotate(-5deg) translateY(1px)}}' +
    '@keyframes breathe{0%,100%{transform:scale(1.03,0.97)}50%{transform:scale(0.99,1.02)}}' +
    '@keyframes tremble{0%,100%{transform:translateX(-1.2px)}50%{transform:translateX(1.2px)}}' +
    '@keyframes drip{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(12px);opacity:0}}' +
    '@keyframes zed{0%{transform:translate(0,8px);opacity:0}30%{opacity:0.9}100%{transform:translate(6px,-14px);opacity:0}}' +
    '.tap{animation:tap 0.22s ease-in-out infinite}' +
    '.pump{transform-origin:0 40px;animation:pump 1.1s ease-in-out infinite}' +
    '.trot{animation:trot 0.3s ease-in-out infinite}' +
    '.nod{transform-origin:0 40px;animation:nod 2.6s ease-in-out infinite}' +
    '.breathe{transform-origin:0 40px;animation:breathe 3.4s ease-in-out infinite}' +
    '.tremble{animation:tremble 0.16s linear infinite}' +
    '.sweat{animation:drip 1.4s ease-in infinite}' +
    '.z{opacity:0;animation:zed 3s ease-out infinite}' +
    '@media (prefers-reduced-motion:reduce){g,path{animation:none!important}}</style>' +
    buildGrains(now / 1000) +
    // Placed by the group's own attribute, not by a style: it is on screen
    // whether or not the app runs the scene's animations.
    `<g transform="translate(${SPOT.x} ${SPOT.y})">` +
    (state.isWorking ? working : resting) +
    // How full the context window is.
    '<rect x="-24" y="46" width="48" height="5" rx="2.5" fill="#3f8f78" opacity="0.22"/>' +
    (fill > 0 ? `<rect x="-24" y="46" width="${((48 * fill) / 100).toFixed(1)}" height="5" rx="2.5" fill="${gauge}"/>` : '') +
    '</g>' +
    '</svg>'
  )
}

// A light frost, so the character stays readable behind the panels.
const LOOK: ThemeSetArgs = { colors: theme, backdrop: { scene: SCENE_NAME, glass: { blur: 4, opacity: 0.62 } } }

// Move to a new state, and only when something changed: every write redraws
// the scene. `since` is when it last started or stopped working.
async function shift($: EngineInterface, change: Partial<Pick<Mood, 'isWorking' | 'fill'>>): Promise<void> {
  const now = await $.clock.now()
  const was = await read($, mood)
  const isWorking = change.isWorking ?? was.isWorking
  const fill = change.fill ?? was.fill

  if (isWorking === was.isWorking && fill === was.fill) {
    return
  }
  await update($, mood, state =>
    isWorking === state.isWorking
      ? { ...state, fill }
      : // Each stretch of work opens on the next thing in its round.
        { ...state, isWorking, fill, since: now, tick: (state.tick ?? 0) + (isWorking ? 1 : 0) },
  )
}

// The redraws owed as time passes. The module's own, so a reload starts over.
let timers: { cancel: () => void }[] = []

function rouse(): void {
  for (const timer of timers) {
    timer.cancel()
  }
  timers = []
}

// Resting: one redraw as it nods off.
function settle($: EngineInterface, rested: number): void {
  rouse()
  const wait = SIP * 1000 - rested + 150

  if (wait > 0) {
    timers = [$.clock.after(wait, () => {
      // Nothing to do if the session is gone by now.
      update($, mood, state => ({ ...state, tick: (state.tick ?? 0) + 1 })).catch(() => {})
    })]
  }
}

// Working: a redraw every few seconds, for the next thing it does.
function pace($: EngineInterface): void {
  rouse()
  timers = [$.clock.after(SWAP * 1000, () => {
    swap($).catch(() => {})
  })]
}

async function swap($: EngineInterface): Promise<void> {
  const state = await read($, mood)

  if (!state.isWorking) {
    return
  }
  await update($, mood, was => ({ ...was, tick: (was.tick ?? 0) + 1 }))
  pace($)
}

// The context window's fill, in whole tens of a percent: 80 means at least 80% full.
const fillOf = (percent: number | undefined): number => Math.floor((percent ?? 0) / 10) * 10

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const usage = await $.session.usage()
    const now = await $.clock.now()
    const rest = await update($, mood, state => ({
      ...state,
      isWorking: false,
      fill: fillOf(usage.context.percent),
      // A load mid-work sits it down now; one while it rests leaves it as it is.
      since: state.isWorking ? now : state.since,
    }))
    settle($, now - rest.since)
    // Where no surface draws the look (a terminal), it is simply not shown.
    await $.theme.set(LOOK)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await shift($, { isWorking: true })
      pace($)
      // Ask for the scene again outright: a write made as a turn starts does
      // not always bring a redraw with it.
      await $.theme.set(LOOK)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const answer = await next(e)

    if (e.agentId === undefined) {
      await shift($, { isWorking: false })
      settle($, 0)
    }

    return answer
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await shift($, { fill: fillOf(e.context.percent) })
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    // Draw for whichever surface asks, so long as it can draw an Svg: a pass
    // here answers with nothing, and the app then shows an empty backdrop.
    const table = $.ui.resolve(e)

    if (!('Svg' in table) || e.props.scene !== SCENE_NAME) {
      return next(e)
    }
    const { Svg } = table
    const state = await read($, mood)
    const doing = state.isWorking ? 'busy while Claude works' : 'resting'

    return (
      <Svg
        source={buildScene(state, await $.clock.now())}
        alt={`Rice grains drifting upward, and a little bowl-of-rice mascot ${doing}, ${state.fill}% full of context`}
      />
    )
  })
}
