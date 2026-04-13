/**
 * ReviewModal - IPL DRS System with Ultra Edge
 *
 * FLOW:
 *   1. ASKING     - Show what's being reviewed, confirm sending to DRS
 *   2. ANALYZING  - Animated ball-tracking + ultra-edge waveform
 *   3. RESULT     - DRS verdict with evidence breakdown including audio
 *   4. UMPIRE_CONFIRM - Umpire accepts/overrides DRS
 *
 * IPL DRS RULES (2024/25):
 *   - 2 unsuccessful reviews per team per innings (STRICT)
 *   - Review RETAINED on Umpire's Call (LBW only)
 *   - Ultra Edge: microphone audio used to detect bat involvement
 *   - Wide and height no-balls can be reviewed
 *   - Umpire makes final call after DRS
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

const PHASE = {
  ASKING:         'asking',
  ANALYZING:      'analyzing',
  RESULT:         'result',
  UMPIRE_CONFIRM: 'umpire_confirm',
};

function verdictColor(outcome) {
  switch (outcome) {
    case REVIEW_OUTCOMES.OVERTURNED:   return COLORS.primary;
    case REVIEW_OUTCOMES.UMPIRES_CALL: return COLORS.secondary;
    case REVIEW_OUTCOMES.FAILED:       return COLORS.danger;
    default:                           return COLORS.text_muted;
  }
}

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

// Simulated ultra-edge waveform bars
function UltraEdgeWaveform({ hasEdge, edgeConfidence = 0, isAnimating }) {
  const NUM_BARS = 28;
  const barAnims = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.1))
  ).current;

  useEffect(() => {
    if (!isAnimating) return;

    // Generate waveform pattern: spike at index 10-14 if edge detected
    const targetValues = Array.from({ length: NUM_BARS }, (_, i) => {
      const isEdgeZone = i >= 10 && i <= 14;
      if (hasEdge && isEdgeZone) {
        // Spike in the edge zone
        const distFromCenter = Math.abs(i - 12);
        return 0.6 + (1 - distFromCenter / 3) * edgeConfidence * 0.4;
      }
      // Random background noise
      return 0.05 + Math.random() * 0.15;
    });

    const animations = barAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: targetValues[i],
        duration: 300 + i * 20,
        useNativeDriver: false,
        easing: Easing.out(Easing.quad),
      })
    );

    Animated.parallel(animations).start();
  }, [isAnimating, hasEdge]);

  return (
    <View style={styles.waveformContainer}>
      <Text style={styles.waveformLabel}>ULTRA EDGE™</Text>
      <View style={styles.waveformBars}>
        {barAnims.map((anim, i) => {
          const isEdgeZone = hasEdge && i >= 10 && i <= 14;
          return (
            <Animated.View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, 40],
                  }),
                  backgroundColor: isEdgeZone ? COLORS.danger : COLORS.primary,
                  opacity: isEdgeZone ? 1 : 0.5,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.waveformTimeline}>
        <Text style={styles.waveformTimeLabel}>Bat</Text>
        <Text style={styles.waveformTimeLabel}>Release</Text>
        <Text style={styles.waveformTimeLabel}>Impact</Text>
        <Text style={styles.waveformTimeLabel}>Crease</Text>
      </View>
      {hasEdge && (
        <View style={styles.edgeAlert}>
          <Ionicons name="mic" size={12} color={COLORS.danger} />
          <Text style={styles.edgeAlertText}>
            EDGE DETECTED ({Math.round(edgeConfidence * 100)}% conf)
          </Text>
        </View>
      )}
      {!hasEdge && (
        <View style={[styles.edgeAlert, { backgroundColor: COLORS.primary_glow, borderColor: COLORS.primary }]}>
          <Ionicons name="mic-off" size={12} color={COLORS.primary} />
          <Text style={[styles.edgeAlertText, { color: COLORS.primary }]}>
            NO EDGE — Clean pad contact
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ReviewModal({
  visible,
  review,
  teamReviews,
  onResolve,
  onCancel,
}) {
  const [phase,  setPhase]  = useState(PHASE.ASKING);
  const [result, setResult] = useState(null);

  const scanAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const scanLoop   = useRef(null);
  const pulseLoop  = useRef(null);

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
    }, 3500); // slightly longer to show ultra-edge

    return () => {
      clearTimeout(timer);
      scanLoop.current?.stop();
      pulseLoop.current?.stop();
    };
  }, [phase]);

  // ── DRS Verdict Logic ──────────────────────────────────────────────────────
  const determineDRSVerdict = (rev) => {
    if (!rev) return { outcome: REVIEW_OUTCOMES.FAILED, label: 'Review Failed', reviewRetained: false, reason: 'No review data' };

    // ── LBW review — use actual ball-tracking + audio edge data ──
    if (rev.reviewType === 'lbw' && rev.lbwData) {
      const { possible, confidence, isUmpireCall, reason, batInvolved, edgeDetected, edgeConfidence } = rev.lbwData;

      // EDGE DETECTED = bat involved = NOT LBW
      if (batInvolved && edgeConfidence > 0.60) {
        return {
          outcome:         REVIEW_OUTCOMES.FAILED,
          label:           'NOT Out — Edge Detected!',
          reason:          `Ultra Edge confirms bat contact (${Math.round(edgeConfidence * 100)}% conf) — Not LBW`,
          reviewRetained:  false,
          confidence,
          edgeDetected:    true,
          edgeConfidence,
          evidence: [
            ...buildLBWEvidence(rev.lbwData),
            { label: 'Ultra Edge', value: `Edge detected (${Math.round(edgeConfidence * 100)}%)`, pass: false },
          ],
        };
      }

      if (isUmpireCall || (confidence >= 0.40 && confidence < 0.62)) {
        return {
          outcome:        REVIEW_OUTCOMES.UMPIRES_CALL,
          label:          "Umpire's Call",
          reason:         reason || 'Ball clipping stumps — original decision stands',
          reviewRetained: true,
          confidence,
          edgeDetected:   edgeDetected || false,
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
          edgeDetected:   edgeDetected || false,
          evidence: buildLBWEvidence(rev.lbwData),
        };
      }
      return {
        outcome:        REVIEW_OUTCOMES.FAILED,
        label:          'Not Out — Review Failed',
        reason:         reason || 'Ball tracking: not hitting stumps',
        reviewRetained: false,
        confidence,
        edgeDetected:   edgeDetected || false,
        evidence: buildLBWEvidence(rev.lbwData),
      };
    }

    // ── Height no-ball review ──
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
        };
      }
      return {
        outcome:        REVIEW_OUTCOMES.FAILED,
        label:          'Legal Delivery — Review Failed',
        reason:         'Ball height within legal limits',
        reviewRetained: false,
        heightLabel:    heightData?.ballHeightLabel,
      };
    }

    // ── Wicket review ──
    if (rev.reviewType === 'wicket') {
      // Check audio for edge (e.g., caught behind review)
      const audioData = rev.audioAnalysis;
      if (audioData?.edgeDetected && audioData.edgeConfidence > 0.65) {
        return {
          outcome:        REVIEW_OUTCOMES.OVERTURNED,
          label:          'OUT — Edge Confirmed!',
          reason:         `Ultra Edge: bat contact detected (${Math.round(audioData.edgeConfidence * 100)}% conf)`,
          reviewRetained: false,
          edgeDetected:   true,
          edgeConfidence: audioData.edgeConfidence,
        };
      }
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

    // ── Wide review ──
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
    const evid = [
      { label: 'Pitch Location', value: lbwData.pitchInLine ? 'In Line' : 'Outside Leg', pass: lbwData.pitchInLine },
      { label: 'Impact Location', value: lbwData.impactInLine ? 'In Line' : 'Outside Stumps', pass: lbwData.impactInLine },
      { label: 'Ball Tracking', value: lbwData.wouldHitStumps ? 'Hitting Stumps' : 'Missing Stumps', pass: lbwData.wouldHitStumps },
    ];
    if (lbwData.edgeDetected !== undefined) {
      evid.push({ label: 'Ultra Edge', value: lbwData.edgeDetected ? `Edge (${Math.round((lbwData.edgeConfidence || 0) * 100)}%)` : 'No Edge', pass: !lbwData.edgeDetected });
    }
    return evid;
  };

  const handleConfirmReview = () => setPhase(PHASE.ANALYZING);
  const handleProceedToUmpire = () => setPhase(PHASE.UMPIRE_CONFIRM);
  const handleUmpireAccept = () => { if (result) onResolve(result.outcome, review?.teamId, false); };
  const handleUmpireOverride = () => { if (result) onResolve(REVIEW_OUTCOMES.UPHELD, review?.teamId, true); };

  const reviewsRemaining = teamReviews?.remaining ?? 0;
  const isLBWReview = review?.reviewType === 'lbw';
  const hasEdgeData = review?.lbwData?.edgeDetected !== undefined || review?.audioAnalysis?.edgeDetected !== undefined;
  const edgeInData  = review?.lbwData?.edgeDetected || review?.audioAnalysis?.edgeDetected || false;
  const edgeConfInData = review?.lbwData?.edgeConfidence || review?.audioAnalysis?.edgeConfidence || 0;

  const reviewTypeLabel = {
    lbw:            'LBW Decision',
    wide:           'Wide Decision',
    wicket:         'Wicket Decision',
    no_ball_height: 'Height No-Ball',
    no_ball:        'No-Ball Decision',
  }[review?.reviewType] || 'Decision Under Review';

  const lbwEvidence = review?.lbwData ? buildLBWEvidence(review.lbwData) : [];
  const heightData  = review?.heightData;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* ── HEADER ── */}
          <LinearGradient colors={['#0d1427', '#1a1f3c']} style={styles.header}>
            <View>
              <Text style={styles.drsText}>DRS</Text>
              <Text style={styles.drsSubtext}>DECISION REVIEW SYSTEM · IPL 2024/25</Text>
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
              <Text style={[
                styles.reviewCountNum,
                reviewsRemaining === 0 && { color: COLORS.danger },
              ]}>
                {reviewsRemaining}/{CRICKET.REVIEWS_PER_TEAM}
              </Text>
            </View>
          </LinearGradient>

          {/* ── ASKING ── */}
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

              {/* Speed & height */}
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

              {/* Audio edge preview */}
              {hasEdgeData && isLBWReview && (
                <View style={[styles.rulesNote, { borderColor: COLORS.lbw, backgroundColor: COLORS.lbw_glow }]}>
                  <Ionicons name="mic" size={14} color={COLORS.lbw} />
                  <Text style={[styles.rulesNoteText, { color: COLORS.lbw }]}>
                    <Text style={styles.bold}>Ultra Edge: </Text>
                    {edgeInData
                      ? `Possible bat edge detected (${Math.round(edgeConfInData * 100)}% conf) — affects LBW decision`
                      : 'No bat edge detected — supports LBW appeal'}
                  </Text>
                </View>
              )}

              {/* IPL rules */}
              <View style={styles.rulesNote}>
                <Ionicons name="information-circle" size={14} color={COLORS.secondary} />
                <Text style={styles.rulesNoteText}>
                  <Text style={styles.bold}>IPL 2024/25: </Text>
                  {CRICKET.REVIEWS_PER_TEAM} reviews/innings. Review retained only on Umpire's Call (LBW). Ultra Edge used for bat contact.
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

          {/* ── ANALYZING ── */}
          {phase === PHASE.ANALYZING && (
            <ScrollView style={styles.body} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              <Text style={styles.analyzingTitle}>⚡ Third Umpire Reviewing…</Text>
              <Text style={styles.analyzingSubtitle}>
                {isLBWReview ? 'Checking pitch, impact, ball-tracking & Ultra Edge' : 'Processing third-umpire review'}
              </Text>

              {/* Ball tracking */}
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

              {/* Ultra Edge waveform (for LBW and wicket reviews) */}
              {(isLBWReview || review?.reviewType === 'wicket') && (
                <UltraEdgeWaveform
                  hasEdge={edgeInData}
                  edgeConfidence={edgeConfInData}
                  isAnimating={true}
                />
              )}

              {/* LBW evidence checklist */}
              {lbwEvidence.length > 0 && (
                <View style={styles.evidenceList}>
                  {lbwEvidence.map((ev, i) => <EvidenceRow key={i} {...ev} />)}
                </View>
              )}
            </ScrollView>
          )}

          {/* ── RESULT ── */}
          {phase === PHASE.RESULT && result && (
            <Animated.ScrollView
              style={[styles.body, { opacity: resultAnim }]}
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
            >
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
                {result.heightLabel && (
                  <View style={styles.heightResultRow}>
                    <Ionicons name="body" size={14} color={COLORS.secondary} />
                    <Text style={styles.heightResultText}>Ball at: {result.heightLabel}{result.heightCm ? ` (~${result.heightCm}cm)` : ''}</Text>
                  </View>
                )}
              </View>

              {/* Ultra Edge result */}
              {(isLBWReview || review?.reviewType === 'wicket') && (
                <UltraEdgeWaveform
                  hasEdge={result.edgeDetected || false}
                  edgeConfidence={result.edgeConfidence || 0}
                  isAnimating={false}
                />
              )}

              {/* LBW evidence */}
              {result.evidence?.length > 0 && (
                <View style={styles.evidenceList}>
                  {result.evidence.map((ev, i) => <EvidenceRow key={i} {...ev} />)}
                </View>
              )}

              {result.outcome === REVIEW_OUTCOMES.UMPIRES_CALL && (
                <View style={styles.ucNote}>
                  <Text style={styles.ucIcon}>⚡</Text>
                  <Text style={styles.ucText}>Umpire's Call: Original decision stands. Review retained per IPL rules (LBW only).</Text>
                </View>
              )}

              <TouchableOpacity onPress={handleProceedToUmpire} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.review, '#b8860b']} style={styles.proceedBtn}>
                  <Ionicons name="person" size={16} color="#000" />
                  <Text style={styles.proceedBtnText}>Proceed to Umpire Decision</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.ScrollView>
          )}

          {/* ── UMPIRE CONFIRM ── */}
          {phase === PHASE.UMPIRE_CONFIRM && result && (
            <ScrollView style={styles.body} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
              <View style={styles.umpireHeader}>
                <Text style={styles.umpireTitle}>🧑‍⚖️ Umpire's Decision</Text>
                <Text style={styles.umpireSubtitle}>
                  DRS suggests: <Text style={{ color: verdictColor(result.outcome), fontWeight: '800' }}>
                    {result.label}
                  </Text>
                </Text>
                <Text style={styles.umpireQuestion}>Accept DRS verdict or maintain original decision?</Text>
              </View>

              <View style={[styles.decisionBox, { marginBottom: 4 }]}>
                <Text style={styles.decisionLabel}>DRS VERDICT</Text>
                <Text style={[styles.decisionType, { color: verdictColor(result.outcome) }]}>{result.label}</Text>
                <Text style={[styles.resultReason, { marginTop: 4 }]}>{result.reason}</Text>
              </View>

              <View style={{ gap: 10 }}>
                <TouchableOpacity onPress={handleUmpireAccept} activeOpacity={0.85}>
                  <LinearGradient colors={[verdictColor(result.outcome), `${verdictColor(result.outcome)}aa`]} style={styles.acceptDRSBtn}>
                    <Ionicons name="checkmark-circle" size={20} color="#000" />
                    <Text style={styles.acceptDRSText}>Accept DRS Verdict</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.overrideBtn} onPress={handleUmpireOverride} activeOpacity={0.85}>
                  <Ionicons name="shield-checkmark" size={18} color={COLORS.secondary} />
                  <Text style={styles.overrideBtnText}>Override — Maintain Original Decision</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelReviewBtn} onPress={onCancel} activeOpacity={0.8}>
                  <Text style={styles.cancelReviewText}>Cancel Review</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reviewLostNote}>
                <Ionicons
                  name={result.reviewRetained ? 'checkmark-circle-outline' : 'information-circle-outline'}
                  size={13}
                  color={result.reviewRetained ? COLORS.primary : COLORS.text_muted}
                />
                <Text style={[styles.reviewLostText, result.reviewRetained && { color: COLORS.primary }]}>
                  {result.reviewRetained
                    ? 'Review retained on Umpire\'s Call (IPL LBW rule).'
                    : `1 review will be used. ${Math.max(0, reviewsRemaining - 1)} remaining.`}
                </Text>
              </View>
            </ScrollView>
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
    borderWidth: 1.5, borderColor: COLORS.review, maxHeight: '92%',
  },
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

  body:        { maxHeight: 480 },
  bodyContent: { gap: 12, padding: 16, paddingBottom: 4 },

  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  teamName:   { fontSize: 16, fontWeight: '800', color: COLORS.text_primary },
  reviewsTag: { fontSize: 11, color: COLORS.text_muted, fontStyle: 'italic' },

  decisionBox: {
    backgroundColor: COLORS.bg_elevated, borderRadius: 11, padding: 13,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 3,
  },
  decisionLabel: { fontSize: 10, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 1.5 },
  decisionType:  { fontSize: 18, fontWeight: '900', color: COLORS.review },

  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  speedText: { fontSize: 12, color: COLORS.speed, fontWeight: '700' },
  heightRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heightText: { fontSize: 12, color: COLORS.secondary, fontWeight: '600' },

  rulesNote: {
    flexDirection: 'row', gap: 7, alignItems: 'flex-start',
    backgroundColor: COLORS.secondary_glow, borderRadius: 9, padding: 10,
    borderWidth: 1, borderColor: COLORS.secondary,
    marginHorizontal: 16,
  },
  rulesNoteText: { flex: 1, fontSize: 10, color: COLORS.secondary, lineHeight: 15 },
  bold: { fontWeight: '800' },

  noReviewsWarn: {
    flexDirection: 'row', gap: 7, alignItems: 'center',
    backgroundColor: COLORS.danger_glow, borderRadius: 9, padding: 10,
    borderWidth: 1, borderColor: COLORS.danger, marginHorizontal: 16,
  },
  noReviewsText: { fontSize: 12, color: COLORS.danger, fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4, paddingHorizontal: 16 },
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

  analyzingTitle:    { fontSize: 18, fontWeight: '900', color: COLORS.text_primary, textAlign: 'center', paddingHorizontal: 16 },
  analyzingSubtitle: { fontSize: 11, color: COLORS.text_secondary, textAlign: 'center', paddingHorizontal: 16 },

  trackingContainer: {
    height: 130, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 11,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.review,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 16,
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

  // Ultra Edge
  waveformContainer: {
    backgroundColor: '#0a0f1e', borderRadius: 11, padding: 10,
    borderWidth: 1, borderColor: COLORS.lbw, marginHorizontal: 16,
  },
  waveformLabel: { fontSize: 8, color: COLORS.lbw, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  waveformBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 44 },
  waveformBar:  { flex: 1, borderRadius: 2, minHeight: 2 },
  waveformTimeline: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  waveformTimeLabel: { fontSize: 7, color: COLORS.text_muted, fontWeight: '600' },
  edgeAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    backgroundColor: COLORS.danger_glow, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.danger,
    alignSelf: 'flex-start',
  },
  edgeAlertText: { fontSize: 9, color: COLORS.danger, fontWeight: '800', letterSpacing: 0.5 },

  evidenceList: { gap: 6, paddingHorizontal: 16 },
  evidenceItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.bg_elevated, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border,
  },
  evidenceLabel: { fontSize: 12, color: COLORS.text_secondary, fontWeight: '600' },
  evidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  evidenceValue: { fontSize: 11, fontWeight: '800' },

  resultBanner: { borderRadius: 13, padding: 16, borderWidth: 1.5, alignItems: 'center', gap: 7, marginHorizontal: 16 },
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
    borderWidth: 1, borderColor: COLORS.secondary, marginHorizontal: 16,
  },
  ucIcon: { fontSize: 16 },
  ucText: { flex: 1, fontSize: 11, color: COLORS.secondary, lineHeight: 16, fontWeight: '600' },

  proceedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14, marginHorizontal: 16,
  },
  proceedBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },

  umpireHeader: { alignItems: 'center', gap: 5, paddingHorizontal: 16 },
  umpireTitle:    { fontSize: 20, fontWeight: '900', color: COLORS.text_primary },
  umpireSubtitle: { fontSize: 13, color: COLORS.text_secondary, textAlign: 'center' },
  umpireQuestion: { fontSize: 12, color: COLORS.text_muted, textAlign: 'center', lineHeight: 18, marginTop: 4 },

  acceptDRSBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 15, marginHorizontal: 16,
  },
  acceptDRSText: { fontSize: 15, fontWeight: '800', color: '#000' },
  overrideBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12, marginHorizontal: 16,
    borderWidth: 1.5, borderColor: COLORS.secondary, backgroundColor: COLORS.secondary_glow,
  },
  overrideBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  cancelReviewBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelReviewText: { fontSize: 12, color: COLORS.text_muted, fontWeight: '600' },
  reviewLostNote: {
    flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4,
  },
  reviewLostText: { fontSize: 10, color: COLORS.text_muted },
});
