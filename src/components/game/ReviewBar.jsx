import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CRICKET } from '../../constants';

/**
 * Shows review availability for both teams.
 * Fielding team can review wickets/LBW.
 * Batting team can review wides.
 */
export default function ReviewBar({ reviews, battingTeamId, bowlingTeamId, teams, onRequestReview, lastBall, disabled }) {
  const battingTeam = teams?.team1?.id === battingTeamId ? teams.team1 : teams.team2;
  const bowlingTeam = teams?.team1?.id === bowlingTeamId ? teams.team1 : teams.team2;

  const battingReviews = reviews?.[battingTeamId];
  const bowlingReviews = reviews?.[bowlingTeamId];

  const isWicket = lastBall?.outcome === 'wicket' || lastBall?.outcome === 'lbw';
  const isWide = lastBall?.outcome === 'wide';

  const canBattingReview = isWide && battingReviews?.remaining > 0;
  const canBowlingReview = (isWicket) && bowlingReviews?.remaining > 0;

  return (
    <View style={styles.container}>
      {/* Batting team reviews */}
      <TouchableOpacity
        style={[styles.teamBlock, canBattingReview && !disabled && styles.teamBlockActive]}
        onPress={() => canBattingReview && !disabled && onRequestReview(battingTeamId, battingTeam?.name, isWicket ? 'wicket' : 'wide')}
        disabled={!canBattingReview || disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.teamLabel} numberOfLines={1}>🏏 {battingTeam?.name}</Text>
        <View style={styles.reviewDots}>
          {Array.from({ length: CRICKET.REVIEWS_PER_TEAM }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < (battingReviews?.remaining || 0) ? styles.dotActive : styles.dotUsed,
              ]}
            />
          ))}
        </View>
        {canBattingReview && !disabled && (
          <Text style={styles.reviewHint}>Review Wide</Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Bowling team reviews */}
      <TouchableOpacity
        style={[styles.teamBlock, canBowlingReview && !disabled && styles.teamBlockActive]}
        onPress={() => canBowlingReview && !disabled && onRequestReview(bowlingTeamId, bowlingTeam?.name, lastBall?.outcome === 'lbw' ? 'lbw' : 'wicket')}
        disabled={!canBowlingReview || disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.teamLabel} numberOfLines={1}>⚡ {bowlingTeam?.name}</Text>
        <View style={styles.reviewDots}>
          {Array.from({ length: CRICKET.REVIEWS_PER_TEAM }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < (bowlingReviews?.remaining || 0) ? styles.dotActive : styles.dotUsed,
              ]}
            />
          ))}
        </View>
        {canBowlingReview && !disabled && (
          <Text style={styles.reviewHint}>{lastBall?.outcome === 'lbw' ? 'Review LBW' : 'Review Wicket'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg_card,
    borderRadius: 10,
    marginHorizontal: 12,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  teamBlock: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
    gap: 4,
  },
  teamBlockActive: {
    backgroundColor: COLORS.review_glow,
    borderColor: COLORS.review,
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text_secondary,
    letterSpacing: 0.5,
  },
  reviewDots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: { backgroundColor: COLORS.review },
  dotUsed: { backgroundColor: COLORS.border, opacity: 0.4 },
  reviewHint: {
    fontSize: 9,
    color: COLORS.review,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: { width: 1, backgroundColor: COLORS.border },
});
