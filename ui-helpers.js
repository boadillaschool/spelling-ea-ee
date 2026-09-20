/**
 * Flattens a list of DOM children and drops the values that must never become text
 * nodes (`null`, `undefined`, `false`). `0` and empty strings are valid content.
 *
 * @param {unknown} children
 * @returns {unknown[]}
 */
export function normalizeChildren(children) {
  if (children === null || children === undefined) {
    return [];
  }

  return [children]
    .flat(Infinity)
    .filter((child) => child !== null && child !== undefined && child !== false);
}

/**
 * Label of the audio control: first listen, listen again, or a quiet playing state.
 *
 * @param {{ speaking: boolean, played: boolean }} state
 * @returns {string}
 */
export function getAudioLabel({ speaking, played }) {
  if (speaking) {
    return 'Reproduciendo…';
  }
  return played ? 'Escuchar otra vez' : 'Escuchar palabra';
}
