import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_DAYS,
  getCampaignDay,
  getRequiredAction,
  isPrologueDay,
  isManagementWeekDay,
  isNamingRightsWeekDay
} from './campaign-content.js';

test('campaign calendar joins the prologue to two complete management weeks', () => {
  assert.deepEqual(CAMPAIGN_DAYS.map(day => day.date), [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
  assert.equal(isPrologueDay(2), true);
  assert.equal(isManagementWeekDay(3), true);
  assert.equal(getCampaignDay(9).weekday, '周日');
  assert.equal(isNamingRightsWeekDay(10), true);
  assert.equal(isNamingRightsWeekDay(16), true);
  assert.equal(isNamingRightsWeekDay(17), false);
});

test('the first week has one required mainline action per day', () => {
  assert.deepEqual(CAMPAIGN_DAYS.slice(3, 10).map(day => getRequiredAction(day.dayIndex)), [
    'episode-notice',
    'episode-promises',
    'episode-promise',
    'episode-promise',
    'episode-funding',
    'episode-offer',
    'episode-match'
  ]);
});

test('the naming rights week has one required mainline scene per day', () => {
  assert.deepEqual(CAMPAIGN_DAYS.slice(10).map(day => getRequiredAction(day.dayIndex)), [
    'naming-proposal',
    'naming-chairs',
    'naming-alternative',
    'naming-plaque',
    'naming-vote',
    'naming-response',
    'naming-match'
  ]);
});
