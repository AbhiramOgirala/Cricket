import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { resetMatch } from '../src/store/slices/matchSlice';
import { COLORS } from '../src/constants';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const dispatch = useDispatch();

  const handleNewMatch = () => {
    dispatch(resetMatch());
    router.push('/setup');
  };

  return (
    <LinearGradient
      colors={[COLORS.bg_deep, '#0a1628', '#0d1f3c']}
      style={styles.container}
    >
      {/* Cricket field grid lines */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {[...Array(6)].map((_, i) => (
          <View key={i} style={[styles.gridLine, { top: height * 0.1 * (i + 1) }]} />
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="cricket" size={48} color={COLORS.primary} />
          <View style={styles.logoTextWrap}>
            <Text style={styles.logoTitle}>GULLY</Text>
            <Text style={styles.logoSubtitle}>CRICKET</Text>
          </View>
        </View>
        <Text style={styles.tagline}>Smart Tracking for Street Cricket</Text>
      </View>

      {/* Feature pills */}
      <View style={styles.featuresRow}>
        {[
          { icon: 'eye', label: 'Auto Wide' },
          { icon: 'alert-circle', label: 'No Ball' },
          { icon: 'refresh-circle', label: 'Replay' },
          { icon: 'stats-chart', label: 'Scorecard' },
        ].map((f) => (
          <View key={f.label} style={styles.featurePill}>
            <Ionicons name={f.icon} size={16} color={COLORS.primary} />
            <Text style={styles.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* Main CTA */}
      <View style={styles.actionsWrap}>
        <TouchableOpacity onPress={handleNewMatch} activeOpacity={0.85}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primary_dim]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryBtn}
          >
            <Ionicons name="play" size={24} color={COLORS.text_inverse} />
            <Text style={styles.primaryBtnText}>Start New Match</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/history')}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={20} color={COLORS.primary} />
          <Text style={styles.secondaryBtnText}>Match History</Text>
        </TouchableOpacity>
      </View>

      {/* Info card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color={COLORS.secondary} />
        <Text style={styles.infoText}>
          Point your phone camera toward the batsman for automatic detection of wide balls, no-balls, and bounces.
        </Text>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Powered by Computer Vision • Made for Gully Cricket</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  logoTextWrap: {},
  logoTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.text_primary,
    letterSpacing: 8,
    lineHeight: 44,
  },
  logoSubtitle: {
    fontSize: 18,
    fontWeight: '300',
    color: COLORS.primary,
    letterSpacing: 12,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.text_secondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 40,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary_glow,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureLabel: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actionsWrap: {
    gap: 14,
    marginBottom: 30,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 18,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text_inverse,
    letterSpacing: 1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary_glow,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.bg_card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.secondary_glow,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text_secondary,
    lineHeight: 18,
  },
  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.text_muted,
    letterSpacing: 0.5,
  },
});
