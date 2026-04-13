import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CRICKET, BALL_OUTCOMES } from '../../constants';

/**
 * ReviewBar — DRS review availability display.
 *
 * IPL Rules (strict):
 *  - Each team gets EXACTLY 2 reviews per innings
 *  - Reviews remaining shown as dots (filled = available, empty = used)
 *  - When 0 remain, team cannot request review
 *  - Review retained ONLY on Umpire's Call (LBW)
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

  const battingReviews = reviews?.[battingTeamId] || { remaining: 0, used: 0 };
  const bowlingReviews = reviews?.[bowlingTeamId] || { remaining: 0, used: 0 };

  const outcome = lastBall?.outcome;

  // What can each team review on this ball?
  const isWicket = outcome === BALL_OUTCOMES.WICKET || outcome === BALL_OUTCOMES.LBW;
  const isWide   = outcome === BALL_OUTCOMES.WIDE;
  const isNoBall = outcome === BALL_OUTCOMES.NO_BALL;
  const isLBW    = outcome === BALL_OUTCOMES.LBW;

  // Batting team: can review wicket (to overturn), no-ball (height)
  const canBattingReview = (isWicket || isNoBall) && battingReviews.remaining > 0;
  const battingReviewType = isLBW ? 'lbw' : isNoBall ? 'no_ball_height' : 'wicket';

  // Bowling team: can review wide (to overturn), LBW (to confirm out)
  const canBowlingReview = (isWide || isLBW || isWicket) && bowlingReviews.remaining > 0;
  const bowlingReviewType = isLBW ? 'lbw' : isWide ? 'wide' : 'wicket';

  const speedKmh       = lastAnalysis?.speedKmh;
  const heightLabel    = lastAnalysis?.ballHeightLabel;
  const heightCm       = lastAnalysis?.ballHeightCm;
  const isNoBallDetect = lastAnalysis?.noBallHeightDetected || lastAnalysis?.noBallBounceDetected;
  const edgeDetected   = lastAnalysis?.edgeDetected;

  const renderDots = (remaining, total = CRICKET.REVIEWS_PER_TEAM) => (
    <View style={styles.reviewDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < remaining ? styles.dotActive : styles.dotUsed,
          ]}
        />
      ))}
    </View>
  );

  const TeamBlock = ({ teamName, teamReviews, canReview, reviewType, teamId, isbatting }) => {
    const hasNoReviews = teamReviews.remaining <= 0;
    const isClickable  = canReview && !disabled && !hasNoReviews;

    return (
      <TouchableOpacity
        style={[
          styles.teamBlock,
          isClickable && styles.teamBlockActive,
          hasNoReviews && styles.teamBlockExhausted,
        ]}
        onPress={() => isClickable && onRequestReview(teamId, teamName, reviewType)}
        disabled={!isClickable}
        activeOpacity={0.7}
      >
        <Text style={styles.teamLabel} numberOfLines={1}>
          {isbatting ? '🏏' : '⚡'} {teamName}
        </Text>

        {renderDots(teamReviews.remaining)}

        <Text style={[
          styles.reviewCount,
          hasNoReviews ? styles.reviewCountZero : styles.reviewCountNormal,
        ]}>
          {hasNoReviews ? 'No reviews left' : `${teamReviews.remaining}/${CRICKET.REVIEWS_PER_TEAM} remaining`}
        </Text>

        {isClickable && (
          <Text style={styles.reviewHint}>
            {reviewType === 'lbw'            ? 'Review LBW'
              : reviewType === 'no_ball_height' ? 'Review No-Ball'
              : reviewType === 'wide'           ? 'Review Wide'
              : 'Review Wicket'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Speed & height info bar */}
      {(speedKmh > 0 || heightLabel || edgeDetected) && (
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
          {edgeDetected && (
            <View style={styles.infoItem}>
              <Ionicons name="mic" size={11} color={COLORS.lbw} />
              <Text style={[styles.infoText, { color: COLORS.lbw }]}>Edge 🎙️</Text>
            </View>
          )}
        </View>
      )}

      {/* Review dots for both teams */}
      <View style={styles.container}>
        <TeamBlock
          teamName={battingTeam?.name || 'Batting'}
          teamReviews={battingReviews}
          canReview={canBattingReview}
          reviewType={battingReviewType}
          teamId={battingTeamId}
          isbatting={true}
        />
        <View style={styles.divider} />
        <TeamBlock
          teamName={bowlingTeam?.name || 'Bowling'}
          teamReviews={bowlingReviews}
          canReview={canBowlingReview}
          reviewType={bowlingReviewType}
          teamId={bowlingTeamId}
          isbatting={false}
        />
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
  teamBlock: { flex: 1, padding: 7, alignItems: 'center', gap: 2 },
  teamBlockActive:    { backgroundColor: COLORS.review_glow },
  teamBlockExhausted: { backgroundColor: 'rgba(255,23,68,0.05)', opacity: 0.75 },

  teamLabel: { fontSize: 10, fontWeight: '700', color: COLORS.text_secondary, letterSpacing: 0.5 },

  reviewDots: { flexDirection: 'row', gap: 5, marginVertical: 2 },
  dot:        { width: 12, height: 12, borderRadius: 6 },
  dotActive:  { backgroundColor: COLORS.review },
  dotUsed:    { backgroundColor: COLORS.border, opacity: 0.5 },

  reviewCount:       { fontSize: 8, fontWeight: '600', color: COLORS.text_muted },
  reviewCountNormal: { color: COLORS.text_muted },
  reviewCountZero:   { color: COLORS.danger, fontWeight: '700' },

  reviewHint: { fontSize: 9, color: COLORS.review, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  divider:    { width: 1, backgroundColor: COLORS.border },
});
