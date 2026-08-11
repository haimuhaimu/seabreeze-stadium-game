import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_DAYS,
  getCampaignDay,
  getRequiredAction,
  isPrologueDay,
  isManagementWeekDay
} from './campaign-content.js';

test('campaign calendar joins the three-day prologue to one management week', () => {
  assert.deepEqual(CAMPAIGN_DAYS.map(day => day.date), [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  assert.equal(isPrologueDay(2), true);
  assert.equal(isManagementWeekDay(3), true);
  assert.equal(getCampaignDay(9).weekday, '周日');
});

test('the first week has one required mainline action per day', () => {
  assert.deepEqual(CAMPAIGN_DAYS.slice(3).map(day => getRequiredAction(day.dayIndex)), [
    'episode-notice',
    'episode-promises',
    'episode-promise',
    'episode-promise',
    'episode-funding',
    'episode-offer',
    'episode-match'
  ]);
});
