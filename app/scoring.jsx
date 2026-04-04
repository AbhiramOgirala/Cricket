import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Dimensions, Modal, Alert, ScrollView, Vibration
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  recordBall, addAlert, clearAlerts, setCurrentBatsmen, setCurrentBowler,
  selectCurrentInnings, selectCurrentOver, selectTotalRuns, selectTotalWickets,
  selectOversCompleted, selectLegalBallsInOver, selectBouncesInOver,
  selectAlerts, selectMatch,
} from '../src/store/slices/matchSlice';
import {
  resetDetectionFlags, incrementBounceCount, resetBounceCount,
  selectDetection,
} from '../src/store/slices/detectionSlice';
import { COLORS, BALL_OUTCOMES, OUTCOME_COLORS, CRICKET, WICKET_TYPES } from '../src/constants';
import { analyzeBallDelivery } from '../src/utils/ballDetection';
import AlertBanner from '../src/components/game/AlertBanner';
import BallHistory from '../src/components/game/BallHistory';
import PlayerSelectModal from '../src/components/game/PlayerSelectModal';

const { width, height } = Dimensions.get('window');

const SCORING_BUTTONS = [
  { outcome: BALL_OUTCOMES.DOT, label: '•', sublabel: 'Dot', color: COLORS.dot_ball },
  { outcome: BALL_OUTCOMES.ONE, label: '1', sublabel: 'Run', color: COLORS.single },
  { outcome: BALL_OUTCOMES.TWO, label: '2', sublabel: 'Runs', color: COLORS.double },
  { outcome: BALL_OUTCOMES.THREE, label: '3', sublabel: 'Runs', color: COLORS.triple },
  { outcome: BALL_OUTCOMES.FOUR, label: '4', sublabel: 'Boundary', color: COLORS.four },
  { outcome: BALL_OUTCOMES.SIX, label: '6', sublabel: 'Six!', color: COLORS.six },
  { outcome: BALL_OUTCOMES.WIDE, label: 'WD', sublabel: 'Wide', color: COLORS.wide },
  { outcome: BALL_OUTCOMES.NO_BALL, label: 'NB', sublabel: 'No Ball', color: COLORS.no_ball },
  { outcome: BALL_OUTCOMES.WICKET, label: '🏏', sublabel: 'Wicket!', color: COLORS.wicket },
];

export default function ScoringScreen() {
  const dispatch = useDispatch();
  const [permission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const match = useSelector(selectMatch);
  const innings = useSelector(selectCurrentInnings);
  const currentOver = useSelector(selectCurrentOver);
  const totalRuns = useSelector(selectTotalRuns);
  const totalWickets = useSelector(selectTotalWickets);
  const oversCompleted = useSelector(selectOversCompleted);
  const legalBalls = useSelector(selectLegalBallsInOver);
  const bouncesInOver = useSelector(selectBouncesInOver);
  const alerts = useSelector(selectAlerts);
  const detection = useSelector(selectDetection);

  const [isRecording, setIsRecording] = useState(false);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [playerModalFor, setPlayerModalFor] = useState('striker'); // 'striker'|'nonStriker'|'bowler'|'newBatsman'
  const [pendingOutcome, setPendingOutcome] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [lastBallFlash, setLastBallFlash] = useState(null);
  const [detectionActive, setDetectionActive] = useState(true);

  const ballTrajectoryRef = useRef([]);
  const recordingRef = useRef(null);

  const battingTeam = match.battingTeamId === match.team1.id ? match.team1 : match.team2;
  const bowlingTeam = match.bowlingTeamId === match.team1.id ? match.team1 : match.team2;

  // Check if match is over
  useEffect(() => {
    if (match.status === 'complete') {
      router.replace('/result');
    }
  }, [match.status]);

  // Detect over completion to prompt for new bowler
  useEffect(() => {
    if (!innings) return;
    if (innings.currentOver?.isComplete === false && legalBalls === 0 && oversCompleted > 0) {
      // A new over just started (legalBalls reset to 0 after completing 6)
      dispatch(resetBounceCount());
      setTimeout(() => {
        setPlayerModalFor('bowler');
        setShowPlayerModal(true);
      }, 400);
    }
  }, [oversCompleted]);

  // Prompt for player selection if needed
  useEffect(() => {
    if (!innings) return;
    if (!innings.currentBatsmen.striker) {
      setPlayerModalFor('striker');
      setShowPlayerModal(true);
    } else if (!innings.currentBatsmen.nonStriker) {
      setPlayerModalFor('nonStriker');
      setShowPlayerModal(true);
    } else if (!innings.currentBowler) {
      setPlayerModalFor('bowler');
      setShowPlayerModal(true);
    }
  }, [innings?.currentBatsmen.striker, innings?.currentBatsmen.nonStriker, innings?.currentBowler]);

  // Start recording for replay
  const startBallRecording = useCallback(() => {
    if (!cameraRef.current || !permission?.granted) return;
    try {
      setIsRecording(true);
      ballTrajectoryRef.current = [];
      // record() returns a promise that resolves with { uri } when recording stops
      recordingRef.current = cameraRef.current.record({ maxDuration: 8 });
    } catch (e) {
      setIsRecording(false);
    }
  }, [permission]);

  const stopBallRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return null;
    try {
      cameraRef.current.stopRecording();
      setIsRecording(false);
      // Await the promise from record() to get the URI
      const result = await recordingRef.current;
      recordingRef.current = null;
      return result?.uri || null;
    } catch (e) {
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);

  const handleReadyBall = () => {
    startBallRecording();
    dispatch(resetDetectionFlags());
    // Simulate trajectory updates for detection
    simulateDetection();
  };

  // Simulated detection (in production this uses real camera frame analysis)
  const simulateDetection = () => {
    if (!detectionActive) return;
    // Simulate some ball positions building a trajectory
    const traj = [];
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      traj.push({
        x: width * 0.5 + (Math.random() - 0.5) * 40,
        y: (height * 0.2) + (i / 20) * (height * 0.5),
        t: t0 + i * 30,
      });
    }
    ballTrajectoryRef.current = traj;
  };

  const handleOutcomePress = async (outcome) => {
    if (outcome === BALL_OUTCOMES.WICKET) {
      setPendingOutcome(outcome);
      setShowWicketModal(true);
      return;
    }
    await commitBall(outcome, null);
  };

  const handleWicketConfirm = async (wicketType) => {
    setShowWicketModal(false);
    await commitBall(BALL_OUTCOMES.WICKET, wicketType);
  };

  const commitBall = async (outcome, wicketType) => {
    const replayUri = await stopBallRecording();

    // Run detection analysis
    const calibration = {
      batsmanCalibrated: detection.batsmanCalibrated,
      batsmanShoulderY: detection.batsmanShoulderY,
      batsmanHeadY: detection.batsmanHeadY,
      batsmanFeetY: detection.batsmanFeetY,
      batsmanMidY: detection.batsmanMidY,
      batsmanHeightPx: detection.batsmanHeightPx,
      frameWidth: detection.frameWidth || width,
      frameHeight: detection.frameHeight || height,
      leftStumpX: detection.leftStumpX,
      rightStumpX: detection.rightStumpX,
    };

    const analysisResult = analyzeBallDelivery(
      ballTrajectoryRef.current,
      { bounceCount: bouncesInOver },
      calibration
    );

    // Auto-detect wide or no-ball and warn
    let finalOutcome = outcome;
    const detectionFlags = { ...analysisResult };

    // If system detected wide but umpire said otherwise, warn
    if (analysisResult.wideDetected && outcome !== BALL_OUTCOMES.WIDE) {
      dispatch(addAlert({
        id: Date.now().toString(),
        type: 'wide_detected',
        message: `⚠️ System detected WIDE (${Math.round(analysisResult.wideConfidence * 100)}% confidence). Ball went ${analysisResult.wideSide} side.`,
        severity: 'warning',
      }));
      Vibration.vibrate([0, 200, 100, 200]);
    }

    if ((analysisResult.noBallHeightDetected || analysisResult.noBallBounceDetected) &&
        outcome !== BALL_OUTCOMES.NO_BALL) {
      const reason = analysisResult.noBallBounceDetected
        ? `This is the ${bouncesInOver + 1 > CRICKET.MAX_BOUNCES_PER_OVER ? '2nd+ ' : ''}short-pitch ball!`
        : 'Ball exceeded batsman shoulder height!';
      dispatch(addAlert({
        id: Date.now().toString(),
        type: 'no_ball_detected',
        message: `🚨 NO BALL detected! ${reason}`,
        severity: 'danger',
      }));
      Vibration.vibrate([0, 300, 100, 300, 100, 300]);
    }

    // Track bounce in over
    if (analysisResult.bounceDetected) {
      dispatch(incrementBounceCount());
    }

    const batsmanId = innings?.currentBatsmen?.striker?.id;
    const bowlerId = innings?.currentBowler?.id;

    dispatch(recordBall({
      outcome: finalOutcome,
      wicketType,
      replayUri,
      detectionFlags,
      batsmanId,
      bowlerId,
    }));

    // Flash animation
    setLastBallFlash(finalOutcome);
    setTimeout(() => setLastBallFlash(null), 800);

    // If wicket - need new batsman
    if (finalOutcome === BALL_OUTCOMES.WICKET) {
      setPlayerModalFor('newBatsman');
      setShowPlayerModal(true);
    }

    // Over complete check handled by useEffect watching legalBalls

    // Show replay prompt
    if (replayUri) {
      setTimeout(() => {
        Alert.alert(
          '🎬 Replay Available',
          'Watch the replay for this ball?',
          [
            {
              text: 'Watch Now',
              onPress: () => router.push({ pathname: '/replay', params: { uri: replayUri } }),
            },
            { text: 'Skip', style: 'cancel' },
          ]
        );
      }, 600);
    }
  };

  const handlePlayerSelect = (player) => {
    setShowPlayerModal(false);
    if (playerModalFor === 'striker') {
      dispatch(setCurrentBatsmen({
        striker: player,
        nonStriker: innings?.currentBatsmen?.nonStriker,
      }));
    } else if (playerModalFor === 'nonStriker') {
      dispatch(setCurrentBatsmen({
        striker: innings?.currentBatsmen?.striker,
        nonStriker: player,
      }));
    } else if (playerModalFor === 'bowler') {
      dispatch(setCurrentBowler(player));
    } else if (playerModalFor === 'newBatsman') {
      // Replace striker (who got out)
      dispatch(setCurrentBatsmen({
        striker: player,
        nonStriker: innings?.currentBatsmen?.nonStriker,
      }));
    }
  };

  const currentStriker = innings?.currentBatsmen?.striker;
  const currentNonStriker = innings?.currentBatsmen?.nonStriker;
  const currentBowler = innings?.currentBowler;
  const striker_stats = innings?.batsmanStats?.[currentStriker?.id];
  const bowler_stats = innings?.bowlerStats?.[currentBowler?.id];

  // Inn 2 target
  const inn1Runs = match.innings[0]?.totalRuns || 0;
  const isSecondInnings = match.currentInningsIndex === 1;
  const target = isSecondInnings ? inn1Runs + 1 : null;
  const runsNeeded = target ? Math.max(0, target - totalRuns) : null;
  const ballsLeft = target ? Math.max(0, (match.totalOvers - oversCompleted) * 6 - legalBalls) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── TOP SCORE BAR ── */}
        <LinearGradient colors={[COLORS.bg_deep, COLORS.bg_card]} style={styles.topScoreBar}>
          <View style={styles.scoreBarLeft}>
            <Text style={styles.teamNameSmall}>{battingTeam?.name}</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.mainScore}>{totalRuns}/{totalWickets}</Text>
              <Text style={styles.oversText}>
                {oversCompleted}.{legalBalls} ov
              </Text>
            </View>
            {isSecondInnings && runsNeeded !== null && (
              <Text style={styles.targetText}>
                Need {runsNeeded} off {ballsLeft} balls
              </Text>
            )}
          </View>

          <View style={styles.scoreBarRight}>
            <TouchableOpacity
              onPress={() => router.push('/scorecard')}
              style={styles.topBarBtn}
            >
              <Ionicons name="stats-chart" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCameraVisible((v) => !v)}
              style={styles.topBarBtn}
            >
              <Ionicons
                name={cameraVisible ? 'camera' : 'camera-outline'}
                size={20}
                color={COLORS.text_secondary}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── ALERTS ── */}
        {alerts.map((alert) => (
          <AlertBanner
            key={alert.id}
            alert={alert}
            onDismiss={() => dispatch(clearAlerts())}
          />
        ))}

        {/* ── CAMERA PREVIEW ── */}
        {cameraVisible && permission?.granted && (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
            >
              {/* Detection overlay */}
              {detection.batsmanCalibrated && (
                <>
                  <View style={[styles.overlayLine, { top: detection.batsmanShoulderY, borderColor: COLORS.secondary }]} />
                  <View style={[styles.overlayLine, { top: detection.batsmanHeadY, borderColor: COLORS.primary }]} />
                </>
              )}
              {detection.stumpsCalibrated && (
                <>
                  <View style={[styles.overlayVLine, { left: detection.leftStumpX }]} />
                  <View style={[styles.overlayVLine, { left: detection.rightStumpX }]} />
                </>
              )}

              {/* Detection status chips */}
              <View style={styles.detectionChips}>
                <View style={[styles.chip, { backgroundColor: isRecording ? COLORS.danger_glow : COLORS.bg_card }]}>
                  <View style={[styles.recDot, { backgroundColor: isRecording ? COLORS.danger : COLORS.text_muted }]} />
                  <Text style={styles.chipText}>{isRecording ? 'REC' : 'STANDBY'}</Text>
                </View>
                <View style={[styles.chip, {
                  backgroundColor: detection.wideDetected ? COLORS.warning_glow : COLORS.bg_card
                }]}>
                  <Text style={[styles.chipText, { color: detection.wideDetected ? COLORS.warning : COLORS.text_muted }]}>
                    WIDE {detection.wideDetected ? '⚠️' : '✓'}
                  </Text>
                </View>
                <View style={[styles.chip, {
                  backgroundColor: (detection.noBallHeightDetected || detection.noBallBounceDetected) ? COLORS.danger_glow : COLORS.bg_card
                }]}>
                  <Text style={[styles.chipText, {
                    color: (detection.noBallHeightDetected || detection.noBallBounceDetected) ? COLORS.danger : COLORS.text_muted
                  }]}>
                    NB {(detection.noBallHeightDetected || detection.noBallBounceDetected) ? '🚨' : '✓'}
                  </Text>
                </View>
              </View>

              {/* Bounce counter */}
              <View style={styles.bounceChip}>
                <Text style={styles.bounceChipText}>
                  Bounces: {bouncesInOver}/{CRICKET.MAX_BOUNCES_PER_OVER}
                  {bouncesInOver >= CRICKET.MAX_BOUNCES_PER_OVER ? ' 🚨' : ''}
                </Text>
              </View>
            </CameraView>
          </View>
        )}

        {/* ── CURRENT PLAYERS ── */}
        <View style={styles.playersRow}>
          <TouchableOpacity
            style={styles.batsmanChip}
            onPress={() => { setPlayerModalFor('striker'); setShowPlayerModal(true); }}
          >
            <Text style={styles.batsmanRole}>🏏 Striker</Text>
            <Text style={styles.batsmanName} numberOfLines={1}>
              {currentStriker?.name || 'Select'}
            </Text>
            {striker_stats && (
              <Text style={styles.batsmanStats}>
                {striker_stats.runs}({striker_stats.balls})
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.vsBox}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <TouchableOpacity
            style={[styles.batsmanChip, { alignItems: 'flex-end' }]}
            onPress={() => { setPlayerModalFor('bowler'); setShowPlayerModal(true); }}
          >
            <Text style={styles.batsmanRole}>⚡ Bowler</Text>
            <Text style={styles.batsmanName} numberOfLines={1}>
              {currentBowler?.name || 'Select'}
            </Text>
            {bowler_stats && (
              <Text style={styles.batsmanStats}>
                {bowler_stats.overs}.{bowler_stats.balls} - {bowler_stats.runs}/{bowler_stats.wickets}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── BALL HISTORY OF CURRENT OVER ── */}
        <BallHistory balls={currentOver?.balls || []} />

        {/* ── READY BALL BUTTON ── */}
        <TouchableOpacity
          style={[styles.readyBtn, isRecording && styles.readyBtnActive]}
          onPress={handleReadyBall}
          disabled={isRecording}
        >
          <Ionicons name={isRecording ? 'radio-button-on' : 'play-circle'} size={20} color={isRecording ? COLORS.danger : COLORS.primary} />
          <Text style={[styles.readyBtnText, isRecording && { color: COLORS.danger }]}>
            {isRecording ? 'Recording... Score the ball below' : 'Tap to Ready Ball (starts recording)'}
          </Text>
        </TouchableOpacity>

        {/* ── SCORING BUTTONS ── */}
        <View style={styles.scoringGrid}>
          {SCORING_BUTTONS.map((btn) => (
            <TouchableOpacity
              key={btn.outcome}
              style={[
                styles.scoreBtn,
                { borderColor: btn.color },
                lastBallFlash === btn.outcome && { backgroundColor: btn.color },
              ]}
              onPress={() => handleOutcomePress(btn.outcome)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.scoreBtnLabel,
                  { color: lastBallFlash === btn.outcome ? '#000' : btn.color },
                ]}
              >
                {btn.label}
              </Text>
              <Text
                style={[
                  styles.scoreBtnSub,
                  { color: lastBallFlash === btn.outcome ? '#000' : COLORS.text_muted },
                ]}
              >
                {btn.sublabel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── WICKET TYPE MODAL ── */}
        <Modal
          visible={showWicketModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowWicketModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>🏏 Wicket Type</Text>
              {Object.values(WICKET_TYPES).map((wt) => (
                <TouchableOpacity
                  key={wt}
                  style={styles.wicketTypeBtn}
                  onPress={() => handleWicketConfirm(wt)}
                >
                  <Text style={styles.wicketTypeBtnText}>{wt}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowWicketModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── PLAYER SELECT MODAL ── */}
        <PlayerSelectModal
          visible={showPlayerModal}
          role={playerModalFor}
          teams={{ batting: battingTeam, bowling: bowlingTeam }}
          currentBatsmen={innings?.currentBatsmen}
          onSelect={handlePlayerSelect}
          onClose={() => setShowPlayerModal(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg_deep },
  container: { flex: 1, backgroundColor: COLORS.bg_deep },
  topScoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 12,
  },
  scoreBarLeft: { flex: 1 },
  teamNameSmall: { fontSize: 11, color: COLORS.text_muted, fontWeight: '600', letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  mainScore: { fontSize: 32, fontWeight: '900', color: COLORS.text_primary },
  oversText: { fontSize: 16, color: COLORS.text_secondary, fontWeight: '600' },
  targetText: { fontSize: 12, color: COLORS.warning, fontWeight: '700', marginTop: 2 },
  scoreBarRight: { flexDirection: 'row', gap: 8 },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.bg_card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cameraContainer: {
    height: height * 0.22,
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  overlayLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  overlayVLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.secondary,
    opacity: 0.7,
  },
  detectionChips: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  recDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 9, fontWeight: '800', color: COLORS.text_muted, letterSpacing: 0.5 },
  bounceChip: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bounceChipText: { fontSize: 10, fontWeight: '700', color: COLORS.text_primary },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  batsmanChip: {
    flex: 1,
    backgroundColor: COLORS.bg_card,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  batsmanRole: { fontSize: 9, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 0.5 },
  batsmanName: { fontSize: 13, fontWeight: '800', color: COLORS.text_primary, marginVertical: 2 },
  batsmanStats: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  vsBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg_elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: { fontSize: 10, fontWeight: '900', color: COLORS.text_muted },
  readyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bg_card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  readyBtnActive: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.danger_glow,
  },
  readyBtnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  scoringGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 6,
    paddingBottom: 8,
  },
  scoreBtn: {
    width: (width - 16 - 6 * 4) / 5,
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg_card,
    borderWidth: 1.5,
  },
  scoreBtnLabel: { fontSize: 18, fontWeight: '900' },
  scoreBtnSub: { fontSize: 8, fontWeight: '600', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bg_card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text_primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  wicketTypeBtn: {
    backgroundColor: COLORS.bg_elevated,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wicketTypeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text_primary,
  },
  cancelBtn: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: { fontSize: 15, color: COLORS.text_muted },
});
