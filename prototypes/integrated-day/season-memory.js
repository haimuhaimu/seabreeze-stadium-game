import { getSeasonNpc } from './season-content.js';
import { SEASON_EVENTS, getSeasonEventChoice } from './season-events.js';
import { getSeasonEventReaction, getSeasonEventReactionNpcIds } from './season-reactions.js';

function memoryFromRecord(record, npcId, timing) {
  if (!record?.eventId || !record?.choiceId) return null;
  const reactionNpcIds = getSeasonEventReactionNpcIds(record.eventId, record.choiceId);
  if (!reactionNpcIds.includes(npcId)) return null;
  const event = SEASON_EVENTS.find(item => item.id === record.eventId);
  const choice = getSeasonEventChoice(record.eventId, record.choiceId);
  return {
    eventId: record.eventId,
    choiceId: record.choiceId,
    eventTitle: event.title,
    choiceLabel: choice.label,
    npcId,
    round: record.round,
    seasonNumber: record.seasonNumber,
    timing,
    label: timing === 'current' ? '回应刚刚的决定' : `还记得第 ${record.round} 轮`,
    copy: getSeasonEventReaction(record.eventId, record.choiceId, npcId)
  };
}

export function getSeasonNpcMemory(season, npcId) {
  getSeasonNpc(npcId);
  if (!season?.active || season.seasonComplete || season.week?.roundComplete) return null;
  if (season.week.eventId && season.week.eventChoiceId) {
    return memoryFromRecord({
      eventId: season.week.eventId,
      choiceId: season.week.eventChoiceId,
      round: season.roundIndex + 1,
      seasonNumber: season.seasonNumber
    }, npcId, 'current');
  }
  return memoryFromRecord(season.eventHistory?.at(-1), npcId, 'previous');
}

