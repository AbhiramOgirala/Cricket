import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Modal, Alert, ScrollView, Vibration, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  recordBall, addAlert, clearAlerts, setCurrentBatsmen, setCurrentBowler,
  selectCurrentInnings, selectCurrentOver, selectTotalRuns, selectTotalWickets,
  selectOversCompleted, selectLegalBallsInOver, selectBouncesInOver,
  selectAlerts, selectMatch, selectReviews, selectPendingReview,
  initiateReview, resolveReview, cancelReview,
} from '../src/store/slices/matchSlice';
import {
  resetDetectionFlags, incrementBounceCount, resetBounceCount,
  selectDetection, setAdaptiveZones, setDeviceTilt,
} from '../src/store/slices/detectionSlice';
import { COLORS, BALL_OUTCOMES, OUTCOME_COLORS, CRICKET, WICKET_TYPES, REVIEW_OUTCOMES } from '../src/constants';
import { analyzeBallDeliveryAuto, computeAdaptiveZones } from '../src/utils/autoDetection';
import AlertBanner from '../src/components/game/AlertBanner';
import BallHistory from '../src/components/game/BallHistory';
import PlayerSelectModal from '../src/components/game/PlayerSelectModal';
import ReviewModal from '../src/components/game/ReviewModal';
import ReviewBar from '../src/components/game/ReviewBar';

const { width, height } = Dimensions.get('window');
const CAMERA_HEIGHT = height * 0.42;

const SCORING_BUTTONS = [
  { outcome: BALL_OUTCOMES.DOT, label: '•', sublabel: 'Dot', color: COLORS.dot_ball },
  { outcome: BALL_OUTCOMES.ONE, label: '1', sublabel: 'Run', color: COLORS.single },
  { outcome: BALL_OUTCOMES.TWO, label: '2', sublabel: 'Runs', color: COLORS.double },
  { outcome: BALL_OUTCOMES.THREE, label: '3', sublabel: 'Runs', color: COLORS.triple },
  { outcome: BALL_OUTCOMES.FOUR, label: '4', sublabel: 'Boundary', color: COLORS.four },
  { outcome: BALL_OUTCOMES.SIX, label: '6', sublabel: 'Six!', color: COLORS.six },
  { outcome: BALL_OUTCOMES.WIDE, label: 'WD', sublabel: 'Wide', color: COLORS.wide },
  { outcome: BALL_OUTCOMES.NO_BALL, label: 'NB', sublabel: 'No Ball', color: COLORS.no_ball },
  { outcome: BALL_OUTCOMES.LBW, label: 'LBW', sublabel: 'LBW', color: COLORS.lbw },
  { outcome: BALL_OUTCOMES.WICKET, label: '🏏', sublabel: 'Wicket!', color: COLORS.wicket },
];

export default function ScoringScreen() {
  const dispatch = useDispatch();

  // ── Camera & Audio permissions ────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();
  const [audioPermission, requestAudioPermission] = useMicrophonePermissions();
  // Extra manual flag so we can force-show camera after user grants
  const [permissionGranted, setPermissionGranted] = useState(false);

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
  const reviews = useSelector(selectReviews);
  const pendingReview = useSelector(selectPendingReview);

  const [isRecording, setIsRecording] = useState(false);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [playerModalFor, setPlayerModalFor] = useState('striker');
  const [pendingOutcome, setPendingOutcome] = useState(null);
  const [lastBallFlash, setLastBallFlash] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTeamId, setReviewTeamId] = useState(null);

  const ballTrajectoryRef = useRef([]);
  const recordingRef = useRef(null);
  const lbwDataRef = useRef(null);

  const battingTeam = match.battingTeamId === match.team1.id ? match.team1 : match.team2;
  const bowlingTeam = match.bowlingTeamId === match.team1.id ? match.team1 : match.team2;

  // ── Permission handling ───────────────────────────────────────────────────
  // On mount: check if already granted (handles case where user granted before)
  useEffect(() => {
    (async () => {
      try {
        const cameraStatus = await Camera.getCameraPermissionsAsync();
        const audioStatus = await Camera.getMicrophonePermissionsAsync();
        
        if (cameraStatus.status === 'granted' && audioStatus.status === 'granted') {
          setPermissionGranted(true);
        } else if (cameraStatus.status === 'undetermined' || audioStatus.status === 'undetermined') {
          // Auto-request on first open
          const cameraResult = await Camera.requestCameraPermissionsAsync();
          const audioResult = await Camera.requestMicrophonePermissionsAsync();
          
          if (cameraResult.status === 'granted' && audioResult.status === 'granted') {
            setPermissionGranted(true);
          }
        }
      } catch (e) {
        console.warn('Permission check failed:', e);
      }
    })();
  }, []);

  // Sync with hook-based permission state
  useEffect(() => {
    if (permission?.granted && audioPermission?.granted) {
      setPermissionGranted(true);
    }
  }, [permission, audioPermission]);

  const handleRequestPermission = async () => {
    try {
      const cameraResult = await requestPermission();
      const audioResult = await requestAudioPermission();
      
      if (cameraResult?.granted && audioResult?.granted) {
        setPermissionGranted(true);
      } else {
        // Permission denied via hook - try the Camera API directly as fallback
        const directCameraResult = await Camera.requestCameraPermissionsAsync();
        const directAudioResult = await Camera.requestMicrophonePermissionsAsync();
        
        if (directCameraResult.status === 'granted' && directAudioResult.status === 'granted') {
          setPermissionGranted(true);
        } else {
          const missingPerms = [];
          if (directCameraResult.status !== 'granted') missingPerms.push('Camera');
          if (directAudioResult.status !== 'granted') missingPerms.push('Microphone');
          
          Alert.alert(
            'Permissions Required',
            `Please enable ${missingPerms.join(' and ')} access in your phone Settings → Apps → Gully Cricket → Permissions.`,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (e) {
      console.warn('Permission request error:', e);
    }
  };

  // Navigate to result when match complete
  useEffect(() => {
    if (match.status === 'complete') {
      router.replace('/result');
    }
  }, [match.status]);

  // Compute adaptive zones when camera starts
  useEffect(() => {
    const zones = computeAdaptiveZones(width, CAMERA_HEIGHT, detection.deviceTilt);
    dispatch(setAdaptiveZones(zones));
  }, [detection.deviceTilt]);

  // New over: prompt for bowler
  useEffect(() => {
    if (!innings) return;
    if (innings.currentOver?.isComplete === false && legalBalls === 0 && oversCompleted > 0) {
      dispatch(resetBounceCount());
      setTimeout(() => {
        setPlayerModalFor('bowler');
        setShowPlayerModal(true);
      }, 400);
    }
  }, [oversCompleted]);

  // Prompt for player selection
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

  // Open review modal when pendingReview is set
  useEffect(() => {
    if (pendingReview) {
      setShowReviewModal(true);
    }
  }, [pendingReview]);

  const startBallRecording = useCallback(() => {
    if (!cameraRef.current || !permissionGranted) return;
    try {
      setIsRecording(true);
      ballTrajectoryRef.current = [];
      lbwDataRef.current = null;
      recordingRef.current = cameraRef.current.recordAsync
        ? cameraRef.current.recordAsync({ maxDuration: 8 })
        : cameraRef.current.record({ maxDuration: 8 });
    } catch (e) {
      console.warn('Recording start error:', e);
      setIsRecording(false);
    }
  }, [permissionGranted]);

  const stopBallRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return null;
    try {
      if (cameraRef.current.stopRecording) {
        cameraRef.current.stopRecording();
      }
      setIsRecording(false);
      const result = await recordingRef.current;
      recordingRef.current = null;
      return result?.uri || null;
    } catch (e) {
      console.warn('Recording stop error:', e);
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);

  const simulateTrajectory = useCallback(() => {
    const zones = detection.zones || computeAdaptiveZones(width, CAMERA_HEIGHT, detection.deviceTilt);
    const traj = [];
    const t0 = Date.now();
    for (let i = 0; i < 24; i++) {
      const progress = i / 24;
      const drift = (Math.random() - 0.5) * width * 0.25;
      traj.push({
        x: zones.pitchCenterX + drift * progress,
        y: CAMERA_HEIGHT * 0.1 + progress * CAMERA_HEIGHT * 0.8,
        t: t0 + i * 25,
      });
    }
    ballTrajectoryRef.current = traj;
    return traj;
  }, [detection.zones, detection.deviceTilt]);

  const handleReadyBall = () => {
    startBallRecording();
    dispatch(resetDetectionFlags());
    simulateTrajectory();
  };

  const handleOutcomePress = async (outcome) => {
    if (outcome === BALL_OUTCOMES.WICKET) {
      setPendingOutcome(outcome);
      setShowWicketModal(true);
      return;
    }
    if (outcome === BALL_OUTCOMES.LBW) {
      await commitBall(BALL_OUTCOMES.LBW, 'LBW');
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
    const trajectory = ballTrajectoryRef.current;
    const zones = detection.zones || computeAdaptiveZones(width, CAMERA_HEIGHT, detection.deviceTilt);

    const analysisResult = analyzeBallDeliveryAuto(
      trajectory,
      { bounceCount: bouncesInOver },
      detection.deviceTilt,
      width,
      CAMERA_HEIGHT
    );

    lbwDataRef.current = analysisResult.lbwData;

    if (analysisResult.wideDetected && outcome !== BALL_OUTCOMES.WIDE) {
      dispatch(addAlert({
        id: Date.now().toString(),
        type: 'wide_detected',
        message: `⚠️ Wide detected (${Math.round(analysisResult.wideConfidence * 100)}% confidence) — ${analysisResult.wideSide} side`,
        severity: 'warning',
      }));
      Vibration.vibrate([0, 200, 100, 200]);
    }

    if ((analysisResult.noBallHeightDetected || analysisResult.noBallBounceDetected) &&
        outcome !== BALL_OUTCOMES.NO_BALL) {
      const reason = analysisResult.noBallBounceDetected
        ? `Short-pitch ball #${bouncesInOver + 1} in this over!`
        : 'Ball exceeded batsman shoulder height!';
      dispatch(addAlert({
        id: Date.now().toString(),
        type: 'no_ball_detected',
        message: `🚨 NO BALL! ${reason}`,
        severity: 'danger',
      }));
      Vibration.vibrate([0, 300, 100, 300, 100, 300]);
    }

    if (analysisResult.lbwPossible && outcome !== BALL_OUTCOMES.LBW && outcome !== BALL_OUTCOMES.WICKET) {
      dispatch(addAlert({
        id: Date.now().toString(),
        type: 'lbw_possible',
        message: `👆 LBW possible! Confidence: ${Math.round((analysisResult.lbwData?.confidence || 0) * 100)}%`,
        severity: 'info',
      }));
    }

    if (analysisResult.bounceDetected) dispatch(incrementBounceCount());

    const batsmanId = innings?.currentBatsmen?.striker?.id;
    const bowlerId = innings?.currentBowler?.id;

    dispatch(recordBall({
      outcome,
      wicketType,
      replayUri,
      detectionFlags: { ...analysisResult },
      batsmanId,
      bowlerId,
      lbwData: analysisResult.lbwData,
    }));

    setLastBallFlash(outcome);
    setTimeout(() => setLastBallFlash(null), 800);

    if (outcome === BALL_OUTCOMES.WICKET || outcome === BALL_OUTCOMES.LBW) {
      setPlayerModalFor('newBatsman');
      setShowPlayerModal(true);
    }

    if (replayUri) {
      setTimeout(() => {
        Alert.alert(
          '🎬 Replay Available',
          'Watch the replay for this ball?',
          [
            { text: 'Watch Now', onPress: () => router.push({ pathname: '/replay', params: { uri: replayUri } }) },
            { text: 'Skip', style: 'cancel' },
          ]
        );
      }, 600);
    }
  };

  const handlePlayerSelect = (player) => {
    setShowPlayerModal(false);
    if (playerModalFor === 'striker') {
      dispatch(setCurrentBatsmen({ striker: player, nonStriker: innings?.currentBatsmen?.nonStriker }));
    } else if (playerModalFor === 'nonStriker') {
      dispatch(setCurrentBatsmen({ striker: innings?.currentBatsmen?.striker, nonStriker: player }));
    } else if (playerModalFor === 'bowler') {
      dispatch(setCurrentBowler(player));
    } else if (playerModalFor === 'newBatsman') {
      dispatch(setCurrentBatsmen({ striker: player, nonStriker: innings?.currentBatsmen?.nonStriker }));
    }
  };

  const handleRequestReview = (teamId, teamName, reviewType) => {
    dispatch(initiateReview({
      reviewingTeamId: teamId,
      reviewingTeamName: teamName,
      reviewType,
      lastBall: match.lastBall,
    }));
  };

  const handleResolveReview = (outcome, reviewingTeamId) => {
    setShowReviewModal(false);
    dispatch(resolveReview({ outcome, reviewingTeamId }));
  };

  const currentStriker = innings?.currentBatsmen?.striker;
  const currentBowler = innings?.currentBowler;
  const striker_stats = innings?.batsmanStats?.[currentStriker?.id];
  const bowler_stats = innings?.bowlerStats?.[currentBowler?.id];

  const inn1Runs = match.innings[0]?.totalRuns || 0;
  const isSecondInnings = match.currentInningsIndex === 1;
  const target = isSecondInnings ? inn1Runs + 1 : null;
  const runsNeeded = target ? Math.max(0, target - totalRuns) : null;
  const ballsLeft = target ? Math.max(0, (match.totalOvers - oversCompleted) * 6 - legalBalls) : null;

  const zones = detection.zones;

  // ── Camera view renderer ──────────────────────────────────────────────────
  const renderCamera = () => {
    // Still loading permission status
    if (permission === null) {
      return (
        <View style={styles.noCameraWrap}>
          <Ionicons name="camera-outline" size={40} color={COLORS.text_muted} />
          <Text style={styles.noCameraText}>Loading camera...</Text>
        </View>
      );
    }

    // Permission granted — show live feed
    if (permissionGranted) {
      return (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          mode="video"
        >
          {/* Auto-detection overlay zones */}
          {zones && (
            <>
              <View style={[styles.overlayVLine, { left: zones.leftStumpX, borderColor: COLORS.secondary }]} />
              <View style={[styles.overlayVLine, { left: zones.rightStumpX, borderColor: COLORS.secondary }]} />
              <View style={[styles.overlayLine, { top: zones.shoulderY, borderColor: COLORS.warning }]} />
              <View style={[styles.wideZone, { left: 0, width: Math.max(0, zones.leftStumpX - zones.wideThresholdPx * 0.3) }]} />
              <View style={[styles.wideZone, { left: zones.rightStumpX + zones.wideThresholdPx * 0.3, right: 0 }]} />
            </>
          )}

          {/* Detection chips */}
          <View style={styles.detectionChips}>
            <View style={[styles.chip, { backgroundColor: isRecording ? COLORS.danger_glow : COLORS.bg_card }]}>
              <View style={[styles.recDot, { backgroundColor: isRecording ? COLORS.danger : COLORS.text_muted }]} />
              <Text style={styles.chipText}>{isRecording ? 'REC' : 'STANDBY'}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: detection.wideDetected ? COLORS.warning_glow : COLORS.bg_card }]}>
              <Text style={[styles.chipText, { color: detection.wideDetected ? COLORS.warning : COLORS.text_muted }]}>
                WD {detection.wideDetected ? '⚠️' : '✓'}
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

          {/* AUTO badge */}
          <View style={styles.autoDetectBadge}>
            <Ionicons name="eye" size={10} color={COLORS.primary} />
            <Text style={styles.autoDetectText}>AUTO</Text>
          </View>

          {/* Bounce counter */}
          <View style={styles.bounceChip}>
            <Text style={styles.bounceChipText}>
              Bounces: {bouncesInOver}/{CRICKET.MAX_BOUNCES_PER_OVER}
              {bouncesInOver >= CRICKET.MAX_BOUNCES_PER_OVER ? ' 🚨' : ''}
            </Text>
          </View>
        </CameraView>
      );
    }

    // Permission denied or not yet requested
    return (
      <View style={styles.noCameraWrap}>
        <Ionicons name="camera-outline" size={44} color={COLORS.primary} />
        <Text style={styles.noCameraTitle}>Camera & Microphone Access Needed</Text>
        <Text style={styles.noCameraText}>
          For auto wide, no-ball & LBW detection with video recording
        </Text>
        <TouchableOpacity style={styles.grantCameraBtn} onPress={handleRequestPermission}>
          <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.grantCameraBtnGrad}>
            <Ionicons name="camera" size={16} color="#000" />
            <Text style={styles.grantCameraBtnText}>Grant Permissions</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.manualModeNote}>
          Manual scoring works without camera
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── TOP SCORE BAR ── */}
        <LinearGradient colors={[COLORS.bg_deep, COLORS.bg_card]} style={styles.topScoreBar}>
          <View style={styles.scoreBarLeft}>
            <Text style={styles.teamNameSmall}>{battingTeam?.name}</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.mainScore}>{totalRuns}/{totalWickets}</Text>
              <Text style={styles.oversText}>{oversCompleted}.{legalBalls} ov</Text>
            </View>
            {isSecondInnings && runsNeeded !== null && (
              <Text style={styles.targetText}>Need {runsNeeded} off {ballsLeft} balls</Text>
            )}
          </View>
          <View style={styles.scoreBarRight}>
            <TouchableOpacity onPress={() => router.push('/scorecard')} style={styles.topBarBtn}>
              <Ionicons name="stats-chart" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── ALERTS ── */}
        {alerts.map((alert) => (
          <AlertBanner key={alert.id} alert={alert} onDismiss={() => dispatch(clearAlerts())} />
        ))}

        {/* ── CAMERA ── */}
        <View style={styles.cameraContainer}>
          {renderCamera()}
        </View>

        {/* ── CURRENT PLAYERS ── */}
        <View style={styles.playersRow}>
          <TouchableOpacity
            style={styles.batsmanChip}
            onPress={() => { setPlayerModalFor('striker'); setShowPlayerModal(true); }}
          >
            <Text style={styles.batsmanRole}>🏏 Striker</Text>
            <Text style={styles.batsmanName} numberOfLines={1}>{currentStriker?.name || 'Select'}</Text>
            {striker_stats && (
              <Text style={styles.batsmanStats}>{striker_stats.runs}({striker_stats.balls})</Text>
            )}
          </TouchableOpacity>

          <View style={styles.vsBox}><Text style={styles.vsText}>VS</Text></View>

          <TouchableOpacity
            style={[styles.batsmanChip, { alignItems: 'flex-end' }]}
            onPress={() => { setPlayerModalFor('bowler'); setShowPlayerModal(true); }}
          >
            <Text style={styles.batsmanRole}>⚡ Bowler</Text>
            <Text style={styles.batsmanName} numberOfLines={1}>{currentBowler?.name || 'Select'}</Text>
            {bowler_stats && (
              <Text style={styles.batsmanStats}>{bowler_stats.overs}.{bowler_stats.balls} - {bowler_stats.runs}/{bowler_stats.wickets}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── REVIEW BAR ── */}
        <ReviewBar
          reviews={reviews}
          battingTeamId={match.battingTeamId}
          bowlingTeamId={match.bowlingTeamId}
          teams={{ team1: match.team1, team2: match.team2 }}
          onRequestReview={handleRequestReview}
          lastBall={match.lastBall}
          disabled={!match.lastBall}
        />

        {/* ── BALL HISTORY ── */}
        <BallHistory balls={currentOver?.balls || []} />

        {/* ── READY BALL BUTTON ── */}
        <TouchableOpacity
          style={[styles.readyBtn, isRecording && styles.readyBtnActive]}
          onPress={handleReadyBall}
          disabled={isRecording}
        >
          <Ionicons name={isRecording ? 'radio-button-on' : 'play-circle'} size={20} color={isRecording ? COLORS.danger : COLORS.primary} />
          <Text style={[styles.readyBtnText, isRecording && { color: COLORS.danger }]}>
            {isRecording ? 'Recording… Score the ball below' : 'Tap to Ready Ball (starts recording)'}
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
              <Text style={[styles.scoreBtnLabel, { color: lastBallFlash === btn.outcome ? '#000' : btn.color }]}>
                {btn.label}
              </Text>
              <Text style={[styles.scoreBtnSub, { color: lastBallFlash === btn.outcome ? '#000' : COLORS.text_muted }]}>
                {btn.sublabel}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── WICKET TYPE MODAL ── */}
        <Modal visible={showWicketModal} transparent animationType="slide" onRequestClose={() => setShowWicketModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>🏏 Wicket Type</Text>
              {Object.values(WICKET_TYPES).map((wt) => (
                <TouchableOpacity key={wt} style={styles.wicketTypeBtn} onPress={() => handleWicketConfirm(wt)}>
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

        {/* ── DRS REVIEW MODAL ── */}
        <ReviewModal
          visible={showReviewModal}
          review={pendingReview}
          teamReviews={reviews?.[pendingReview?.teamId]}
          onResolve={handleResolveReview}
          onCancel={() => {
            setShowReviewModal(false);
            dispatch(cancelReview());
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const BTN_COUNT = 5;
const BTN_SIZE = (width - 16 - (BTN_COUNT - 1) * 6) / BTN_COUNT;

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
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.bg_card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  // ── CAMERA ──
  cameraContainer: {
    height: CAMERA_HEIGHT,
    backgroundColor: '#000',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    overflow: 'hidden',
  },
  camera: { flex: 1 },
  noCameraWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.bg_card,
    padding: 20,
  },
  noCameraTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text_primary },
  noCameraText: {
    fontSize: 12, color: COLORS.text_muted,
    textAlign: 'center', paddingHorizontal: 20,
  },
  manualModeNote: {
    fontSize: 11, color: COLORS.text_muted,
    textAlign: 'center', marginTop: 6,
    fontStyle: 'italic',
  },
  grantCameraBtn: { marginTop: 4 },
  grantCameraBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  grantCameraBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  overlayLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    borderTopWidth: 1.5, borderStyle: 'dashed', opacity: 0.8,
  },
  overlayVLine: {
    position: 'absolute', top: 0, bottom: 0, width: 1.5,
    opacity: 0.8,
  },
  wideZone: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: 'rgba(255,109,0,0.10)',
  },
  detectionChips: {
    flexDirection: 'row', gap: 5, padding: 8, flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 20,
  },
  recDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 9, fontWeight: '800', color: COLORS.text_muted, letterSpacing: 0.5 },
  autoDetectBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primary_glow,
    borderWidth: 1, borderColor: COLORS.primary,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  autoDetectText: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },
  bounceChip: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  bounceChipText: { fontSize: 10, fontWeight: '700', color: COLORS.text_primary },

  // ── PLAYERS ──
  playersRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, gap: 8,
  },
  batsmanChip: {
    flex: 1, backgroundColor: COLORS.bg_card,
    borderRadius: 10, padding: 9,
    borderWidth: 1, borderColor: COLORS.border,
  },
  batsmanRole: { fontSize: 9, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 0.5 },
  batsmanName: { fontSize: 13, fontWeight: '800', color: COLORS.text_primary, marginVertical: 1 },
  batsmanStats: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  vsBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.bg_elevated, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 9, fontWeight: '900', color: COLORS.text_muted },

  // ── READY BTN ──
  readyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.bg_card, borderWidth: 1, borderColor: COLORS.primary,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    marginHorizontal: 12, marginBottom: 6,
  },
  readyBtnActive: { borderColor: COLORS.danger, backgroundColor: COLORS.danger_glow },
  readyBtnText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.primary },

  // ── SCORING BUTTONS (2 rows of 5) ──
  scoringGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 8, gap: 6, paddingBottom: 6,
  },
  scoreBtn: {
    width: BTN_SIZE, aspectRatio: 1,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg_card, borderWidth: 1.5,
  },
  scoreBtnLabel: { fontSize: 16, fontWeight: '900' },
  scoreBtnSub: { fontSize: 7, fontWeight: '600', marginTop: 1 },

  // ── MODALS ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.bg_card, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, gap: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text_primary, marginBottom: 10, textAlign: 'center' },
  wicketTypeBtn: {
    backgroundColor: COLORS.bg_elevated, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  wicketTypeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.text_primary },
  cancelBtn: { marginTop: 4, alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 15, color: COLORS.text_muted },
});
