import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { selectMatch } from '../src/store/slices/matchSlice';
import { COLORS } from '../src/constants';

const { width } = Dimensions.get('window');

function SectionHeader({ title, color = COLORS.primary }) {
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: color }]}>
      <Text style={[styles.sectionHeaderText, { color }]}>{title}</Text>
    </View>
  );
}

function BatsmanRow({ player, stats, isStriker }) {
  const sr = stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0';
  return (
    <View style={styles.tableRow}>
      <View style={styles.tableNameCell}>
        <Text style={styles.tablePlayerName} numberOfLines={1}>
          {player?.name || '—'}{isStriker ? ' *' : ''}
        </Text>
        {stats.isOut && <Text style={styles.dismissalText}>{stats.wicketType || 'Out'}</Text>}
        {!stats.isOut && stats.balls > 0 && <Text style={styles.notOutText}>not out</Text>}
      </View>
      <Text style={styles.tableCell}>{stats.runs}</Text>
      <Text style={styles.tableCell}>{stats.balls}</Text>
      <Text style={styles.tableCell}>{stats.fours}</Text>
      <Text style={styles.tableCell}>{stats.sixes}</Text>
      <Text style={[styles.tableCell, { color: COLORS.primary }]}>{sr}</Text>
    </View>
  );
}

function BowlerRow({ player, stats }) {
  const overs = `${stats.overs}.${stats.balls}`;
  const econ = stats.overs > 0 ? (stats.runs / (stats.overs + stats.balls / 6)).toFixed(1) : '0.0';
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.tableNameCell, { fontSize: 13, color: COLORS.text_primary }]} numberOfLines={1}>
        {player?.name || '—'}
      </Text>
      <Text style={styles.tableCell}>{overs}</Text>
      <Text style={styles.tableCell}>{stats.maidens || 0}</Text>
      <Text style={styles.tableCell}>{stats.runs}</Text>
      <Text style={[styles.tableCell, { color: COLORS.danger }]}>{stats.wickets}</Text>
      <Text style={[styles.tableCell, { color: COLORS.secondary }]}>{econ}</Text>
    </View>
  );
}

function InningsCard({ innings, teams, isCurrent }) {
  if (!innings) return null;
  const battingTeam = innings.battingTeamId === teams.team1.id ? teams.team1 : teams.team2;
  const bowlingTeam = innings.bowlingTeamId === teams.team1.id ? teams.team1 : teams.team2;
  const batsmenEntries = Object.entries(innings.batsmanStats || {});
  const bowlerEntries = Object.entries(innings.bowlerStats || {});
  const totalExtras = (innings.extras?.wides || 0) + (innings.extras?.noBalls || 0) +
    (innings.extras?.byes || 0) + (innings.extras?.legByes || 0);
  const oversStr = innings.overs.length + '.' + (innings.currentOver?.legalBalls || 0);

  return (
    <View style={[styles.inningsCard, isCurrent && { borderColor: COLORS.primary }]}>
      <View style={styles.inningsCardHeader}>
        <Text style={styles.inningsTeamName}>{battingTeam?.name}</Text>
        <View style={styles.inningsTotalWrap}>
          <Text style={styles.inningsTotal}>{innings.totalRuns}/{innings.totalWickets}</Text>
          <Text style={styles.inningsOvers}>({oversStr} ov)</Text>
        </View>
      </View>

      <SectionHeader title="BATTING" color={COLORS.primary} />
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Batsman</Text>
        <Text style={styles.tableHeaderCell}>R</Text>
        <Text style={styles.tableHeaderCell}>B</Text>
        <Text style={styles.tableHeaderCell}>4s</Text>
        <Text style={styles.tableHeaderCell}>6s</Text>
        <Text style={styles.tableHeaderCell}>SR</Text>
      </View>
      {batsmenEntries.map(([playerId, stats]) => {
        const player = [...(battingTeam?.players || [])].find((p) => p.id === playerId);
        const isStriker = innings.currentBatsmen?.striker?.id === playerId;
        return <BatsmanRow key={playerId} player={player} stats={stats} isStriker={isStriker} />;
      })}

      <View style={styles.extrasRow}>
        <Text style={styles.extrasLabel}>Extras</Text>
        <Text style={styles.extrasValue}>
          {totalExtras} (Wd {innings.extras?.wides || 0}, NB {innings.extras?.noBalls || 0},
          B {innings.extras?.byes || 0}, LB {innings.extras?.legByes || 0})
        </Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{innings.totalRuns}/{innings.totalWickets} ({oversStr} Ov)</Text>
      </View>

      {innings.fallOfWickets?.length > 0 && (
        <>
          <SectionHeader title="FALL OF WICKETS" color={COLORS.danger} />
          <View style={styles.fowWrap}>
            {innings.fallOfWickets.map((fow, i) => (
              <Text key={i} style={styles.fowItem}>
                {fow.wicketNumber}-{fow.runs} (Ov {fow.over})
              </Text>
            ))}
          </View>
        </>
      )}

      <SectionHeader title="BOWLING" color={COLORS.secondary} />
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Bowler</Text>
        <Text style={styles.tableHeaderCell}>O</Text>
        <Text style={styles.tableHeaderCell}>M</Text>
        <Text style={styles.tableHeaderCell}>R</Text>
        <Text style={[styles.tableHeaderCell, { color: COLORS.danger }]}>W</Text>
        <Text style={[styles.tableHeaderCell, { color: COLORS.secondary }]}>Eco</Text>
      </View>
      {bowlerEntries.map(([playerId, stats]) => {
        const player = [...(bowlingTeam?.players || [])].find((p) => p.id === playerId);
        return <BowlerRow key={playerId} player={player} stats={stats} />;
      })}
    </View>
  );
}

export default function ScorecardScreen() {
  const match = useSelector(selectMatch);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.bg_deep, COLORS.bg_dark]} style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Scorecard</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.matchTitle}>{match.matchName}</Text>

        {match.innings.length > 1 && (
          <View style={styles.tabRow}>
            {match.innings.map((inn, i) => {
              const team = inn.battingTeamId === match.team1.id ? match.team1 : match.team2;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.tab, activeTab === i && styles.tabActive]}
                  onPress={() => setActiveTab(i)}
                >
                  <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                    {team?.name} ({i + 1}st Inn)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <InningsCard
            innings={match.innings[activeTab]}
            teams={{ team1: match.team1, team2: match.team2 }}
            isCurrent={activeTab === match.currentInningsIndex}
          />
        </ScrollView>

        {match.status !== 'complete' && (
          <TouchableOpacity style={styles.backToScoringBtn} onPress={() => router.back()}>
            <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.backToScoringGrad}>
              <Ionicons name="arrow-back" size={18} color="#000" />
              <Text style={styles.backToScoringText}>Back to Scoring</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg_deep },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  screenTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text_primary },
  matchTitle: { fontSize: 14, color: COLORS.text_secondary, textAlign: 'center', marginBottom: 12, fontWeight: '600' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: COLORS.bg_card, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: COLORS.text_muted },
  tabTextActive: { color: '#000' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  inningsCard: {
    backgroundColor: COLORS.bg_card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  inningsCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  inningsTeamName: { fontSize: 18, fontWeight: '800', color: COLORS.text_primary },
  inningsTotalWrap: { alignItems: 'flex-end' },
  inningsTotal: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  inningsOvers: { fontSize: 12, color: COLORS.text_muted, fontWeight: '600' },
  sectionHeader: { borderLeftWidth: 3, paddingLeft: 10, marginTop: 14, marginBottom: 8 },
  sectionHeaderText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  tableHeaderRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4,
  },
  tableHeaderCell: { flex: 1, fontSize: 10, fontWeight: '800', color: COLORS.text_muted, textAlign: 'center', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: `${COLORS.border}50`,
  },
  tableNameCell: { flex: 2, paddingRight: 8 },
  tablePlayerName: { fontSize: 13, fontWeight: '700', color: COLORS.text_primary },
  dismissalText: { fontSize: 10, color: COLORS.danger, fontWeight: '600' },
  notOutText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  tableCell: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text_primary, textAlign: 'center' },
  extrasRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8 },
  extrasLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text_muted, minWidth: 55 },
  extrasValue: { flex: 1, fontSize: 11, color: COLORS.text_secondary, flexWrap: 'wrap' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  totalLabel: { fontSize: 14, fontWeight: '800', color: COLORS.text_primary },
  totalValue: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  fowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  fowItem: {
    fontSize: 11, color: COLORS.text_secondary, backgroundColor: COLORS.bg_elevated,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '600',
  },
  backToScoringBtn: { margin: 16 },
  backToScoringGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14,
  },
  backToScoringText: { fontSize: 15, fontWeight: '800', color: '#000' },
});
