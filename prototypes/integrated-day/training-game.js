export const TRAINING_TARGETS = Object.freeze([0.28, 0.72, 0.5]);

function clampTrack(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.max(0, Math.min(1, numeric));
}

export function scoreShot(pointer, target) {
  const distance = Math.abs(clampTrack(pointer) - clampTrack(target));
  if (distance <= 0.08) return 2;
  if (distance <= 0.18) return 1;
  return 0;
}

export function createTrainingSession() {
  return {
    shotIndex: 0,
    score: 0,
    shots: [],
    complete: false
  };
}

export function takeShot(session, pointer) {
  if (session.complete) return session;

  const safePointer = clampTrack(pointer);
  const target = TRAINING_TARGETS[session.shotIndex];
  const points = scoreShot(safePointer, target);
  const shotIndex = session.shotIndex + 1;

  return {
    shotIndex,
    score: session.score + points,
    shots: [...session.shots, { pointer: safePointer, target, points }],
    complete: shotIndex === TRAINING_TARGETS.length
  };
}
