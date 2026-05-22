/**
 * Type-level and runtime assertions for EventPayloadMap privacy guarantees.
 *
 * Goal: confirm that PII-carrying fields (UUIDs and user-input text) are absent
 * from the analytics event schema, and that the replacement aggregate fields
 * are accepted correctly.
 *
 * The `@ts-expect-error` lines are the primary check: if the disallowed shape
 * were re-introduced to EventPayloadMap, TypeScript would remove the error and
 * the `@ts-expect-error` directive would itself become an error, causing the
 * build to fail.
 */

import type { EventPayloadMap } from '@/constants/events';

// ---------------------------------------------------------------------------
// log_edited: must NOT accept log_id; must accept empty object or field_changed
// ---------------------------------------------------------------------------

// @ts-expect-error log_id is not in log_edited payload
const _logEditedWithId: EventPayloadMap['log_edited'] = { log_id: 'abc-123' };

const _logEditedEmpty: EventPayloadMap['log_edited'] = {};
const _logEditedWithField: EventPayloadMap['log_edited'] = { field_changed: 'quantity' };
const _logEditedMultiple: EventPayloadMap['log_edited'] = { field_changed: 'multiple' };

// ---------------------------------------------------------------------------
// log_deleted: must NOT accept log_id; must accept empty object
// ---------------------------------------------------------------------------

// @ts-expect-error log_id is not in log_deleted payload
const _logDeletedWithId: EventPayloadMap['log_deleted'] = { log_id: 'abc-123' };

const _logDeletedEmpty: EventPayloadMap['log_deleted'] = {};

// ---------------------------------------------------------------------------
// goal_progress_viewed: must NOT accept goal_id; must accept goal_type
// ---------------------------------------------------------------------------

// @ts-expect-error goal_id is not in goal_progress_viewed payload
const _goalProgressWithId: EventPayloadMap['goal_progress_viewed'] = { goal_id: 'abc-123' };

const _goalProgressValid: EventPayloadMap['goal_progress_viewed'] = { goal_type: 'daily_cap' };
const _goalProgressSpend: EventPayloadMap['goal_progress_viewed'] = { goal_type: 'spend_cap_daily' };

// ---------------------------------------------------------------------------
// insight_viewed: must NOT accept insight_id; must accept insight_category
// ---------------------------------------------------------------------------

// @ts-expect-error insight_id is not in insight_viewed payload
const _insightWithId: EventPayloadMap['insight_viewed'] = { insight_id: 'abc-123' };

const _insightCategory: EventPayloadMap['insight_viewed'] = { insight_category: 'time_of_day' };
const _insightTrend: EventPayloadMap['insight_viewed'] = { insight_category: 'trend' };

// ---------------------------------------------------------------------------
// brand_created: must NOT accept brand_name or brand_id; must accept category + is_seed
// ---------------------------------------------------------------------------

// @ts-expect-error brand_name is not in brand_created payload
const _brandCreatedWithName: EventPayloadMap['brand_created'] = { brand_name: 'Camel' };

const _brandCreatedValid: EventPayloadMap['brand_created'] = { category: 'regular', is_seed: false };
const _brandCreatedSeed: EventPayloadMap['brand_created'] = { category: 'premium', is_seed: true };

// ---------------------------------------------------------------------------
// brand_favorited: must NOT accept brand_id; must accept category + is_seed
// ---------------------------------------------------------------------------

// @ts-expect-error brand_id is not in brand_favorited payload
const _brandFavoritedWithId: EventPayloadMap['brand_favorited'] = { brand_id: 'abc-123' };

const _brandFavoritedValid: EventPayloadMap['brand_favorited'] = { category: 'budget', is_seed: true };

// ---------------------------------------------------------------------------
// Runtime sanity: the shapes above are valid JS objects
// ---------------------------------------------------------------------------

describe('EventPayloadMap shape contracts', () => {
  it('log_edited accepts empty object', () => {
    const payload: EventPayloadMap['log_edited'] = {};
    expect(payload).toBeDefined();
  });

  it('log_edited accepts field_changed enum values', () => {
    const fields: Array<EventPayloadMap['log_edited']['field_changed']> = [
      'quantity', 'price', 'time', 'meta', 'multiple', undefined,
    ];
    fields.forEach((f) => {
      const payload: EventPayloadMap['log_edited'] = f !== undefined ? { field_changed: f } : {};
      expect(payload).toBeDefined();
    });
  });

  it('log_deleted accepts empty object', () => {
    const payload: EventPayloadMap['log_deleted'] = {};
    expect(payload).toBeDefined();
  });

  it('goal_progress_viewed accepts all GoalType values', () => {
    const types: Array<EventPayloadMap['goal_progress_viewed']['goal_type']> = [
      'daily_cap', 'spend_cap_daily', 'no_smoke_window', 'reduction_target', 'weekly_target', 'quit_date',
    ];
    types.forEach((goal_type) => {
      const payload: EventPayloadMap['goal_progress_viewed'] = { goal_type };
      expect(payload.goal_type).toBe(goal_type);
    });
  });

  it('insight_viewed accepts all insight_category values', () => {
    const categories: Array<EventPayloadMap['insight_viewed']['insight_category']> = [
      'time_of_day', 'trigger', 'trend', 'brand', 'dow', 'onboarding',
    ];
    categories.forEach((insight_category) => {
      const payload: EventPayloadMap['insight_viewed'] = { insight_category };
      expect(payload.insight_category).toBe(insight_category);
    });
  });

  it('brand_created accepts all BrandCategory values', () => {
    const categories: Array<EventPayloadMap['brand_created']['category']> = [
      'budget', 'regular', 'premium', 'imported', 'other',
    ];
    categories.forEach((category) => {
      const payload: EventPayloadMap['brand_created'] = { category, is_seed: false };
      expect(payload.category).toBe(category);
    });
  });

  it('brand_favorited accepts all BrandCategory values', () => {
    const categories: Array<EventPayloadMap['brand_favorited']['category']> = [
      'budget', 'regular', 'premium', 'imported', 'other',
    ];
    categories.forEach((category) => {
      const payload: EventPayloadMap['brand_favorited'] = { category, is_seed: true };
      expect(payload.is_seed).toBe(true);
    });
  });
});
