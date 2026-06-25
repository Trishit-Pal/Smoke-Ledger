/*
 * Editorial visual primitives — the small, opinionated atoms the dashboard,
 * trends, history, and log pages share.
 *
 * Why a barrel: keeps the import surface small for callers (`import
 * { SectionLabel, MetricRow } from '@web/components/visual'`) and makes the
 * dependency graph explicit.
 */

export { SectionLabel, SectionDivider } from './SectionLabel';
export { MetricRow } from './MetricRow';
export type { SectionLabelTone, SectionLabelProps } from './SectionLabel';
export type { MetricRowProps, MetricRowTone } from './MetricRow';
export { InlineRule } from './InlineRule';
export type { InlineRuleProps } from './InlineRule';
export { ChoiceRun } from './ChoiceRun';
export type { ChoiceRunProps } from './ChoiceRun';
