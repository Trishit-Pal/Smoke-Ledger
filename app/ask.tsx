import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Divider } from '@/components/ui/Divider';
import { AskTurn, type AskTurnData } from '@/components/ask/AskTurn';
import { ConsentNotice } from '@/components/ask/ConsentNotice';
import { spacing, fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { CHAT_QUESTION_MAX, type ChatStateResponse } from '@/domain/ledgerChat/types';
import { ASK_COPY, FAILURE_COPY } from '@/lib/askView';
import { isLedgerChatEnabled } from '@/lib/askPill';
import { track } from '@/services/analytics';
import { AnalyticsEvents } from '@/constants/events';
import {
  askLedger,
  getChatState,
  historyFor,
  setLedgerChatOptIn,
  type ChatFailure,
} from '@/services/ledgerChat';

const MIN_TARGET = 44;

/** Reasons that stop the screen outright; the rest only fail one question. */
const BLOCKING: ReadonlySet<ChatFailure> = new Set(['disabled', 'signed_out', 'consent_outdated']);

/**
 * Ask the ledger: a modal page of the journal. State is read on open; the
 * transcript lives in component state only, so leaving the screen clears it and
 * nothing is written to the device. Figures are masked at render when totals
 * are hidden, tap to reveal.
 */
export default function AskScreen() {
  const theme = useTheme();
  const router = useRouter();
  const mounted = useRef(true);

  const [state, setState] = useState<ChatStateResponse | null>(null);
  // Flag off: nothing is requested and the screen says it is resting.
  const enabled = isLedgerChatEnabled();
  const [loadingState, setLoadingState] = useState(enabled);
  const [turns, setTurns] = useState<AskTurnData[]>([]);
  const turnsRef = useRef<AskTurnData[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<ChatFailure | null>(enabled ? null : 'disabled');
  const [turningOn, setTurningOn] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadState = useCallback(() => {
    void getChatState().then((result) => {
      if (!mounted.current) return;
      if (result.ok) setState(result.data);
      else setFailure(result.reason);
      setLoadingState(false);
    });
  }, []);

  // The one read on open. The loading flag starts true, so nothing is set here.
  useEffect(() => {
    if (enabled) loadState();
  }, [enabled, loadState]);

  const retryState = () => {
    setLoadingState(true);
    setFailure(null);
    loadState();
  };

  const send = useCallback(async (question: string, starter = false) => {
    const q = question.trim();
    if (!q) return;
    setPending(q);
    setFailure(null);
    const result = await askLedger(q, historyFor(turnsRef.current));
    if (!mounted.current) return;
    setPending(null);
    if (!result.ok) {
      setFailure(result.reason);
      if (result.reason === 'consent_required') setState((prev) => (prev ? { ...prev, consented: false } : prev));
      return;
    }
    const next: AskTurnData[] = [
      ...turnsRef.current,
      { id: `${Date.now().toString(36)}-${turnsRef.current.length}`, question: q, answer: result.data.answer, rows: result.data.rows },
    ];
    turnsRef.current = next;
    setTurns(next);
    setDraft('');
    void track(AnalyticsEvents.LEDGER_CHAT_ASKED, { starter, tools: result.data.toolsUsed.length });
  }, []);

  const turnOnAndAsk = async () => {
    setTurningOn(true);
    setFailure(null);
    try {
      await setLedgerChatOptIn(true);
    } catch {
      if (mounted.current) {
        setFailure('unavailable');
        setTurningOn(false);
      }
      return;
    }
    if (!mounted.current) return;
    setTurningOn(false);
    setState((prev) => (prev ? { ...prev, consented: true } : prev));
    // Starters need the ledger read, which only happens once opted in.
    void getChatState().then((r) => {
      if (mounted.current && r.ok) setState(r.data);
    });
    if (draft.trim()) void send(draft);
  };

  const busy = pending !== null;
  const blocked = failure !== null && BLOCKING.has(failure);
  const needsConsent = state !== null && !state.consented && !blocked;
  const canAsk = state?.consented === true && !blocked;
  const hidden = state ? state.hideTotals : true;
  const starters = state?.starters ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="h1" accessibilityRole="header">
              {ASK_COPY.title}
            </Text>
            <Text variant="small" muted style={{ maxWidth: 320 }}>
              {ASK_COPY.deck}
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close Ask the ledger"
            style={{ minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="small" style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}>
              Close
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {loadingState ? (
            <View accessibilityRole="progressbar" accessibilityLabel={ASK_COPY.loading} style={{ gap: spacing.sm }}>
              <ActivityIndicator color={theme.accent} />
              <Text variant="small" muted style={{ fontStyle: 'italic' }}>
                {ASK_COPY.loading}
              </Text>
            </View>
          ) : null}

          {needsConsent ? (
            <View style={{ gap: spacing.md }}>
              <Divider strong />
              <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1.8 }}>
                {ASK_COPY.consentTitle}
              </Text>
              <ConsentNotice />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
                <Button title="Turn on and ask" onPress={() => void turnOnAndAsk()} loading={turningOn} />
                <Button title="Not now" variant="ghost" onPress={() => router.back()} disabled={turningOn} />
              </View>
            </View>
          ) : null}

          {canAsk && turns.length === 0 && !busy ? (
            starters.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Divider strong />
                <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1.8, paddingTop: spacing.sm }}>
                  To begin
                </Text>
                {starters.map((text) => (
                  <Pressable
                    key={text}
                    onPress={() => void send(text, true)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ask: ${text}`}
                    style={{ minHeight: MIN_TARGET, justifyContent: 'center' }}
                  >
                    <Text variant="body" style={{ textDecorationLine: 'underline', textDecorationColor: theme.ruleStrong }}>
                      {text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text variant="small" muted>
                {ASK_COPY.empty}
              </Text>
            )
          ) : null}

          {turns.map((turn) => (
            <AskTurn key={turn.id} turn={turn} hidden={hidden} currency={state?.currency ?? 'INR'} locale={state?.locale} />
          ))}

          <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm }}>
            {busy ? (
              <>
                <Text variant="h3" style={{ fontFamily: fonts.displaySoft, fontStyle: 'italic', fontWeight: '400' }}>
                  {pending}
                </Text>
                <Text variant="small" muted style={{ fontStyle: 'italic' }} accessibilityRole="progressbar">
                  {ASK_COPY.loading}
                </Text>
              </>
            ) : null}
            {failure && failure !== 'consent_required' ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="small" muted>
                  {FAILURE_COPY[failure]}
                </Text>
                {failure === 'consent_outdated' ? (
                  <Button title="Review agreements" variant="secondary" onPress={() => router.push('/consent')} />
                ) : null}
                {state === null && (failure === 'network' || failure === 'unavailable') ? (
                  <Button title="Try again" variant="secondary" onPress={retryState} />
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {canAsk ? (
          <View style={{ gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: theme.rule }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <Input
                containerStyle={{ flex: 1 }}
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask your ledger…"
                maxLength={CHAT_QUESTION_MAX}
                editable={!busy}
                returnKeyType="send"
                onSubmitEditing={() => void send(draft)}
                accessibilityLabel="Ask your ledger"
              />
              <Button title="Ask" onPress={() => void send(draft)} disabled={busy || draft.trim().length === 0} />
            </View>
            <Text variant="caption" muted style={{ fontStyle: 'italic' }}>
              {ASK_COPY.footnote}
            </Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
