/**
 * ReviewModal - IPL DRS System
 *
 * FLOW:
 *   1. ASKING   - Show what's being reviewed, confirm sending to DRS
 *   2. ANALYZING - Animated ball-tracking visualization (3 seconds)
 *   3. RESULT    - Show DRS verdict with evidence breakdown
 *   4. UMPIRE_CONFIRM - Ask umpire to confirm/override the DRS verdict
 *
 * IPL DRS RULES:
 *   - 2 unsuccessful reviews per team per innings
 *   - Review RETAINED on Umpire's Call (LBW only)
 *   - Wide and height no-balls can be reviewed (IPL 2024)
 *   - Umpire makes final call after DRS suggests verdict
 */

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Dimensions, Easing, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, REVIEW_OUTCOMES, CRICKET } from '../../constants';

const { width } = Dimensions.get('window');

// ─── Phase constants ─────────────────────────────────────────────────────────
const PHASE = {
  ASKING:          'asking',
  ANALYZING:       'analyzing',
  RESULT:          'result',
  UMPIRE_CONFIRM:  'umpire_confirm',
};

// ─── Verdict severity color ───────────────────────────────────────────────────
function verdictColor(outcome) {
  switch (outcome) {
    case REVIEW_OUTCOMES.OVERTURNED:   return COLORS.primary;
    case REVIEW_OUTCOMES.UMPIRES_CALL: return COLORS.secondary;
    case REVIEW_OUTCOMES.FAILED:       return COLORS.danger;
    default:                           return COLORS.text_muted;
  }
}

// ─── Small evidence row ───────────────────────────────────────────────────────
function EvidenceRow({ label, value, pass }) {
  return (
    <View style={styles.evidenceItem}>
      <Text style={styles.evidenceLabel}>{label}</Text>
      <View style={[styles.evidenceBadge, { backgroundColor: pass ? 'rgba(0,230,118,0.15)' : 'rgba(255,23,68,0.15)' }]}>
        <Ionicons
          name={pass ? 'checkmark-circle' : 'close-circle'}
          size={12}
          color={pass ? COLORS.primary : COLORS.danger}
        />
        <Text style={[styles.evidenceValue, { color: pass ? COLORS.primary : COLORS.danger }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function ReviewModal({
  visible,
  review,       // { teamId, teamName, reviewType, lbwData, originalOutcome, heightData? }
  teamReviews,  // { remaining, used, history }
  onResolve,    // (outcome, reviewingTeamId, umpireOverride?) => void
  onCancel,
}) {
  const [phase,  setPhase]  = useState(PHASE.ASKING);
  const [result, setResult] = useState(null);

  const scanAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const scanLoop   = useRef(null);
  const pulseLoop  = useRef(null);

  // ── Reset on show/hide ──
  useEffect(() => {
    if (visible) {
      setPhase(PHASE.ASKING);
      setResult(null);
      resultAnim.setValue(0);
    } else {
      scanLoop.current?.stop();
      pulseLoop.current?.stop();
    }
  }, [visible]);

  // ── Start / stop analysis animation ──
  useEffect(() => {
    if (phase !== PHASE.ANALYZING) return;

    scanAnim.setValue(0);
    pulseAnim.setValue(1);

    scanLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 850, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(scanAnim, { toValue: 0, duration: 850, useNativeDriver: true, easing: Easing.linear }),
      ]),
    );
    scanLoop.current.start();

    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ]),
    );
    pulseLoop.current.start();

    const timer = setTimeout(() => {
      scanLoop.current?.stop();
      pulseLoop.current?.stop();
      const analysisResult = determineDRSVerdict(review);
      setResult(analysisResult);
      setPhase(PHASE.RESULT);
      Animated.spring(resultAnim, {
        toValue: 1, useNativeDriver: true, tension: 60, friction: 8,
      }).start();
    }, 3000);

    return () => {
      clearTimeout(timer);
      scanLoop.current?.stop();
      pulseLoop.current?.stop();
    };
  }, [phase]);

  // ── DRS Verdict Logic ────────────────────────────────────────────────────────
  const determineDRSVerdict = (rev) => {
    if (!rev) return { outcome: REVIEW_OUTCOMES.FAILED, label: 'Review Failed', reviewRetained: false, reason: 'No review data' };

    // LBW review — use actual ball-tracking data
    if (rev.reviewType === 'lbw' && rev.lbwData) {
      const { possible, confidence, isUmpireCall, reason } = rev.lbwData;
      if (isUmpireCall || (confidence >= 0.40 && confidence < 0.62)) {
        return {
          outcome:        REVIEW_OUTCOMES.UMPIRES_CALL,
          label:          "Umpire's Call",
          reason:         reason || 'Ball clipping stumps — original decision stands',
          reviewRetained: true,   // IPL: LBW umpire's call retains review
          confidence,
          evidence: buildLBWEvidence(rev.lbwData),
        };
      }
      if (possible && confidence >= 0.62) {
        return {
          outcome:        REVIEW_OUTCOMES.OVERTURNED,
          label:          'OUT — LBW!',
          reason:         reason || 'Ball tracking confirms LBW — Wicket stands',
          reviewRetained: false,
          confidence,
          evidence: buildLBWEvidence(rev.lbwData),
        };
      }
      return {
        outcome:        REVIEW_OUTCOMES.FAILED,
        label:          'Not Out — Review Failed',
        reason:         reason || 'Ball tracking: not hitting stumps — Review lost',
        reviewRetained: false,
        confidence,
        evidence: buildLBWEvidence(rev.lbwData),
      };
    }

    // Height no-ball review
    if (rev.reviewType === 'no_ball_height' || rev.reviewType === 'no_ball') {
      const heightData = rev.heightData;
      if (heightData?.noBallHeightDetected || heightData?.noBallBounceDetected) {
        return {
          outcome:        REVIEW_OUTCOMES.OVERTURNED,
          label:          'NO BALL Confirmed!',
          reason:         heightData.noBallReason || 'Ball tracking confirms illegal height',
          reviewRetained: false,
          heightLabel:    heightData.ballHeightLabel,
          heightCm:       heightData.ballHeightCm,
          heightPercent:  heightData.ballHeightPercent,
        };
      }
      return {
        outcome:        REVIEW_OUTCOMES.FAILED,
        label:          'Legal Delivery — Review Failed',
        reason:         'Ball height within legal limits',
        reviewRetained: false,
        heightLabel:    heightData?.ballHeightLabel,
        heightCm:       heightData?.ballHeightCm,
      };
    }

    // Wicket review (caught, bowled etc.)
    if (rev.reviewType === 'wicket') {
      const rand = Math.random();
      if (rand > 0.58) {
        return {
          outcome: REVIEW_OUTCOMES.OVERTURNED, label: 'NOT OUT — Wicket Reversed!',
          reason: 'Third umpire: Insufficient evidence to uphold wicket', reviewRetained: false,
        };
      }
      return {
        outcome: REVIEW_OUTCOMES.FAILED, label: 'OUT Stands — Review Failed',
        reason: 'Third umpire: Sufficient evidence confirms wicket', reviewRetained: false,
      };
    }

    // Wide review
    if (rev.reviewType === 'wide') {
      const rand = Math.random();
      if (rand > 0.52) {
        return {
          outcome: REVIEW_OUTCOMES.OVERTURNED, label: 'NOT Wide — Wide Reversed!',
          reason: 'Ball tracking: delivery within wide guideline', reviewRetained: false,
        };
      }
      return {
        outcome: REVIEW_OUTCOMES.FAILED, label: 'Wide Confirmed — Review Failed',
        reason: 'Ball tracking: delivery outside wide line', reviewRetained: false,
      };
    }

    return { outcome: REVIEW_OUTCOMES.FAILED, label: 'Review Failed', reviewRetained: false, reason: 'Unable to determine outcome' };
  };

  const buildLBWEvidence = (lbwData) => {
    if (!lbwData) return [];
    return [
      { label: 'Pitch Location', value: lbwData.pitchInLine ? 'In Line' : 'Outside Leg', pass: lbwData.pitchInLine },
      { label: 'Impact Location', value: lbwData.impactInLine ? 'In Line' : 'Outside Stumps', pass: lbwData.impactInLine },
      { label: 'Ball Tracking', value: lbwData.wouldHitStumps ? 'Hitting Stumps' : 'Missing Stumps', pass: lbwData.wouldHitStumps },
    ];
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleConfirmReview = () => setPhase(PHASE.ANALYZING);

  // DRS verdict shown → proceed to umpire confirmation step
  const handleProceedToUmpire = () => setPhase(PHASE.UMPIRE_CONFIRM);

  // Umpire accepts DRS suggestion
  const handleUmpireAccept = () => {
    if (result) onResolve(result.outcome, review?.teamId, false);
  };

  // Umpire overrides DRS (sticks with original decision)
  const handleUmpireOverride = () => {
    if (result) onResolve(REVIEW_OUTCOMES.UPHELD, review?.teamId, true);
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const reviewsRemaining = teamReviews?.remaining ?? 0;

  const reviewTypeLabel = {
    lbw:            'LBW Decision',
    wide:           'Wide Decision',
    wicket:         'Wicket Decision',
    no_ball_height: 'Height No-Ball',
    no_ball:        'No-Ball Decision',
  }[review?.reviewType] || 'Decision Under Review';

  const lbwEvidence = review?.lbwData ? buildLBWEvidence(review.lbwData) : [];

  // Speed and height display
  const heightData = review?.heightData;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* ── HEADER ── */}
          <LinearGradient colors={['#0d1427', '#1a1f3c']} style={styles.header}>
            <View>
              <Text style={styles.drsText}>DRS</Text>
              <Text style={styles.drsSubtext}>DECISION REVIEW SYSTEM · IPL RULES</Text>
            </View>
            <View style={styles.reviewCountWrap}>
              <Text style={styles.reviewCountLabel}>REVIEWS LEFT</Text>
              <View style={styles.reviewDots}>
                {Array.from({ length: CRICKET.REVIEWS_PER_TEAM }).map((_, i) => (
                  <View key={i} style={[
                    styles.reviewDot,
                    i < reviewsRemaining ? styles.reviewDotActive : styles.reviewDotUsed,
                  ]} />
                ))}
              </View>
              <Text style={styles.reviewCountNum}>{reviewsRemaining}/{CRICKET.REVIEWS_PER_TEAM}</Text>
            </View>
          </LinearGradient>

          {/* ── PHASE: ASKING ── */}
          {phase === PHASE.ASKING && (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <View style={styles.teamRow}>
                <MaterialCommunityIcons name="shield" size={20} color={COLORS.review} />
                <Text style={styles.teamName}>{review?.teamName}</Text>
                <Text style={styles.reviewsTag}>requests DRS review</Text>
              </View>

              <View style={styles.decisionBox}>
                <Text style={styles.decisionLabel}>UNDER REVIEW</Text>
                <Text style={styles.decisionType}>{reviewTypeLabel}</Text>
              </View>

              {/* Speed & height info if available */}
              {heightData?.speedKmh > 0 && (
                <View style={styles.speedRow}>
                  <Ionicons name="speedometer" size={14} color={COLORS.speed} />
                  <Text style={styles.speedText}>Ball speed: {heightData.speedKmh} km/h</Text>
                </View>
              )}
              {heightData?.ballHeightLabel && (
                <View style={styles.heightRow}>
                  <Ionicons name="body" size={14} color={COLORS.secondary} />
                  <Text style={styles.heightText}>
                    Ball height: {heightData.ballHeightLabel}
                    {heightData.ballHeightCm ? ` (~${heightData.ballHeightCm} cm)` : ''}
                  </Text>
                </View>
              )}

              {/* IPL rules reminder */}
              <View style={styles.rulesNote}>
                <Ionicons name="information-circle" size={14} color={COLORS.secondary} />
                <Text style={styles.rulesNoteText}>
                  <Text style={styles.bold}>IPL 2024/25: </Text>
                  {CRICKET.REVIEWS_PER_TEAM} reviews/innings. Review retained only on Umpire's Call (LBW). Wide & height no-balls can also be reviewed.
                </Text>
              </View>

              {reviewsRemaining <= 0 && (
                <View style={styles.noReviewsWarn}>
                  <Ionicons name="warning" size={14} color={COLORS.danger} />
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
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={reviewsRemaining > 0 ? [COLORS.review, '#b8860b'] : [COLORS.border, COLORS.border]}
                    style={styles.confirmBtn}
                  >
                    <MaterialCommunityIcons name="video-3d" size={16} color={reviewsRemaining > 0 ? '#000' : COLORS.text_muted} />
                    <Text style={[styles.confirmBtnText, reviewsRemaining <= 0 && { color: COLORS.text_muted }]}>
                      {reviewsRemaining > 0 ? 'Send to Third Umpire' : 'No Reviews Left'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── PHASE: ANALYZING ── */}
          {phase === PHASE.ANALYZING && (
            <View style={styles.body}>
              <Text style={styles.analyzingTitle}>⚡ Third Umpire Reviewing…</Text>
              <Text style={styles.analyzingSubtitle}>
                {review?.reviewType === 'lbw'
                  ? 'Checking pitch, impact & ball-tracking projection'
                  : review?.reviewType?.includes('no_ball')
                    ? 'Checking ball height against batsman height'
                    : 'Processing third-umpire review'}
              </Text>

              {/* Ball-tracking visualization */}
              <View style={styles.trackingContainer}>
                <View style={styles.trackingGrid}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={styles.trackingGridLine} />
                  ))}
                </View>
                <Animated.View style={[styles.scanLine, {
                  transform: [{ translateY: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 110] }) }],
                }]} />
                <View style={styles.stumpViz}>
                  <View style={styles.stump} /><View style={styles.stump} /><View style={styles.stump} />
                </View>
                <Animated.View style={[styles.ballIconWrap, { transform: [{ scale: pulseAnim }] }]}>
                  <MaterialCommunityIcons name="cricket" size={34} color={COLORS.review} />
                </Animated.View>
                <View style={styles.trackingLabel}>
                  <Text style={styles.trackingLabelText}>BALL TRACKING</Text>
                </View>
              </View>

              {/* LBW evidence checklist */}
              {lbwEvidence.length > 0 && (
                <View style={styles.evidenceList}>
                  {lbwEvidence.map((ev, i) => <EvidenceRow key={i} {...ev} />)}
                </View>
              )}
            </View>
          )}

          {/* ── PHASE: RESULT ── */}
          {phase === PHASE.RESULT && result && (
            <Animated.View style={[styles.body, {
              opacity: resultAnim,
              transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
            }]}>

              <View style={[styles.resultBanner, {
                borderColor: verdictColor(result.outcome),
                backgroundColor: `${verdictColor(result.outcome)}18`,
              }]}>
                <Text style={styles.drsVerdictLabel}>DRS SUGGESTS</Text>
                <Text style={[styles.resultLabel, { color: verdictColor(result.outcome) }]}>
                  {result.label}
                </Text>
                {result.reviewRetained && (
                  <View style={styles.retainedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                    <Text style={styles.retainedText}>Review Retained (Umpire's Call)</Text>
                  </View>
                )}
                {result.reason && <Text style={styles.resultReason}>{result.reason}</Text>}

                {/* Height display */}
                {result.heightLabel && (
                  <View style={styles.heightResultRow}>
                    <Ionicons name="body" size={14} color={COLORS.secondary} />
                    <Text style={styles.heightResultText}>
                      Ball at: {result.heightLabel}
                      {result.heightCm ? ` (~${result.heightCm} cm above ground)` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* LBW evidence if available */}
              {result.evidence?.length > 0 && (
                <View style={styles.evidenceList}>
                  {result.evidence.map((ev, i) => <EvidenceRow key={i} {...ev} />)}
                </View>
              )}

              {/* Umpire's call note */}
              {result.outcome === REVIEW_OUTCOMES.UMPIRES_CALL && (
                <View style={styles.ucNote}>
                  <Text style={styles.ucIcon}>⚡</Text>
                  <Text style={styles.ucText}>
                    Umpire's Call: Original decision stands. Review retained per IPL rules (LBW only).
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={handleProceedToUmpire} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.review, '#b8860b']} style={styles.proceedBtn}>
                  <Ionicons name="person" size={16} color="#000" />
                  <Text style={styles.proceedBtnText}>Proceed to Umpire Decision</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── PHASE: UMPIRE CONFIRM ── */}
          {phase === PHASE.UMPIRE_CONFIRM && result && (
            <View style={styles.body}>
              <View style={styles.umpireHeader}>
                <Text style={styles.umpireTitle}>🧑‍⚖️ Umpire's Decision</Text>
                <Text style={styles.umpireSubtitle}>
                  DRS suggests: <Text style={{ color: verdictColor(result.outcome), fontWeight: '800' }}>
                    {result.label}
                  </Text>
                </Text>
                <Text style={styles.umpireQuestion}>
                  Do you accept the DRS verdict or maintain your original decision?
                </Text>
              </View>

              {/* Quick recap */}
              <View style={[styles.decisionBox, { marginBottom: 16 }]}>
                <Text style={styles.decisionLabel}>DRS VERDICT</Text>
                <Text style={[styles.decisionType, { color: verdictColor(result.outcome) }]}>
                  {result.label}
                </Text>
                <Text style={[styles.resultReason, { marginTop: 4 }]}>{result.reason}</Text>
              </View>

              <View style={styles.umpireBtnStack}>
                {/* Accept DRS */}
                <TouchableOpacity onPress={handleUmpireAccept} activeOpacity={0.85}>
                  <LinearGradient colors={[verdictColor(result.outcome), `${verdictColor(result.outcome)}aa`]} style={styles.acceptDRSBtn}>
                    <Ionicons name="checkmark-circle" size={20} color="#000" />
                    <Text style={styles.acceptDRSText}>Accept DRS Verdict</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Override (stick with original) */}
                <TouchableOpacity style={styles.overrideBtn} onPress={handleUmpireOverride} activeOpacity={0.85}>
                  <Ionicons name="shield-checkmark" size={18} color={COLORS.secondary} />
                  <Text style={styles.overrideBtnText}>Override — Maintain Original Decision</Text>
                </TouchableOpacity>

                {/* Cancel review entirely */}
                <TouchableOpacity style={styles.cancelReviewBtn} onPress={onCancel} activeOpacity={0.8}>
                  <Text style={styles.cancelReviewText}>Cancel Review</Text>
                </TouchableOpacity>
              </View>

              {!result.reviewRetained && (
                <View style={styles.reviewLostNote}>
                  <Ionicons name="information-circle-outline" size={13} color={COLORS.text_muted} />
                  <Text style={styles.reviewLostText}>
                    1 review will be used regardless of verdict.
                    {Math.max(0, reviewsRemaining - 1)} remaining.
                  </Text>
                </View>
              )}
              {result.reviewRetained && (
                <View style={styles.reviewLostNote}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.primary} />
                  <Text style={[styles.reviewLostText, { color: COLORS.primary }]}>
                    Review retained on Umpire's Call (IPL LBW rule).
                  </Text>
                </View>
              )}
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center', alignItems: 'center', padding: 14,
  },
  card: {
    width: '100%', backgroundColor: COLORS.bg_card,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1.5, borderColor: COLORS.review, maxHeight: '90%',
  },

  // ── HEADER ──
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingHorizontal: 18 },
  drsText:    { fontSize: 26, fontWeight: '900', color: COLORS.review, letterSpacing: 5 },
  drsSubtext: { fontSize: 7, color: COLORS.secondary, letterSpacing: 1.5, fontWeight: '700' },
  reviewCountWrap: { alignItems: 'flex-end', gap: 4 },
  reviewCountLabel: { fontSize: 8, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 1 },
  reviewDots: { flexDirection: 'row', gap: 5 },
  reviewDot: { width: 11, height: 11, borderRadius: 6 },
  reviewDotActive: { backgroundColor: COLORS.review },
  reviewDotUsed:   { backgroundColor: COLORS.border, opacity: 0.4 },
  reviewCountNum:  { fontSize: 10, color: COLORS.secondary, fontWeight: '700' },

  // ── BODY ──
  body:        { padding: 16 },
  bodyContent: { gap: 12, paddingBottom: 4 },

  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  teamName:   { fontSize: 16, fontWeight: '800', color: COLORS.text_primary },
  reviewsTag: { fontSize: 11, color: COLORS.text_muted, fontStyle: 'italic' },

  decisionBox: {
    backgroundColor: COLORS.bg_elevated, borderRadius: 11, padding: 13,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 3,
  },
  decisionLabel: { fontSize: 10, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 1.5 },
  decisionType:  { fontSize: 18, fontWeight: '900', color: COLORS.review },

  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  speedText: { fontSize: 12, color: COLORS.speed, fontWeight: '700' },

  heightRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  heightText: { fontSize: 12, color: COLORS.secondary, fontWeight: '600' },

  rulesNote: {
    flexDirection: 'row', gap: 7, alignItems: 'flex-start',
    backgroundColor: COLORS.secondary_glow, borderRadius: 9, padding: 10,
    borderWidth: 1, borderColor: COLORS.secondary,
  },
  rulesNoteText: { flex: 1, fontSize: 10, color: COLORS.secondary, lineHeight: 15 },
  bold: { fontWeight: '800' },

  noReviewsWarn: {
    flexDirection: 'row', gap: 7, alignItems: 'center',
    backgroundColor: COLORS.danger_glow, borderRadius: 9, padding: 10,
    borderWidth: 1, borderColor: COLORS.danger,
  },
  noReviewsText: { fontSize: 12, color: COLORS.danger, fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 11,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.text_muted, fontWeight: '700', fontSize: 13 },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 11,
  },
  confirmBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },

  // ── ANALYZING ──
  analyzingTitle:    { fontSize: 18, fontWeight: '900', color: COLORS.text_primary, textAlign: 'center', marginBottom: 3 },
  analyzingSubtitle: { fontSize: 11, color: COLORS.text_secondary, textAlign: 'center', marginBottom: 12 },
  trackingContainer: {
    height: 130, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 11,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.review,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  trackingGrid: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'space-evenly' },
  trackingGridLine: { height: 1, backgroundColor: 'rgba(255,215,0,0.07)' },
  scanLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: COLORS.review,
    shadowColor: COLORS.review, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 5,
  },
  stumpViz: { position: 'absolute', bottom: 8, flexDirection: 'row', gap: 5, alignItems: 'flex-end' },
  stump: { width: 4, height: 28, backgroundColor: '#c8a84b', borderRadius: 2 },
  ballIconWrap: { zIndex: 10, marginBottom: 10 },
  trackingLabel: {
    position: 'absolute', top: 6, left: 7,
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.review,
  },
  trackingLabelText: { fontSize: 7, color: COLORS.review, fontWeight: '800', letterSpacing: 1 },

  evidenceList: { gap: 7, marginBottom: 6 },
  evidenceItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bg_elevated, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border,
  },
  evidenceLabel: { fontSize: 12, color: COLORS.text_secondary, fontWeight: '600' },
  evidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  evidenceValue: { fontSize: 11, fontWeight: '800' },

  // ── RESULT ──
  resultBanner: { borderRadius: 13, padding: 16, borderWidth: 1.5, alignItems: 'center', gap: 7, marginBottom: 10 },
  drsVerdictLabel: { fontSize: 9, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 2 },
  resultLabel: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  retainedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary_glow, borderRadius: 18,
    paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.primary,
  },
  retainedText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  resultReason: { fontSize: 11, color: COLORS.text_secondary, textAlign: 'center', lineHeight: 17 },
  heightResultRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  heightResultText: { fontSize: 11, color: COLORS.secondary, fontWeight: '600' },

  ucNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.secondary_glow, borderRadius: 9, padding: 11,
    borderWidth: 1, borderColor: COLORS.secondary, marginBottom: 10,
  },
  ucIcon: { fontSize: 16 },
  ucText: { flex: 1, fontSize: 11, color: COLORS.secondary, lineHeight: 16, fontWeight: '600' },

  proceedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14,
  },
  proceedBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },

  // ── UMPIRE CONFIRM ──
  umpireHeader: { alignItems: 'center', gap: 5, marginBottom: 14 },
  umpireTitle:    { fontSize: 20, fontWeight: '900', color: COLORS.text_primary },
  umpireSubtitle: { fontSize: 13, color: COLORS.text_secondary, textAlign: 'center' },
  umpireQuestion: { fontSize: 12, color: COLORS.text_muted, textAlign: 'center', lineHeight: 18, marginTop: 4 },

  umpireBtnStack: { gap: 10 },
  acceptDRSBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 15,
  },
  acceptDRSText: { fontSize: 15, fontWeight: '800', color: '#000' },

  overrideBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary_glow,
  },
  overrideBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },

  cancelReviewBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelReviewText: { fontSize: 12, color: COLORS.text_muted, fontWeight: '600' },

  reviewLostNote: {
    flexDirection: 'row', gap: 7, alignItems: 'center',
    paddingHorizontal: 4, marginTop: 10,
  },
  reviewLostText: { fontSize: 10, color: COLORS.text_muted },
});
