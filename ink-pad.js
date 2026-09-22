function clamp(value, fallback) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function safePoint(point = {}) {
  return {
    x: clamp(point.x, 0),
    y: clamp(point.y, 0),
    pressure: point.pressure > 0 ? clamp(point.pressure, 0.5) : 0.5,
  };
}

export function createInkState() {
  return { strokes: [], activePointerId: null };
}

export function startInkStroke(state, pointerId, point) {
  if (state.activePointerId !== null) return state;
  return {
    strokes: [...state.strokes, [safePoint(point)]],
    activePointerId: pointerId,
  };
}

export function appendInkPoint(state, pointerId, point) {
  if (state.activePointerId !== pointerId || state.strokes.length === 0) return state;
  const strokes = state.strokes.map((stroke, index) =>
    index === state.strokes.length - 1 ? [...stroke, safePoint(point)] : stroke,
  );
  return { strokes, activePointerId: pointerId };
}

export function finishInkStroke(state, pointerId) {
  if (state.activePointerId !== pointerId) return state;
  return { strokes: state.strokes, activePointerId: null };
}

export function undoInkStroke(state) {
  if (state.strokes.length === 0) return createInkState();
  return { strokes: state.strokes.slice(0, -1), activePointerId: null };
}

export function clearInk() {
  return createInkState();
}
