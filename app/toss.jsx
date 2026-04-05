import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { setupMatch } from '../src/store/slices/matchSlice';
import { COLORS } from '../src/constants';
import uuid from 'react-native-uuid';

// Coin side content
const CoinSide = ({ type, size = 120 }) => {
  if (type === 'heads') {
    return (
      <View style={[styles.coinFaceInner, { width: size, height: size, borderRadius: size / 2 }]}>
        <MaterialCommunityIcons name="cricket" size={size * 0.38} color="#7b5800" />
        <Text style={[styles.coinSideText, { fontSize: size * 0.11 }]}>HEADS</Text>
      </View>
    );
  }
  return (
    <View style={[styles.coinFaceInner, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.coinTailsIcon, { fontSize: size * 0.42 }]}>🏏</Text>
      <Text style={[styles.coinSideText, { fontSize: size * 0.11 }]}>TAILS</Text>
    </View>
  );
};

export default function TossScreen() {
  const dispatch = useDispatch();
  const params = useLocalSearchParams();
  const team1 = JSON.parse(params.team1);
  const team2 = JSON.parse(params.team2);
  const totalOvers = parseInt(params.totalOvers);
  const matchName = params.matchName;

  const [phase, setPhase] = useState('choose'); // 'choose' | 'flip' | 'land' | 'decide'
  const [callingTeam, setCallingTeam] = useState(null);
  const [tossCall, setTossCall] = useState(null); // 'heads' | 'tails'
  const [tossResult, setTossResult] = useState(null); // 'heads' | 'tails'
  const [tossWinner, setTossWinner] = useState(null);
  const [battingFirst, setBattingFirst] = useState(null);

  // Animations
  const spinAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const landAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;

  const flipCoin = (call) => {
    setTossCall(call);
    setPhase('flip');

    // Coin spin animation - multiple rotations
    Animated.sequence([
      // Rise with fast spin
      Animated.parallel([
        Animated.timing(bounceAnim, {
          toValue: -220,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(spinAnim, {
          toValue: 8,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      // Fall
      Animated.parallel([
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(spinAnim, {
          toValue: 18,
          duration: 700,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      // Small settle bounce
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -30, duration: 180, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 180, easing: Easing.bounce, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Determine result
      const result = Math.random() > 0.5 ? 'heads' : 'tails';
      setTossResult(result);
      const winner = result === call ? callingTeam : (callingTeam?.id === team1.id ? team2 : team1);
      setTossWinner(winner);

      // Shine animation
      Animated.timing(shineAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

      setPhase('land');

      setTimeout(() => {
        Animated.spring(resultAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 8,
        }).start();
        setPhase('decide');
      }, 800);
    });
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
    router.replace('/scoring');
  };

  const spinInterpolated = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const won = tossResult === tossCall;
  const coinLabel = tossResult === 'heads' ? '👑 HEADS' : '🏏 TAILS';
  const coinColor = tossResult === 'heads'
    ? ['#ffd700', '#b8860b', '#ffd700']
    : ['#e8c96d', '#c8a84b', '#e8c96d'];

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.bg_deep, '#0a1628', '#0d1f3c']} style={styles.container}>

        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Toss</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.matchName}>{matchName}</Text>

        {/* Phase: Choose calling team */}
        {phase === 'choose' && (
          <View style={styles.phaseWrap}>
            <Text style={styles.phaseTitle}>Who calls the toss?</Text>
            <View style={styles.teamChooseRow}>
              {[team1, team2].map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.teamChooseCard, callingTeam?.id === team.id && styles.teamChooseCardActive]}
                  onPress={() => setCallingTeam(team)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="shield"
                    size={32}
                    color={callingTeam?.id === team.id ? '#000' : COLORS.primary}
                  />
                  <Text style={[styles.teamChooseName, callingTeam?.id === team.id && styles.teamChooseNameActive]}>
                    {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {callingTeam && (
              <>
                <Text style={styles.callLabel}>{callingTeam.name} calls:</Text>
                <View style={styles.callRow}>
                  {['heads', 'tails'].map((side) => (
                    <TouchableOpacity
                      key={side}
                      style={styles.callBtn}
                      onPress={() => flipCoin(side)}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={side === 'heads' ? ['#ffd700', '#b8860b'] : ['#c0c0c0', '#808080']}
                        style={styles.callBtnGrad}
                      >
                        <Text style={styles.callBtnIcon}>{side === 'heads' ? '👑' : '🏏'}</Text>
                        <Text style={styles.callBtnText}>{side.toUpperCase()}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Coin animation */}
        {(phase === 'flip' || phase === 'land' || phase === 'decide') && (
          <View style={styles.coinStage}>
            {/* Ground shadow */}
            <View style={styles.coinShadow} />

            {/* Animated coin */}
            <Animated.View
              style={[
                styles.coinWrap,
                {
                  transform: [
                    { translateY: bounceAnim },
                    { rotateX: spinInterpolated },
                  ],
                },
              ]}
            >
              <LinearGradient colors={coinColor} style={styles.coin}>
                {phase === 'land' || phase === 'decide' ? (
                  <CoinSide type={tossResult} size={140} />
                ) : (
                  <View style={styles.coinFlipping}>
                    <MaterialCommunityIcons name="cricket" size={48} color="#7b5800" />
                  </View>
                )}

                {/* Shine overlay */}
                {(phase === 'land' || phase === 'decide') && (
                  <Animated.View
                    style={[
                      styles.coinShine,
                      { opacity: shineAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 0] }) },
                    ]}
                  />
                )}
              </LinearGradient>
            </Animated.View>

            {/* Coin rim effect */}
            <View style={styles.coinRimShadow} />
          </View>
        )}

        {/* Result */}
        {phase === 'decide' && tossWinner && (
          <Animated.View
            style={[
              styles.resultWrap,
              {
                opacity: resultAnim,
                transform: [{ translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
              },
            ]}
          >
            {/* Coin result label */}
            <View style={styles.coinResultBadge}>
              <Text style={styles.coinResultText}>{coinLabel}</Text>
            </View>

            <View style={styles.tossResultCard}>
              <Text style={styles.tossResultSmall}>🏆 TOSS WON BY</Text>
              <Text style={styles.tossWinnerBig}>{tossWinner.name}</Text>

              <Text style={styles.battingLabel}>Choose to:</Text>
              <View style={styles.battingChoiceRow}>
                {[
                  { label: 'BAT FIRST', icon: 'cricket', team: tossWinner },
                  { label: 'BOWL FIRST', icon: 'baseline-sports-cricket', team: tossWinner.id === team1.id ? team2 : team1 },
                ].map(({ label, icon, team }) => (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.battingChoiceBtn,
                      battingFirst?.id === team.id && styles.battingChoiceBtnActive,
                    ]}
                    onPress={() => {
                      // If 'BAT FIRST' pressed, winner bats; if 'BOWL FIRST', opponent bats
                      if (label === 'BAT FIRST') setBattingFirst(tossWinner);
                      else setBattingFirst(tossWinner.id === team1.id ? team2 : team1);
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="cricket"
                      size={20}
                      color={battingFirst?.id === team.id ? '#000' : COLORS.primary}
                    />
                    <Text style={[styles.battingChoiceText, battingFirst?.id === team.id && { color: '#000' }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {battingFirst && (
              <TouchableOpacity onPress={handleStart} activeOpacity={0.85} style={styles.startWrap}>
                <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.startBtn}>
                  <Ionicons name="play" size={22} color={COLORS.text_inverse} />
                  <Text style={styles.startBtnText}>Start Match!</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg_deep },
  container: { flex: 1, paddingBottom: 30 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  screenTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text_primary },
  matchName: { fontSize: 16, fontWeight: '700', color: COLORS.text_secondary, textAlign: 'center', paddingHorizontal: 20, marginBottom: 20 },

  // ── CHOOSE PHASE ──
  phaseWrap: { flex: 1, paddingHorizontal: 24, alignItems: 'center', gap: 20, paddingTop: 10 },
  phaseTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text_primary },
  teamChooseRow: { flexDirection: 'row', gap: 14, width: '100%' },
  teamChooseCard: {
    flex: 1, alignItems: 'center', gap: 10, padding: 20,
    borderRadius: 18, backgroundColor: COLORS.bg_card,
    borderWidth: 2, borderColor: COLORS.border,
  },
  teamChooseCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  teamChooseName: { fontSize: 15, fontWeight: '800', color: COLORS.text_primary, textAlign: 'center' },
  teamChooseNameActive: { color: '#000' },
  callLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text_secondary, alignSelf: 'flex-start' },
  callRow: { flexDirection: 'row', gap: 14, width: '100%' },
  callBtn: { flex: 1 },
  callBtnGrad: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 16, paddingVertical: 22,
  },
  callBtnIcon: { fontSize: 32 },
  callBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },

  // ── COIN ──
  coinStage: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20,
  },
  coinWrap: { alignItems: 'center', justifyContent: 'center' },
  coin: {
    width: 148, height: 148, borderRadius: 74,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ffd700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 24, elevation: 16,
    borderWidth: 3, borderColor: '#b8860b',
  },
  coinFaceInner: {
    alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  coinFlipping: { alignItems: 'center', justifyContent: 'center' },
  coinSideText: { fontWeight: '900', color: '#7b5800', letterSpacing: 2 },
  coinTailsIcon: { lineHeight: undefined },
  coinShine: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 74, backgroundColor: '#ffffff',
  },
  coinShadow: {
    position: 'absolute', bottom: -10,
    width: 100, height: 20, borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  coinRimShadow: {
    position: 'absolute', bottom: -16,
    width: 80, height: 8, borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },

  // ── RESULT ──
  resultWrap: { paddingHorizontal: 22, gap: 14 },
  coinResultBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.secondary_glow, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1.5, borderColor: COLORS.secondary,
  },
  coinResultText: { fontSize: 18, fontWeight: '900', color: COLORS.secondary, letterSpacing: 2 },
  tossResultCard: {
    backgroundColor: COLORS.bg_card, borderRadius: 20, padding: 22,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  tossResultSmall: { fontSize: 11, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 2 },
  tossWinnerBig: { fontSize: 28, fontWeight: '900', color: COLORS.secondary },
  battingLabel: { fontSize: 13, color: COLORS.text_secondary, fontWeight: '600' },
  battingChoiceRow: { flexDirection: 'row', gap: 12, width: '100%' },
  battingChoiceBtn: {
    flex: 1, alignItems: 'center', gap: 6, padding: 16,
    borderRadius: 14, backgroundColor: COLORS.bg_elevated,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  battingChoiceBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  battingChoiceText: { fontSize: 13, fontWeight: '800', color: COLORS.text_primary },
  startWrap: {},
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 16, paddingVertical: 18,
  },
  startBtnText: { fontSize: 18, fontWeight: '800', color: COLORS.text_inverse },
});
