import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
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
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { CHAT_QUESTION_MAX, type ChatStateResponse } from '@/domain/ledgerChat/types';
import {
  answerAnnouncement,
  ASK_COPY,
  FAILURE_COPY,
  isHidden,
  leaveTarget,
  takeWaitingQuestion,
  waitingTakenAfter,
} from '@/lib/askView';
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
  const reduceMotion = useReduceMotion();
  const mounted = useRef(true);
  const scrollRef = useRef<ScrollView>(null);
  const wantsEnd = useRef(false);
  const sheetRef = useRef<View>(null);
  // KeyboardAvoidingView measures against its parent, not the screen; the page
  // sheet's own top offset is the gap, so it is measured rather than guessed.
  const [sheetTop, setSheetTop] = useState(0);

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
  // The question typed before opting in is sent once, right after the opt-in is saved.
  const waitingTaken = useRef(false);
  // send() is memoised once; it reads the latest masking from here.
  const hiddenRef = useRef(true);

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
      waitingTaken.current = waitingTakenAfter(waitingTaken.current, result.reason);
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
    // iOS has no live regions: speak the answer, masked exactly as it is drawn.
    void AccessibilityInfo.announceForAccessibility(answerAnnouncement(result.data.answer, hiddenRef.current));
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
    const waiting = takeWaitingQuestion(draft, waitingTaken.current);
    if (waiting) {
      waitingTaken.current = true;
      void send(waiting);
    }
  };

  const busy = pending !== null;
  const blocked = failure !== null && BLOCKING.has(failure);
  const needsConsent = state !== null && !state.consented && !blocked;
  const canAsk = state?.consented === true && !blocked;
  const hidden = isHidden(state);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);
  // New content (an answer, or the pending question) brings the end into view.
  useEffect(() => {
    wantsEnd.current = true;
  }, [turns.length, pending]);
  const leave = () => {
    if (leaveTarget(router.canGoBack()) === 'back') router.back();
    else router.replace('/(tabs)');
  };
  const starters = state?.starters ?? [];

  return (
    <SafeAreaView
      ref={sheetRef}
      onLayout={() => sheetRef.current?.measureInWindow((_x, y) => setSheetTop(y))}
      style={{ flex: 1, backgroundColor: theme.bg }}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {/* 'height' on Android: edge-to-edge no longer resizes the window (as log/new and goals/new). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={sheetTop}>
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
            onPress={leave}
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
          ref={scrollRef}
          onContentSizeChange={() => {
            if (!wantsEnd.current) return;
            wantsEnd.current = false;
            scrollRef.current?.scrollToEnd({ animated: !reduceMotion });
          }}
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
                <Button title="Not now" variant="ghost" onPress={leave} disabled={turningOn} />
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
                  <Button title="Review agreements" variant="secondary" onPress={() => router.replace('/consent')} />
                ) : null}
                {state === null && (failure === 'network' || failure === 'unavailable') ? (
                  <Button title="Try again" variant="secondary" onPress={retryState} />
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {canAsk || needsConsent ? (
          <View style={{ gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: theme.rule }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <Input
                containerStyle={{ flex: 1 }}
                value={draft}
                onChangeText={setDraft}
                placeholder="Ask your ledger…"
                maxLength={CHAT_QUESTION_MAX}
                editable={!busy && !turningOn}
                returnKeyType="send"
                onSubmitEditing={() => canAsk && void send(draft)}
                accessibilityLabel="Ask your ledger"
              />
              <Button title="Ask" onPress={() => void send(draft)} disabled={!canAsk || busy || draft.trim().length === 0} />
            </View>
            <Text variant="caption" muted style={{ fontStyle: 'italic' }}>
              {needsConsent ? ASK_COPY.waiting : ASK_COPY.footnote}
            </Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
