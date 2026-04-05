import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Dimensions, Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, REVIEW_OUTCOMES, CRICKET } from '../../constants';

const { width, height } = Dimensions.get('window');

/**
 * DRS Review Modal - IPL Rules:
 * - Each team gets 2 reviews per innings
 * - Successful review: team KEEPS the review (review not lost)  
 *   Actually IPL Rule: review is LOST whether successful or not, 
 *   EXCEPT for Umpire's Call on LBW
 * - Umpire's Call on LBW: review is retained
 */
export default function ReviewModal({
  visible,
  review,           // { teamId, teamName, reviewType, lbwData }
  teamReviews,      // { remaining, used }
  onResolve,        // (outcome: REVIEW_OUTCOMES, reviewingTeamId) => void
  onCancel,
}) {
  const [phase, setPhase] = useState('asking'); // 'asking' | 'analyzing' | 'result'
  const [result, setResult] = useState(null);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setPhase('asking');
      setResult(null);
    }
  }, [visible]);

  useEffect(() => {
    if (phase === 'analyzing') {
      // Scan animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.linear }),
          Animated.timing(scanAnim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.linear }),
        ])
      ).start();

      // Pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // Auto-determine result after 3s (real detection from lbwData)
      const timer = setTimeout(() => {
        const analysisResult = determineReviewOutcome(review);
        setResult(analysisResult);
        setPhase('result');
        Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true }).start();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [phase]);

  const determineReviewOutcome = (rev) => {
    if (!rev) return { outcome: REVIEW_OUTCOMES.FAILED, label: 'Review Failed', color: COLORS.danger };

    if (rev.reviewType === 'lbw' && rev.lbwData) {
      const { possible, confidence, isUmpireCall, reason } = rev.lbwData;
      if (isUmpireCall || (confidence >= 0.40 && confidence < 0.60)) {
        return { outcome: REVIEW_OUTCOMES.UMPIRES_CALL, label: "Umpire's Call", color: COLORS.secondary, reason, reviewRetained: true };
      }
      if (possible && confidence >= 0.65) {
        return { outcome: REVIEW_OUTCOMES.OVERTURNED, label: 'OUT - LBW!', color: COLORS.lbw, reason };
      }
      return { outcome: REVIEW_OUTCOMES.FAILED, label: 'Not Out - Review Failed', color: COLORS.danger, reason };
    }

    if (rev.reviewType === 'wicket') {
      // For non-LBW wickets (caught, bowled etc.) - simulate
      const rand = Math.random();
      if (rand > 0.6) return { outcome: REVIEW_OUTCOMES.OVERTURNED, label: 'NOT OUT - Wicket Reversed!', color: COLORS.primary, reason: 'Ball tracking shows no contact with bat' };
      return { outcome: REVIEW_OUTCOMES.FAILED, label: 'OUT Stands - Review Failed', color: COLORS.danger, reason: 'Sufficient evidence to uphold original decision' };
    }

    if (rev.reviewType === 'wide') {
      const rand = Math.random();
      if (rand > 0.5) return { outcome: REVIEW_OUTCOMES.OVERTURNED, label: 'WIDE Reversed - NOT Wide', color: COLORS.primary, reason: 'Ball tracking shows within wide line' };
      return { outcome: REVIEW_OUTCOMES.FAILED, label: 'WIDE Stands - Review Failed', color: COLORS.danger, reason: 'Ball clearly outside wide line' };
    }

    return { outcome: REVIEW_OUTCOMES.FAILED, label: 'Review Failed', color: COLORS.danger };
  };

  const handleConfirmReview = () => {
    setPhase('analyzing');
  };

  const handleAcceptResult = () => {
    if (result) {
      onResolve(result.outcome, review?.teamId);
    }
  };

  const reviewsLeft = teamReviews?.remaining ?? 0;
  const reviewTypeLabel = review?.reviewType === 'lbw' ? 'LBW Decision' :
                          review?.reviewType === 'wide' ? 'Wide Decision' : 'Wicket Decision';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Header */}
          <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
            <View style={styles.drsLogo}>
              <Text style={styles.drsText}>DRS</Text>
              <Text style={styles.drsSubtext}>DECISION REVIEW</Text>
            </View>
            <View style={styles.reviewBadge}>
              <Text style={styles.reviewBadgeText}>{reviewsLeft} Review{reviewsLeft !== 1 ? 's' : ''} Left</Text>
            </View>
          </LinearGradient>

          {/* Phase: Asking */}
          {phase === 'asking' && (
            <View style={styles.body}>
              <View style={styles.teamRow}>
                <MaterialCommunityIcons name="shield" size={24} color={COLORS.review} />
                <Text style={styles.teamName}>{review?.teamName}</Text>
                <Text style={styles.reviewsTag}>requests review</Text>
              </View>

              <View style={styles.decisionBox}>
                <Text style={styles.decisionLabel}>DECISION UNDER REVIEW</Text>
                <Text style={styles.decisionType}>{reviewTypeLabel}</Text>
              </View>

              <View style={styles.iplNote}>
                <Ionicons name="information-circle" size={14} color={COLORS.secondary} />
                <Text style={styles.iplNoteText}>
                  IPL Rule: Review is lost after use.{'\n'}Exception: Umpire's Call on LBW retains review.
                </Text>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirmReview} disabled={reviewsLeft <= 0}>
                  <LinearGradient
                    colors={reviewsLeft > 0 ? [COLORS.review, '#b8860b'] : [COLORS.border, COLORS.border]}
                    style={styles.confirmBtn}
                  >
                    <MaterialCommunityIcons name="video-3d" size={18} color={reviewsLeft > 0 ? '#000' : COLORS.text_muted} />
                    <Text style={[styles.confirmBtnText, reviewsLeft <= 0 && { color: COLORS.text_muted }]}>
                      {reviewsLeft > 0 ? 'Confirm Review' : 'No Reviews Left'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Phase: Analyzing */}
          {phase === 'analyzing' && (
            <View style={styles.body}>
              <Text style={styles.analyzingTitle}>⚡ Analysing...</Text>
              <Text style={styles.analyzingSubtitle}>Checking ball trajectory & impact data</Text>

              {/* Scanning animation */}
              <View style={styles.scanContainer}>
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [{
                        translateY: scanAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 120],
                        }),
                      }],
                    },
                  ]}
                />
                <View style={styles.scanGrid}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View key={i} style={styles.scanGridRow} />
                  ))}
                </View>

                <Animated.View style={[styles.ballIcon, { transform: [{ scale: pulseAnim }] }]}>
                  <MaterialCommunityIcons name="cricket" size={40} color={COLORS.review} />
                </Animated.View>
              </View>

              {review?.reviewType === 'lbw' && review?.lbwData && (
                <View style={styles.lbwDetails}>
                  <Text style={styles.lbwDetailText}>
                    Pitch: {review.lbwData.pitchInLine ? '✅ In Line' : '❌ Outside leg'}
                  </Text>
                  <Text style={styles.lbwDetailText}>
                    Impact: {review.lbwData.impactInLine ? '✅ In Line' : '❌ Outside stumps'}
                  </Text>
                  <Text style={styles.lbwDetailText}>
                    Trajectory: {review.lbwData.wouldHitStumps ? '✅ Hitting stumps' : '❌ Missing stumps'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Phase: Result */}
          {phase === 'result' && result && (
            <Animated.View style={[styles.body, { opacity: resultAnim, transform: [{ scale: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
              <View style={[styles.resultBanner, { borderColor: result.color, backgroundColor: `${result.color}20` }]}>
                <Text style={[styles.resultLabel, { color: result.color }]}>{result.label}</Text>
                {result.reviewRetained && (
                  <View style={styles.retainedBadge}>
                    <Text style={styles.retainedText}>✓ Review Retained (Umpire's Call)</Text>
                  </View>
                )}
                {result.reason && (
                  <Text style={styles.resultReason}>{result.reason}</Text>
                )}
              </View>

              {result.outcome === REVIEW_OUTCOMES.UMPIRES_CALL && (
                <View style={styles.umpiresCallNote}>
                  <Text style={styles.umpiresCallIcon}>⚡</Text>
                  <Text style={styles.umpiresCallText}>
                    Umpire's Call - Original decision stands.{'\n'}Review retained as per IPL rules.
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={handleAcceptResult}>
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
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.bg_card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.review,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    paddingHorizontal: 22,
  },
  drsLogo: {},
  drsText: { fontSize: 26, fontWeight: '900', color: COLORS.review, letterSpacing: 4 },
  drsSubtext: { fontSize: 9, color: COLORS.secondary, letterSpacing: 2, fontWeight: '700' },
  reviewBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.review,
  },
  reviewBadgeText: { color: COLORS.review, fontSize: 12, fontWeight: '800' },
  body: { padding: 22, gap: 16 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamName: { fontSize: 18, fontWeight: '800', color: COLORS.text_primary },
  reviewsTag: { fontSize: 12, color: COLORS.text_muted, fontStyle: 'italic' },
  decisionBox: {
    backgroundColor: COLORS.bg_elevated,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  decisionLabel: { fontSize: 10, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 1.5 },
  decisionType: { fontSize: 20, fontWeight: '900', color: COLORS.review },
  iplNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.secondary_glow,
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  iplNoteText: { flex: 1, fontSize: 11, color: COLORS.secondary, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.text_muted, fontWeight: '700' },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  confirmBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  analyzingTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text_primary, textAlign: 'center' },
  analyzingSubtitle: { fontSize: 13, color: COLORS.text_secondary, textAlign: 'center' },
  scanContainer: {
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.review,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.review,
    shadowColor: COLORS.review,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  scanGrid: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'space-evenly' },
  scanGridRow: { height: 1, backgroundColor: 'rgba(255,215,0,0.1)' },
  ballIcon: { zIndex: 10 },
  lbwDetails: { gap: 6 },
  lbwDetailText: { fontSize: 13, color: COLORS.text_secondary, fontWeight: '600' },
  resultBanner: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
  },
  resultLabel: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  retainedBadge: {
    backgroundColor: COLORS.primary_glow,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retainedText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  resultReason: { fontSize: 12, color: COLORS.text_secondary, textAlign: 'center', lineHeight: 18 },
  umpiresCallNote: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.secondary_glow,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  umpiresCallIcon: { fontSize: 20 },
  umpiresCallText: { flex: 1, fontSize: 12, color: COLORS.secondary, lineHeight: 18, fontWeight: '600' },
  acceptBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
