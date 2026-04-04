import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../src/constants';

export default function HistoryScreen() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem('match_history');
      if (raw) setMatches(JSON.parse(raw));
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.bg_deep, COLORS.bg_dark]} style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Match History</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="cricket" size={60} color={COLORS.text_muted} />
            <Text style={styles.emptyText}>No matches yet</Text>
            <Text style={styles.emptySubtext}>Start a new match to see history here</Text>
            <TouchableOpacity
              onPress={() => router.replace('/')}
              style={styles.startBtn}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primary_dim]}
                style={styles.startBtnGrad}
              >
                <Text style={styles.startBtnText}>Start First Match</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {matches.map((match, i) => (
              <View key={match.matchId || i} style={styles.matchCard}>
                <View style={styles.matchCardHeader}>
                  <Text style={styles.matchCardName}>{match.matchName}</Text>
                  <Text style={styles.matchCardDate}>
                    {new Date(match.timestamp || Date.now()).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.matchCardResult}>{match.result}</Text>
                <View style={styles.matchCardScores}>
                  <Text style={styles.matchCardScore}>
                    {match.team1?.name}: {match.innings?.[0]?.totalRuns}/{match.innings?.[0]?.totalWickets}
                  </Text>
                  <Text style={styles.matchCardScore}>
                    {match.team2?.name}: {match.innings?.[1]?.totalRuns}/{match.innings?.[1]?.totalWickets}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg_deep },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  screenTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text_primary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  emptyText: { fontSize: 20, fontWeight: '800', color: COLORS.text_primary, marginTop: 10 },
  emptySubtext: { fontSize: 14, color: COLORS.text_secondary, textAlign: 'center' },
  startBtn: { marginTop: 10 },
  startBtnGrad: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  scrollContent: { padding: 16, gap: 12 },
  matchCard: {
    backgroundColor: COLORS.bg_card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchCardName: { fontSize: 16, fontWeight: '800', color: COLORS.text_primary },
  matchCardDate: { fontSize: 11, color: COLORS.text_muted, fontWeight: '600' },
  matchCardResult: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  matchCardScores: { flexDirection: 'row', gap: 16 },
  matchCardScore: { fontSize: 13, color: COLORS.text_secondary, fontWeight: '600' },
});
