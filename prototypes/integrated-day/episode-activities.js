export const PASS_TARGETS = Object.freeze([0.28, 0.72, 0.5]);

export const FUNDRAISER_ORDERS = Object.freeze([
  Object.freeze({ customer: '乔乔', itemId: 'fruit', label: '果子水' }),
  Object.freeze({ customer: '闻书', itemId: 'tea', label: '青草茶' }),
  Object.freeze({ customer: '苏米', itemId: 'towel', label: '干净毛巾' })
]);

export const ARCHIVE_CLUES = Object.freeze(['signature', 'date', 'photo']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function requireSession(session, type) {
  if (!session || session.type !== type) throw new TypeError(`Expected ${type} activity`);
}

export function createEpisodeActivity(promiseId) {
  if (promiseId === 'train') {
    return { type: 'train', step: 0, attempts: [], complete: false };
  }
  if (promiseId === 'fundraise') {
    return {
      type: 'fundraise',
      step: 0,
      orders: FUNDRAISER_ORDERS.map(order => ({ ...order })),
      customersServed: 0,
      complete: false
    };
  }
  if (promiseId === 'records') {
    return { type: 'records', cluesFound: [], complete: false };
  }
  throw new TypeError('Unknown episode activity');
}

export function takePass(session, pointer) {
  requireSession(session, 'train');
  if (session.complete) return session;
  const safePointer = clamp(Number(pointer) || 0, 0, 1);
  const target = PASS_TARGETS[session.step];
  const difference = Math.abs(safePointer - target);
  const quality = difference <= 0.08 ? 'clean' : difference <= 0.14 ? 'close' : 'late';
  const attempts = [...session.attempts, { pointer: safePointer, target, quality }];
  const step = session.step + 1;
  return { ...session, step, attempts, complete: step === PASS_TARGETS.length };
}

export function serveFundraiser(session, itemId) {
  requireSession(session, 'fundraise');
  if (session.complete) return session;
  const order = session.orders[session.step];
  if (order.itemId !== itemId) return session;
  const step = session.step + 1;
  return {
    ...session,
    step,
    customersServed: session.customersServed + 1,
    complete: step === session.orders.length
  };
}

export function inspectArchiveClue(session, clueId) {
  requireSession(session, 'records');
  if (!ARCHIVE_CLUES.includes(clueId)) throw new TypeError('Unknown archive clue');
  if (session.cluesFound.includes(clueId)) return session;
  const cluesFound = [...session.cluesFound, clueId];
  return { ...session, cluesFound, complete: cluesFound.length === ARCHIVE_CLUES.length };
}

