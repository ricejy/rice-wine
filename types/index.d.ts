/**
 * What the rice-grain character is doing. `phase` is how far round its loop it
 * was (0 to 1) at `since`, so a redraw carries on from where it stood. `tick`
 * counts the redraws asked for as it settles down; absent in an older value.
 */
export type Mood = { isWorking: boolean; fill: number; phase: number; since: number; tick?: number }

declare module 'claude-code' {
  interface PluginState {
    'rice-wine': { mood: Mood }
  }
}
