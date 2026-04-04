import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { setupMatch } from '../src/store/slices/matchSlice';
import { COLORS } from '../src/constants';
import uuid from 'react-native-uuid';

export default function TossScreen() {
  const dispatch = useDispatch();
  const params = useLocalSearchParams();
  const team1 = JSON.parse(params.team1);
  const team2 = JSON.parse(params.team2);
  const totalOvers = parseInt(params.totalOvers);
  const matchName = params.matchName;

  const [tossWinner, setTossWinner] = useState(null);
  const [battingFirst, setBattingFirst] = useState(null);
  const [coinFlipped, setCoinFlipped] = useState(false);

  const flipCoin = () => {
    const winner = Math.random() > 0.5 ? team1 : team2;
    setTossWinner(winner);
    setCoinFlipped(true);
    setBattingFirst(null);
  };

  const handleStart = () => {
    if (!battingFirst) return;

    dispatch(setupMatch({
      matchId: uuid.v4(),
      matchName,
      team1,
      team2,
      totalOvers,
      tossWinner: tossWinner?.id,
      battingFirst: battingFirst.id,
    }));

    router.replace('/calibrate');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.bg_deep, COLORS.bg_dark]} style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Toss</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.matchName}>{matchName}</Text>

          {/* Coin */}
          <TouchableOpacity onPress={flipCoin} activeOpacity={0.85} style={styles.coinWrap}>
            <LinearGradient
              colors={
                coinFlipped
                  ? [COLORS.secondary, COLORS.secondary_dim]
                  : [COLORS.bg_elevated, COLORS.bg_card]
              }
              style={styles.coin}
            >
              <MaterialCommunityIcons
                name="cricket"
                size={coinFlipped ? 60 : 48}
                color={coinFlipped ? COLORS.text_inverse : COLORS.text_muted}
              />
              {!coinFlipped && (
                <Text style={styles.coinText}>TAP TO{'\n'}FLIP</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {coinFlipped && tossWinner && (
            <View style={styles.tossResultCard}>
              <Text style={styles.tossResultLabel}>🏆 TOSS WON BY</Text>
              <Text style={styles.tossWinnerName}>{tossWinner.name}</Text>

              <Text style={styles.chooseLabel}>Who bats first?</Text>
              <View style={styles.teamChoiceRow}>
                {[team1, team2].map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.teamChoiceBtn,
                      battingFirst?.id === team.id && styles.teamChoiceBtnActive,
                    ]}
                    onPress={() => setBattingFirst(team)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="cricket"
                      size={20}
                      color={battingFirst?.id === team.id ? COLORS.text_inverse : COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.teamChoiceName,
                        battingFirst?.id === team.id && styles.teamChoiceNameActive,
                      ]}
                    >
                      {team.name}
                    </Text>
                    <Text
                      style={[
                        styles.teamChoiceSub,
                        battingFirst?.id === team.id && { color: 'rgba(0,0,0,0.6)' },
                      ]}
                    >
                      Bats First
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {battingFirst && (
            <TouchableOpacity onPress={handleStart} activeOpacity={0.85} style={styles.startWrap}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.primary_dim]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startBtn}
              >
                <Ionicons name="play" size={22} color={COLORS.text_inverse} />
                <Text style={styles.startBtnText}>Start Match</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  matchName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text_primary,
    textAlign: 'center',
    marginBottom: 40,
  },
  coinWrap: { marginBottom: 40 },
  coin: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  coinText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text_muted,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
  },
  tossResultCard: {
    width: '100%',
    backgroundColor: COLORS.bg_card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tossResultLabel: {
    fontSize: 11,
    color: COLORS.text_muted,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  tossWinnerName: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.secondary,
    marginBottom: 24,
  },
  chooseLabel: {
    fontSize: 13,
    color: COLORS.text_secondary,
    fontWeight: '600',
    marginBottom: 14,
  },
  teamChoiceRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  teamChoiceBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.bg_elevated,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  teamChoiceBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  teamChoiceName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text_primary,
  },
  teamChoiceNameActive: { color: COLORS.text_inverse },
  teamChoiceSub: {
    fontSize: 10,
    color: COLORS.text_muted,
    fontWeight: '600',
  },
  startWrap: { marginTop: 24, width: '100%' },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text_inverse,
  },
});
