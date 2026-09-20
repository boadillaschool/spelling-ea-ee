/**
 * Decides what to do with keyboard focus after a render.
 *
 * Focus moves to the screen target only on a genuine screen or step change. A re-render of the
 * same screen (choosing ea/ee, ordinary feedback) keeps the focused control, and opening or
 * closing the reset confirmation moves focus into or out of it.
 *
 * @param {{
 *   previous: { screen: string, confirm: boolean } | null,
 *   next: { screen: string, confirm: boolean },
 *   activeKey?: string | null,
 *   availableKeys?: string[],
 * }} input
 * @returns {{ type: 'screen' | 'confirm-open' | 'confirm-close' | 'restore' | 'none', key?: string }}
 */
export function planFocus({ previous, next, activeKey = null, availableKeys = [] }) {
  if (previous === null || previous.screen !== next.screen) {
    return { type: 'screen' };
  }

  if (previous.confirm !== next.confirm) {
    return { type: next.confirm ? 'confirm-open' : 'confirm-close' };
  }

  if (activeKey !== null && availableKeys.includes(activeKey)) {
    return { type: 'restore', key: activeKey };
  }

  return { type: 'none' };
}
