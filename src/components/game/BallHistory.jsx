import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS, OUTCOME_COLORS, BALL_OUTCOMES } from '../../constants';

function BallDot({ ball }) {
  const color = OUTCOME_COLORS[ball.outcome] || COLORS.text_muted;
  const isExtra = ball.isExtra;

  const label = (() => {
    switch (ball.outcome) {
      case BALL_OUTCOMES.DOT: return '•';
      case BALL_OUTCOMES.WIDE: return 'Wd';
      case BALL_OUTCOMES.NO_BALL: return 'Nb';
      case BALL_OUTCOMES.WICKET: return 'W';
      default: return ball.runs?.toString() || '0';
    }
  })();

  return (
    <View style={[styles.dot, { borderColor: color, backgroundColor: `${color}22` }]}>
      <Text style={[styles.dotLabel, { color }]}>{label}</Text>
      {isExtra && <View style={[styles.extraIndicator, { backgroundColor: color }]} />}
    </View>
  );
}

export default function BallHistory({ balls }) {
  const legalBalls = balls.filter((b) => !b.isExtra);
  const allBalls = balls;

  return (
    <View style={styles.container}>
      <Text style={styles.overLabel}>This Over</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {allBalls.map((ball, i) => (
          <BallDot key={ball.id || i} ball={ball} />
        ))}
        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 6 - legalBalls.length) }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.emptyDot} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  overLabel: {
    fontSize: 10,
    color: COLORS.text_muted,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dotLabel: {
    fontSize: 11,
    fontWeight: '900',
  },
  extraIndicator: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
});
