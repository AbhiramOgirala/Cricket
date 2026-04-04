import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

export default function ScoreDisplay({ runs, wickets, overs, legalBalls }) {
  return (
    <View style={styles.container}>
      <Text style={styles.score}>{runs}/{wickets}</Text>
      <Text style={styles.overs}>{overs}.{legalBalls} overs</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  score: { fontSize: 40, fontWeight: '900', color: COLORS.text_primary },
  overs: { fontSize: 14, color: COLORS.text_secondary, fontWeight: '600' },
});
