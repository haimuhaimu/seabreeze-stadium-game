export const TRAINING_FOCUS = Object.freeze({
  pressing: Object.freeze({ label: '前场压迫', attack: 6, defense: 0, cohesion: 0, injuryRisk: 2, youthTrust: 0 }),
  shape: Object.freeze({ label: '整体站位', attack: 0, defense: 5, cohesion: 2, injuryRisk: 0, youthTrust: 0 }),
  youth: Object.freeze({ label: '给年轻人机会', attack: 2, defense: 1, cohesion: 3, injuryRisk: 0, youthTrust: 2 })
});

export function createRoster() {
  return {
    attack: 48,
    defense: 48,
    cohesion: 46,
    trainingFocus: null,
    injuryRisk: 0,
    youthTrust: 0
  };
}

export function chooseTrainingFocus(roster, focusId) {
  const focus = TRAINING_FOCUS[focusId];
  if (!focus || roster.trainingFocus) throw new TypeError('Invalid training focus');
  return {
    ...roster,
    trainingFocus: focusId,
    attack: roster.attack + focus.attack,
    defense: roster.defense + focus.defense,
    cohesion: roster.cohesion + focus.cohesion,
    injuryRisk: roster.injuryRisk + focus.injuryRisk,
    youthTrust: roster.youthTrust + focus.youthTrust
  };
}
