import { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { resetMatch, selectMatch } from '../src/store/slices/matchSlice';
import { resetCalibration } from '../src/store/slices/detectionSlice';
import { COLORS } from '../src/constants';

const { width } = Dimensions.get('window');

function StatBox({ label, value, color = COLORS.primary }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ResultScreen() {
  const dispatch = useDispatch();
  const match = useSelector(selectMatch);

  useEffect(() => {
    const saveToHistory = async () => {
      try {
        const raw = await AsyncStorage.getItem('match_history');
        const history = raw ? JSON.parse(raw) : [];
        const alreadySaved = history.some((m) => m.matchId === match.matchId);
        if (!alreadySaved && match.result) {
          const entry = {
            matchId: match.matchId,
            matchName: match.matchName,
            result: match.result,
            team1: match.team1,
            team2: match.team2,
            innings: match.innings.map((inn) => ({
              totalRuns: inn.totalRuns,
              totalWickets: inn.totalWickets,
            })),
            timestamp: new Date().toISOString(),
          };
          await AsyncStorage.setItem('match_history', JSON.stringify([entry, ...history].slice(0, 50)));
        }
      } catch (e) {}
    };
    saveToHistory();
  }, []);

  const inn1 = match.innings[0];
  const inn2 = match.innings[1];
  const team1 = match.team1;
  const team2 = match.team2;

  const getBattingTeam = (inn) => inn?.battingTeamId === team1.id ? team1 : team2;

  const handleNewMatch = () => {
    dispatch(resetMatch());
    dispatch(resetCalibration());
    router.replace('/');
  };

  const getTopScorer = (inn) => {
    if (!inn) return null;
    const entries = Object.entries(inn.batsmanStats || {});
    if (!entries.length) return null;
    const top = entries.reduce((a, b) => (a[1].runs >= b[1].runs ? a : b));
    const team = getBattingTeam(inn);
    const player = team?.players?.find((p) => p.id === top[0]);
    return { name: player?.name || 'Unknown', runs: top[1].runs, balls: top[1].balls };
  };

  const getTopWickettaker = (inn) => {
    if (!inn) return null;
    const entries = Object.entries(inn.bowlerStats || {});
    if (!entries.length) return null;
    const top = entries.reduce((a, b) => (a[1].wickets >= b[1].wickets ? a : b));
    const bowlingTeam = inn.battingTeamId === team1.id ? team2 : team1;
    const player = bowlingTeam?.players?.find((p) => p.id === top[0]);
    return { name: player?.name || 'Unknown', wickets: top[1].wickets, runs: top[1].runs };
  };

  const topScorer1 = getTopScorer(inn1);
  const topScorer2 = getTopScorer(inn2);
  const topWickets1 = getTopWickettaker(inn1);
  const topWickets2 = getTopWickettaker(inn2);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.bg_deep, '#0a1f3c']} style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.trophyWrap}>
            <LinearGradient colors={[COLORS.secondary, COLORS.secondary_dim]} style={styles.trophyCircle}>
              <Text style={styles.trophyEmoji}>🏆</Text>
            </LinearGradient>
          </View>

          <Text style={styles.resultText}>{match.result}</Text>
          <Text style={styles.matchNameText}>{match.matchName}</Text>

          <View style={styles.inningsSummaryRow}>
            {[inn1, inn2].map((inn, i) => {
              if (!inn) return null;
              const team = getBattingTeam(inn);
              const overs = inn.overs.length + '.' + (inn.currentOver?.legalBalls || 0);
              return (
                <View key={i} style={styles.inningsSummaryCard}>
                  <Text style={styles.innTeamName}>{team?.name}</Text>
                  <Text style={styles.innScore}>{inn.totalRuns}/{inn.totalWickets}</Text>
                  <Text style={styles.innOvers}>({overs} ov)</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.highlightsTitle}>⭐ Match Highlights</Text>
          <View style={styles.highlightsGrid}>
            {topScorer1 && (
              <View style={styles.highlightCard}>
                <Text style={styles.hlLabel}>Top Scorer (Inn 1)</Text>
                <Text style={styles.hlName}>{topScorer1.name}</Text>
                <Text style={styles.hlValue}>{topScorer1.runs} <Text style={styles.hlSub}>({topScorer1.balls}b)</Text></Text>
              </View>
            )}
            {topScorer2 && (
              <View style={styles.highlightCard}>
                <Text style={styles.hlLabel}>Top Scorer (Inn 2)</Text>
                <Text style={styles.hlName}>{topScorer2.name}</Text>
                <Text style={styles.hlValue}>{topScorer2.runs} <Text style={styles.hlSub}>({topScorer2.balls}b)</Text></Text>
              </View>
            )}
            {topWickets1 && (
              <View style={[styles.highlightCard, { borderColor: COLORS.danger }]}>
                <Text style={[styles.hlLabel, { color: COLORS.danger }]}>Best Bowler (Inn 1)</Text>
                <Text style={styles.hlName}>{topWickets1.name}</Text>
                <Text style={[styles.hlValue, { color: COLORS.danger }]}>{topWickets1.wickets}W <Text style={styles.hlSub}>({topWickets1.runs}R)</Text></Text>
              </View>
            )}
            {topWickets2 && (
              <View style={[styles.highlightCard, { borderColor: COLORS.danger }]}>
                <Text style={[styles.hlLabel, { color: COLORS.danger }]}>Best Bowler (Inn 2)</Text>
                <Text style={styles.hlName}>{topWickets2.name}</Text>
                <Text style={[styles.hlValue, { color: COLORS.danger }]}>{topWickets2.wickets}W <Text style={styles.hlSub}>({topWickets2.runs}R)</Text></Text>
              </View>
            )}
          </View>

          <View style={styles.detectionCard}>
            <Text style={styles.detectionTitle}>📡 Detection Summary</Text>
            <View style={styles.detectionRow}>
              <StatBox label="Wides" value={(inn1?.extras?.wides || 0) + (inn2?.extras?.wides || 0)} color={COLORS.warning} />
              <StatBox label="No Balls" value={(inn1?.extras?.noBalls || 0) + (inn2?.extras?.noBalls || 0)} color={COLORS.danger} />
              <StatBox
                label="Total Extras"
                value={
                  Object.values(inn1?.extras || {}).reduce((a, b) => a + b, 0) +
                  Object.values(inn2?.extras || {}).reduce((a, b) => a + b, 0)
                }
                color={COLORS.info}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => router.push('/scorecard')} style={styles.viewScorecardBtn}>
              <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
              <Text style={styles.viewScorecardText}>Full Scorecard</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNewMatch} activeOpacity={0.85}>
              <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.newMatchBtn}>
                <MaterialCommunityIcons name="cricket" size={20} color="#000" />
                <Text style={styles.newMatchText}>Play Another Match</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/')} style={styles.homeBtn}>
              <Ionicons name="home" size={18} color={COLORS.text_muted} />
              <Text style={styles.homeBtnText}>Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg_deep },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },
  trophyWrap: { alignItems: 'center', marginBottom: 24 },
  trophyCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 20, elevation: 12,
  },
  trophyEmoji: { fontSize: 48 },
  resultText: { fontSize: 24, fontWeight: '900', color: COLORS.text_primary, textAlign: 'center', marginBottom: 6 },
  matchNameText: { fontSize: 13, color: COLORS.text_secondary, textAlign: 'center', marginBottom: 28 },
  inningsSummaryRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  inningsSummaryCard: {
    flex: 1, backgroundColor: COLORS.bg_card, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  innTeamName: { fontSize: 12, fontWeight: '700', color: COLORS.text_muted, marginBottom: 6, textAlign: 'center' },
  innScore: { fontSize: 28, fontWeight: '900', color: COLORS.primary },
  innOvers: { fontSize: 11, color: COLORS.text_muted, fontWeight: '600', marginTop: 2 },
  highlightsTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text_primary, marginBottom: 12, letterSpacing: 0.5 },
  highlightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  highlightCard: {
    width: (width - 40 - 10) / 2, backgroundColor: COLORS.bg_card,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.primary,
  },
  hlLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5, marginBottom: 6 },
  hlName: { fontSize: 14, fontWeight: '800', color: COLORS.text_primary, marginBottom: 4 },
  hlValue: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
  hlSub: { fontSize: 12, color: COLORS.text_secondary, fontWeight: '600' },
  detectionCard: {
    backgroundColor: COLORS.bg_card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 24,
  },
  detectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text_primary, marginBottom: 14 },
  detectionRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 28, fontWeight: '900' },
  statLabel: { fontSize: 11, color: COLORS.text_muted, fontWeight: '600' },
  actions: { gap: 12 },
  viewScorecardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.primary_glow,
  },
  viewScorecardText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  newMatchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 14, paddingVertical: 16,
  },
  newMatchText: { fontSize: 16, fontWeight: '800', color: '#000' },
  homeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  homeBtnText: { fontSize: 14, color: COLORS.text_muted, fontWeight: '600' },
});
