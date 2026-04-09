import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CRICKET, BALL_OUTCOMES } from '../../constants';

/**
 * ReviewBar — shows DRS review availability + last ball speed/height info.
 *
 * IPL 2024 reviewable decisions:
 *  - Wicket (caught, bowled, etc.)
 *  - LBW
 *  - Wide
 *  - Height No-Ball (full toss above waist / bouncer above shoulder)
 */
export default function ReviewBar({
  reviews,
  battingTeamId,
  bowlingTeamId,
  teams,
  onRequestReview,
  lastBall,
  lastAnalysis,
  disabled,
}) {
  const battingTeam = teams?.team1?.id === battingTeamId ? teams.team1 : teams.team2;
  const bowlingTeam = teams?.team1?.id === bowlingTeamId ? teams.team1 : teams.team2;

  const battingReviews = reviews?.[battingTeamId];
  const bowlingReviews = reviews?.[bowlingTeamId];

  const outcome = lastBall?.outcome;

  // What can each team review?
  const isWicket   = outcome === BALL_OUTCOMES.WICKET || outcome === BALL_OUTCOMES.LBW;
  const isWide     = outcome === BALL_OUTCOMES.WIDE;
  const isNoBall   = outcome === BALL_OUTCOMES.NO_BALL;
  const isLBW      = outcome === BALL_OUTCOMES.LBW;

  // Batting team: can review wicket (to overturn), wide (to confirm not out), no-ball
  const canBattingReview = (isWicket || isNoBall) && (battingReviews?.remaining || 0) > 0;
  const battingReviewType = isLBW ? 'lbw' : isNoBall ? 'no_ball_height' : 'wicket';

  // Bowling team: can review wide (to overturn), LBW (to confirm out)
  const canBowlingReview = (isWide || isLBW || isWicket) && (bowlingReviews?.remaining || 0) > 0;
  const bowlingReviewType = isLBW ? 'lbw' : isWide ? 'wide' : 'wicket';

  const speedKmh      = lastAnalysis?.speedKmh;
  const heightLabel   = lastAnalysis?.ballHeightLabel;
  const heightCm      = lastAnalysis?.ballHeightCm;
  const isNoBallDetect = lastAnalysis?.noBallHeightDetected || lastAnalysis?.noBallBounceDetected;

  return (
    <View style={styles.wrapper}>
      {/* Speed & height info bar */}
      {(speedKmh > 0 || heightLabel) && (
        <View style={styles.infoBar}>
          {speedKmh > 0 && (
            <View style={styles.infoItem}>
              <Ionicons name="speedometer" size={11} color={COLORS.speed} />
              <Text style={[styles.infoText, { color: COLORS.speed }]}>{speedKmh} km/h</Text>
            </View>
          )}
          {heightLabel && (
            <View style={styles.infoItem}>
              <Ionicons name="body" size={11} color={isNoBallDetect ? COLORS.danger : COLORS.secondary} />
              <Text style={[styles.infoText, { color: isNoBallDetect ? COLORS.danger : COLORS.secondary }]}>
                {heightLabel}{heightCm ? ` (${heightCm}cm)` : ''}
                {isNoBallDetect ? ' 🚨' : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Review dots */}
      <View style={styles.container}>
        {/* Batting team */}
        <TouchableOpacity
          style={[styles.teamBlock, canBattingReview && !disabled && styles.teamBlockActive]}
          onPress={() => canBattingReview && !disabled && onRequestReview(battingTeamId, battingTeam?.name, battingReviewType)}
          disabled={!canBattingReview || disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.teamLabel} numberOfLines={1}>🏏 {battingTeam?.name}</Text>
          <View style={styles.reviewDots}>
            {Array.from({ length: CRICKET.REVIEWS_PER_TEAM }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < (battingReviews?.remaining || 0) ? styles.dotActive : styles.dotUsed]}
              />
            ))}
          </View>
          {canBattingReview && !disabled && (
            <Text style={styles.reviewHint}>
              {isNoBall ? 'Review No-Ball Height' : 'Review Wicket'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Bowling team */}
        <TouchableOpacity
          style={[styles.teamBlock, canBowlingReview && !disabled && styles.teamBlockActive]}
          onPress={() => canBowlingReview && !disabled && onRequestReview(bowlingTeamId, bowlingTeam?.name, bowlingReviewType)}
          disabled={!canBowlingReview || disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.teamLabel} numberOfLines={1}>⚡ {bowlingTeam?.name}</Text>
          <View style={styles.reviewDots}>
            {Array.from({ length: CRICKET.REVIEWS_PER_TEAM }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < (bowlingReviews?.remaining || 0) ? styles.dotActive : styles.dotUsed]}
              />
            ))}
          </View>
          {canBowlingReview && !disabled && (
            <Text style={styles.reviewHint}>
              {isLBW ? 'Review LBW' : isWide ? 'Review Wide' : 'Review Wicket'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 12, marginVertical: 3 },

  infoBar: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: COLORS.bg_card, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 3,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 11, fontWeight: '700' },

  container: {
    flexDirection: 'row', backgroundColor: COLORS.bg_card,
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  teamBlock: { flex: 1, padding: 7, alignItems: 'center', gap: 3 },
  teamBlockActive: { backgroundColor: COLORS.review_glow },
  teamLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text_secondary, letterSpacing: 0.5 },
  reviewDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotActive: { backgroundColor: COLORS.review },
  dotUsed:   { backgroundColor: COLORS.border, opacity: 0.4 },
  reviewHint: { fontSize: 9, color: COLORS.review, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  divider: { width: 1, backgroundColor: COLORS.border },
});
