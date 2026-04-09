import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Dimensions, Easing, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, REVIEW_OUTCOMES, CRICKET } from '../../constants';

const { width } = Dimensions.get('window');

/**
 * DRS Review Modal
 *
 * IPL Review Rules:
 *  - Each team gets CRICKET.REVIEWS_PER_TEAM (2) reviews per innings
 *  - Over 2 innings, each team can use up to 4 total reviews
 *  - Reviews are reset at the start of each innings
 *  - Review is LOST whether successful or not — EXCEPT for Umpire's Call on LBW
 *  - Umpire's Call on LBW: review is retained (IPL specific rule)
 *
 * The "blank video" issue: the review modal does NOT show a video replay.
 * The replay is a separate feature (replay.jsx). Here we show an animated
 * ball-tracking analysis visualization instead.
 */
export default function ReviewModal({
  visible,
  review,        // { teamId, teamName, reviewType, lbwData, originalOutcome }
  teamReviews,   // { remaining, used, history }
  onResolve,     // (outcome: REVIEW_OUTCOMES, reviewingTeamId) => void
  onCancel,
}) {
  const [phase, setPhase]   = useState('asking');  // 'asking' | 'analyzing' | 'result'
  const [result, setResult] = useState(null);

  const scanAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const scanLoop   = useRef(null);
  const pulseLoop  = useRef(null);

  useEffect(() => {
    if (visible) {
      setPhase('asking');
      setResult(null);
      resultAnim.setValue(0);
    } else {
      // Stop all animations when hidden
      scanLoop.current?.stop();
      pulseLoop.current?.stop();
    }
  }, [visible]);

  useEffect(() => {
    if (phase === 'analyzing') {
      scanAnim.setValue(0);
      pulseAnim.setValue(1);

      scanLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.linear }),
          Animated.timing(scanAnim, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.linear }),
        ]),
      );
      scanLoop.current.start();

      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 550, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 550, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();

      const timer = setTimeout(() => {
        scanLoop.current?.stop();
        pulseLoop.current?.stop();
        const analysisResult = determineReviewOutcome(review);
        setResult(analysisResult);
        setPhase('result');
        Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
      }, 3200);

      return () => {
        clearTimeout(timer);
        scanLoop.current?.stop();
        pulseLoop.current?.stop();
      };
    }
  }, [phase]);

  // ── Review outcome logic ────────────────────────────────────────────────────
  const determineReviewOutcome = (rev) => {
    if (!rev) {
      return {
        outcome: REVIEW_OUTCOMES.FAILED,
        label: 'Review Failed',
        color: COLORS.danger,
        reviewRetained: false,
        reason: 'No review data available',
      };
    }

    // LBW review: use actual ball-tracking data from lbwData
    if (rev.reviewType === 'lbw' && rev.lbwData) {
      const { possible, confidence, isUmpireCall, reason } = rev.lbwData;

      if (isUmpireCall || (confidence >= 0.40 && confidence < 0.62)) {
        return {
          outcome: REVIEW_OUTCOMES.UMPIRES_CALL,
          label: "Umpire's Call",
          color: COLORS.secondary,
          reason: reason || "Marginal decision — ball clipping stumps",
          reviewRetained: true,  // IPL rule: LBW umpire's call retains review
        };
      }
      if (possible && confidence >= 0.62) {
        return {
          outcome: REVIEW_OUTCOMES.OVERTURNED,
          label: 'OUT — LBW!',
          color: COLORS.lbw,
          reason: reason || 'Ball tracking confirms LBW — Wicket stands',
          reviewRetained: false,
        };
      }
      return {
        outcome: REVIEW_OUTCOMES.FAILED,
        label: 'Not Out — Review Failed',
        color: COLORS.danger,
        reason: reason || 'Ball tracking shows no LBW — Review lost',
        reviewRetained: false,
      };
    }

    // Wicket review (caught, bowled, etc.)
    if (rev.reviewType === 'wicket') {
      const rand = Math.random();
      if (rand > 0.58) {
        return {
          outcome: REVIEW_OUTCOMES.OVERTURNED,
          label: 'NOT OUT — Wicket Reversed!',
          color: COLORS.primary,
          reason: 'Insufficient evidence to uphold the wicket decision',
          reviewRetained: false,
        };
      }
      return {
        outcome: REVIEW_OUTCOMES.FAILED,
        label: 'OUT Stands — Review Failed',
        color: COLORS.danger,
        reason: 'Third umpire confirms sufficient evidence for wicket',
        reviewRetained: false,
      };
    }

    // Wide review
    if (rev.reviewType === 'wide') {
      const rand = Math.random();
      if (rand > 0.52) {
        return {
          outcome: REVIEW_OUTCOMES.OVERTURNED,
          label: 'NOT Wide — Wide Reversed!',
          color: COLORS.primary,
          reason: 'Ball tracking confirms delivery was within wide line',
          reviewRetained: false,
        };
      }
      return {
        outcome: REVIEW_OUTCOMES.FAILED,
        label: 'Wide Stands — Review Failed',
        color: COLORS.danger,
        reason: 'Ball tracking confirms delivery outside wide guideline',
        reviewRetained: false,
      };
    }

    return {
      outcome: REVIEW_OUTCOMES.FAILED,
      label: 'Review Failed',
      color: COLORS.danger,
      reviewRetained: false,
      reason: 'Unable to determine outcome',
    };
  };

  const handleConfirmReview = () => setPhase('analyzing');

  const handleAcceptResult = () => {
    if (result) onResolve(result.outcome, review?.teamId);
  };

  const reviewsRemaining = teamReviews?.remaining ?? 0;
  const reviewsUsed      = teamReviews?.used ?? 0;

  const reviewTypeLabel = {
    lbw:    'LBW Decision',
    wide:   'Wide Decision',
    wicket: 'Wicket Decision',
  }[review?.reviewType] || 'Decision Under Review';

  // LBW evidence items for display during analysis
  const lbwEvidence = review?.lbwData ? [
    {
      label: 'Pitch Location',
      value: review.lbwData.pitchInLine      ? 'In Line ✅'         : 'Outside Leg ❌',
      pass:  review.lbwData.pitchInLine,
    },
    {
      label: 'Impact Location',
      value: review.lbwData.impactInLine     ? 'In Line ✅'         : 'Outside Stumps ❌',
      pass:  review.lbwData.impactInLine,
    },
    {
      label: 'Ball Tracking',
      value: review.lbwData.wouldHitStumps   ? 'Hitting Stumps ✅'  : 'Missing Stumps ❌',
      pass:  review.lbwData.wouldHitStumps,
    },
  ] : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* ── HEADER ── */}
          <LinearGradient colors={['#0d1427', '#1a1f3c']} style={styles.header}>
            <View>
              <Text style={styles.drsText}>DRS</Text>
              <Text style={styles.drsSubtext}>DECISION REVIEW SYSTEM</Text>
            </View>
            {/* Reviews remaining indicator */}
            <View style={styles.reviewCountWrap}>
              <Text style={styles.reviewCountLabel}>REVIEWS LEFT</Text>
              <View style={styles.reviewDots}>
                {Array.from({ length: CRICKET.REVIEWS_PER_TEAM }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.reviewDot,
                      i < reviewsRemaining ? styles.reviewDotActive : styles.reviewDotUsed,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.reviewCountNum}>
                {reviewsRemaining}/{CRICKET.REVIEWS_PER_TEAM} this innings
              </Text>
            </View>
          </LinearGradient>

          {/* ── PHASE: ASKING ── */}
          {phase === 'asking' && (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {/* Team requesting */}
              <View style={styles.teamRow}>
                <MaterialCommunityIcons name="shield" size={22} color={COLORS.review} />
                <Text style={styles.teamName}>{review?.teamName}</Text>
                <Text style={styles.reviewsTag}>requests review</Text>
              </View>

              {/* Decision box */}
              <View style={styles.decisionBox}>
                <Text style={styles.decisionLabel}>DECISION UNDER REVIEW</Text>
                <Text style={styles.decisionType}>{reviewTypeLabel}</Text>
              </View>

              {/* IPL rules note */}
              <View style={styles.rulesNote}>
                <Ionicons name="information-circle" size={15} color={COLORS.secondary} />
                <Text style={styles.rulesNoteText}>
                  <Text style={styles.bold}>IPL Rules: </Text>
                  Each team gets {CRICKET.REVIEWS_PER_TEAM} reviews per innings ({CRICKET.REVIEWS_PER_TEAM * 2} total across both innings).{'\n'}
                  Review is lost after use — except Umpire's Call on LBW.
                </Text>
              </View>

              {/* Warning if no reviews left */}
              {reviewsRemaining <= 0 && (
                <View style={styles.noReviewsWarn}>
                  <Ionicons name="warning" size={16} color={COLORS.danger} />
                  <Text style={styles.noReviewsText}>No reviews remaining this innings!</Text>
                </View>
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmReview}
                  disabled={reviewsRemaining <= 0}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      reviewsRemaining > 0
                        ? [COLORS.review, '#b8860b']
                        : [COLORS.border, COLORS.border]
                    }
                    style={styles.confirmBtn}
                  >
                    <MaterialCommunityIcons
                      name="video-3d"
                      size={18}
                      color={reviewsRemaining > 0 ? '#000' : COLORS.text_muted}
                    />
                    <Text style={[styles.confirmBtnText, reviewsRemaining <= 0 && { color: COLORS.text_muted }]}>
                      {reviewsRemaining > 0 ? 'Send to DRS' : 'No Reviews Left'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── PHASE: ANALYZING ── */}
          {phase === 'analyzing' && (
            <View style={styles.body}>
              <Text style={styles.analyzingTitle}>⚡ Analysing Ball Data…</Text>
              <Text style={styles.analyzingSubtitle}>
                {review?.reviewType === 'lbw'
                  ? 'Checking pitch point, impact & trajectory projection'
                  : 'Processing third-umpire review'}
              </Text>

              {/* Ball-tracking animation (NOT a video — it's a visualization) */}
              <View style={styles.trackingContainer}>
                {/* Grid lines */}
                <View style={styles.trackingGrid}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={styles.trackingGridLine} />
                  ))}
                </View>

                {/* Animated scan line */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [{
                        translateY: scanAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 110],
                        }),
                      }],
                    },
                  ]}
                />

                {/* Stump visualization */}
                <View style={styles.stumpViz}>
                  <View style={styles.stump} />
                  <View style={styles.stump} />
                  <View style={styles.stump} />
                </View>

                {/* Animated ball icon */}
                <Animated.View
                  style={[styles.ballIconWrap, { transform: [{ scale: pulseAnim }] }]}
                >
                  <MaterialCommunityIcons name="cricket" size={36} color={COLORS.review} />
                </Animated.View>

                {/* DRS label */}
                <View style={styles.trackingLabel}>
                  <Text style={styles.trackingLabelText}>BALL TRACKING</Text>
                </View>
              </View>

              {/* LBW evidence checklist (if LBW review) */}
              {lbwEvidence.length > 0 && (
                <View style={styles.evidenceList}>
                  {lbwEvidence.map((ev, i) => (
                    <View key={i} style={styles.evidenceItem}>
                      <Text style={styles.evidenceLabel}>{ev.label}</Text>
                      <Text style={[styles.evidenceValue, { color: ev.pass ? COLORS.primary : COLORS.danger }]}>
                        {ev.value}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── PHASE: RESULT ── */}
          {phase === 'result' && result && (
            <Animated.View
              style={[
                styles.body,
                {
                  opacity: resultAnim,
                  transform: [{
                    scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }),
                  }],
                },
              ]}
            >
              {/* Result banner */}
              <View
                style={[
                  styles.resultBanner,
                  { borderColor: result.color, backgroundColor: `${result.color}18` },
                ]}
              >
                <Text style={[styles.resultLabel, { color: result.color }]}>
                  {result.label}
                </Text>

                {result.reviewRetained && (
                  <View style={styles.retainedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                    <Text style={styles.retainedText}>Review Retained (Umpire's Call)</Text>
                  </View>
                )}

                {result.reason && (
                  <Text style={styles.resultReason}>{result.reason}</Text>
                )}
              </View>

              {/* Umpire's Call explanation */}
              {result.outcome === REVIEW_OUTCOMES.UMPIRES_CALL && (
                <View style={styles.ucNote}>
                  <Text style={styles.ucIcon}>⚡</Text>
                  <Text style={styles.ucText}>
                    Umpire's Call: Original decision stands. Review retained as per IPL rules (LBW only).
                  </Text>
                </View>
              )}

              {/* Review cost reminder */}
              {!result.reviewRetained && (
                <View style={styles.reviewLostNote}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.text_muted} />
                  <Text style={styles.reviewLostText}>
                    1 review used. {Math.max(0, reviewsRemaining - 1)} remaining this innings.
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={handleAcceptResult} activeOpacity={0.85}>
                <LinearGradient
                  colors={[result.color, `${result.color}99`]}
                  style={styles.acceptBtn}
                >
                  <Text style={styles.acceptBtnText}>Accept Decision</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.bg_card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.review,
    maxHeight: '88%',
  },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingHorizontal: 20,
  },
  drsText:    { fontSize: 28, fontWeight: '900', color: COLORS.review, letterSpacing: 5 },
  drsSubtext: { fontSize: 8,  color: COLORS.secondary, letterSpacing: 2, fontWeight: '700' },
  reviewCountWrap: { alignItems: 'flex-end', gap: 4 },
  reviewCountLabel: { fontSize: 8, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 1 },
  reviewDots: { flexDirection: 'row', gap: 6 },
  reviewDot: { width: 12, height: 12, borderRadius: 6 },
  reviewDotActive: { backgroundColor: COLORS.review },
  reviewDotUsed:   { backgroundColor: COLORS.border, opacity: 0.45 },
  reviewCountNum:  { fontSize: 10, color: COLORS.secondary, fontWeight: '700' },

  // ── BODY ──
  body:        { padding: 18 },
  bodyContent: { gap: 14, paddingBottom: 4 },

  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName:   { fontSize: 17, fontWeight: '800', color: COLORS.text_primary },
  reviewsTag: { fontSize: 11, color: COLORS.text_muted, fontStyle: 'italic' },

  decisionBox: {
    backgroundColor: COLORS.bg_elevated, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  decisionLabel: { fontSize: 10, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 1.5 },
  decisionType:  { fontSize: 20, fontWeight: '900', color: COLORS.review },

  rulesNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.secondary_glow, borderRadius: 10, padding: 11,
    borderWidth: 1, borderColor: COLORS.secondary,
  },
  rulesNoteText: { flex: 1, fontSize: 11, color: COLORS.secondary, lineHeight: 16 },
  bold:          { fontWeight: '800' },

  noReviewsWarn: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: COLORS.danger_glow, borderRadius: 10, padding: 11,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  noReviewsText: { fontSize: 12, color: COLORS.danger, fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.text_muted, fontWeight: '700' },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
  },
  confirmBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },

  // ── ANALYZING ──
  analyzingTitle:    { fontSize: 20, fontWeight: '900', color: COLORS.text_primary, textAlign: 'center', marginBottom: 4 },
  analyzingSubtitle: { fontSize: 12, color: COLORS.text_secondary, textAlign: 'center', marginBottom: 14 },

  trackingContainer: {
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.review,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  trackingGrid: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'space-evenly' },
  trackingGridLine: { height: 1, backgroundColor: 'rgba(255,215,0,0.08)' },
  scanLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: COLORS.review,
    shadowColor: COLORS.review, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 6,
  },
  stumpViz: {
    position: 'absolute', bottom: 10,
    flexDirection: 'row', gap: 6, alignItems: 'flex-end',
  },
  stump: {
    width: 4, height: 32, backgroundColor: '#c8a84b', borderRadius: 2,
  },
  ballIconWrap: { zIndex: 10, marginBottom: 12 },
  trackingLabel: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.review,
  },
  trackingLabelText: { fontSize: 8, color: COLORS.review, fontWeight: '800', letterSpacing: 1 },

  evidenceList: { gap: 8 },
  evidenceItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bg_elevated, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  evidenceLabel: { fontSize: 13, color: COLORS.text_secondary, fontWeight: '600' },
  evidenceValue: { fontSize: 13, fontWeight: '800' },

  // ── RESULT ──
  resultBanner: {
    borderRadius: 14, padding: 18, borderWidth: 2,
    alignItems: 'center', gap: 8, marginBottom: 12,
  },
  resultLabel: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  retainedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary_glow, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  retainedText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  resultReason: { fontSize: 12, color: COLORS.text_secondary, textAlign: 'center', lineHeight: 18 },

  ucNote: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.secondary_glow, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: COLORS.secondary, marginBottom: 12,
  },
  ucIcon: { fontSize: 18 },
  ucText: { flex: 1, fontSize: 12, color: COLORS.secondary, lineHeight: 17, fontWeight: '600' },

  reviewLostNote: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: 4, marginBottom: 12,
  },
  reviewLostText: { fontSize: 11, color: COLORS.text_muted },

  acceptBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  acceptBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
