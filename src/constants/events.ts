// Privacy-aware analytics event schema.
// Events are written to Supabase `usage_events` (RLS, per user). No third-party SDKs.

export const AnalyticsEvents = {
  APP_OPENED: 'app_opened',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  CIGARETTE_LOGGED: 'cigarette_logged',
  QUICK_ADD_USED: 'quick_add_used',
  REPEAT_LAST_USED: 'repeat_last_used',
  LOG_EDITED: 'log_edited',
  LOG_DELETED: 'log_deleted',
  GOAL_CREATED: 'goal_created',
  GOAL_PROGRESS_VIEWED: 'goal_progress_viewed',
  INSIGHT_VIEWED: 'insight_viewed',
  REPORT_VIEWED: 'report_viewed',
  REMINDER_ENABLED: 'reminder_enabled',
  EXPORT_REQUESTED: 'export_requested',
  DISCREET_MODE_ENABLED: 'discreet_mode_enabled',
  BRAND_CREATED: 'brand_created',
  BRAND_FAVORITED: 'brand_favorited',
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export interface EventPayloadMap {
  app_opened: { first_open?: boolean };
  onboarding_completed: { baseline_per_day?: number; goal_set?: boolean };
  cigarette_logged: {
    quantity: number;
    mode: string;
    has_price: boolean;
    price_source: string;
  };
  quick_add_used: Record<string, never>;
  repeat_last_used: Record<string, never>;
  log_edited: { log_id: string };
  log_deleted: { log_id: string };
  goal_created: { type: string };
  goal_progress_viewed: { goal_id: string };
  insight_viewed: { insight_id: string };
  report_viewed: { report: string };
  reminder_enabled: { kind: string };
  export_requested: { format: 'csv' | 'json' };
  discreet_mode_enabled: { enabled: boolean };
  brand_created: { brand_name: string };
  brand_favorited: { brand_id: string };
}
