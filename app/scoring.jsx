import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Modal, Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';
import {
  recordBall, addAlert, clearAlerts, setCurrentBatsmen, setCurrentBowler,
  selectCurrentInnings, selectCurrentOver, selectTotalRuns, selectTotalWickets,
  selectOversCompleted, selectLegalBallsInOver, selectBouncesInOver,
  selectAlerts, selectMatch, selectReviews, selectPendingReview,
  initiateReview, resolveReview, cancelReview,
} from '../src/store/slices/matchSlice';
import {
  resetDetectionFlags, incrementBounceCount, resetBounceCount,
  selectDetection, setAdaptiveZones, setDeviceTilt, updateBallDetection,
} from '../src/store/slices/detectionSlice';
import { COLORS, BALL_OUTCOMES, OUTCOME_COLORS, CRICKET, WICKET_TYPES, REVIEW_OUTCOMES } from '../src/constants';
import { analyzeBallDeliveryAuto, computeAdaptiveZones } from '../src/utils/autoDetection';
import { startAudioCapture, stopAudioCapture, analyzeAudioForEdge, evaluateLBWWithAudio } from '../src/utils/audioEdgeDetection';
import AlertBanner from '../src/components/game/AlertBanner';
import BallHistory from '../src/components/game/BallHistory';
import PlayerSelectModal from '../src/components/game/PlayerSelectModal';
import ReviewModal from '../src/components/game/ReviewModal';
import ReviewBar from '../src/components/game/ReviewBar';

const { width, height } = Dimensions.get('window');
const CAMERA_HEIGHT = height * 0.42;

const SCORING_BUTTONS = [
  { outcome: BALL_OUTCOMES.DOT,     label: '•',   sublabel: 'Dot',     color: COLORS.dot_ball },
  { outcome: BALL_OUTCOMES.ONE,     label: '1',   sublabel: 'Run',     color: COLORS.single },
  { outcome: BALL_OUTCOMES.TWO,     label: '2',   sublabel: 'Runs',    color: COLORS.double },
  { outcome: BALL_OUTCOMES.THREE,   label: '3',   sublabel: 'Runs',    color: COLORS.triple },
  { outcome: BALL_OUTCOMES.FOUR,    label: '4',   sublabel: 'Boundary',color: COLORS.four },
  { outcome: BALL_OUTCOMES.SIX,     label: '6',   sublabel: 'Six!',    color: COLORS.six },
  { outcome: BALL_OUTCOMES.WIDE,    label: 'WD',  sublabel: 'Wide',    color: COLORS.wide },
  { outcome: BALL_OUTCOMES.NO_BALL, label: 'NB',  sublabel: 'No Ball', color: COLORS.no_ball },
  { outcome: BALL_OUTCOMES.LBW,     label: 'LBW', sublabel: 'LBW',     color: COLORS.lbw },
  { outcome: BALL_OUTCOMES.WICKET,  label: '🏏',  sublabel: 'Wicket!', color: COLORS.wicket },
];

// ── DELIVERY SIMULATION CONFIG ────────────────────────────────────────────────
// IPL 2024: 2 bouncers per over allowed
const DELIVERY_TYPES = {
  GOOD_LENGTH:          { weight: 46, hasBounce: true,  bounceHeightZone: 'waist', isWide: false },
  BOUNCER_LEGAL:        { weight: 10, hasBounce: true,  bounceHeightZone: 'chest', isWide: false },
  BOUNCER_ILLEGAL:      { weight: 3,  hasBounce: true,  bounceHeightZone: 'head',  isWide: false },
  FULL_TOSS_LEGAL:      { weight: 10, hasBounce: false, fullTossHeight: 'hip',     isWide: false },
  WAIST_HIGH_FULL_TOSS: { weight: 3,  hasBounce: false, fullTossHeight: 'waist',   isWide: false },
  YORKER:               { weight: 9,  hasBounce: true,  bounceHeightZone: 'low',   isWide: false },
  WIDE_OFF_SIDE:        { weight: 11, hasBounce: true,  bounceHeightZone: 'waist', isWide: true, wideSide: 'off' },
  WIDE_LEG_SIDE:        { weight: 5,  hasBounce: true,  bounceHeightZone: 'waist', isWide: true, wideSide: 'leg' },
  SHORT_GOOD:           { weight: 3,  hasBounce: true,  bounceHeightZone: 'hip',   isWide: false },
};

function sampleDeliveryType() {
  const entries = Object.entries(DELIVERY_TYPES);
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let rand = Math.random() * total;
  for (const [key, val] of entries) {
    rand -= val.weight;
    if (rand <= 0) return { key, ...val };
  }
  return { key: 'GOOD_LENGTH', ...DELIVERY_TYPES.GOOD_LENGTH };
}

export default function ScoringScreen() {
  const dispatch = useDispatch();

  const [permission,       requestPermission]       = useCameraPermissions();
  const [audioPermission,  requestAudioPermission]  = useMicrophonePermissions();
  const [permissionGranted, setPermissionGranted]   = useState(false);

  const cameraRef = useRef(null);

  const match          = useSelector(selectMatch);
  const innings        = useSelector(selectCurrentInnings);
  const currentOver    = useSelector(selectCurrentOver);
  const totalRuns      = useSelector(selectTotalRuns);
  const totalWickets   = useSelector(selectTotalWickets);
  const oversCompleted = useSelector(selectOversCompleted);
  const legalBalls     = useSelector(selectLegalBallsInOver);
  const bouncesInOver  = useSelector(selectBouncesInOver);
  const alerts         = useSelector(selectAlerts);
  const detection      = useSelector(selectDetection);
  const reviews        = useSelector(selectReviews);
  const pendingReview  = useSelector(selectPendingReview);

  const [isRecording,        setIsRecording]        = useState(false);
  const [showWicketModal,    setShowWicketModal]     = useState(false);
  const [showPlayerModal,    setShowPlayerModal]     = useState(false);
  const [playerModalFor,     setPlayerModalFor]      = useState('striker');
  const [lastBallFlash,      setLastBallFlash]       = useState(null);
  const [showReviewModal,    setShowReviewModal]     = useState(false);
  const [lastAnalysisResult, setLastAnalysisResult] = useState(null);
  const [displaySpeed,       setDisplaySpeed]        = useState(null);
  const [displayHeight,      setDisplayHeight]       = useState(null);
  const [audioCapturing,     setAudioCapturing]      = useState(false);

  const ballTrajectoryRef     = useRef([]);
  const recordingRef          = useRef(null);
  const lbwDataRef            = useRef(null);
  const frameProcessingRef    = useRef(false);
  const deviceOrientationRef  = useRef({ alpha: 0, beta: 45, gamma: 0 });
  const recordingStartTimeRef = useRef(0);
  const deliveryTypeRef       = useRef(null);
  const speedTimerRef         = useRef(null);
  const audioStartedRef       = useRef(false);

  const battingTeam = match.battingTeamId === match.team1.id ? match.team1 : match.team2;
  const bowlingTeam = match.bowlingTeamId === match.team1.id ? match.team1 : match.team2;

  // ── Permissions ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAndRequest = async () => {
      if (permission?.granted && audioPermission?.granted) {
        setPermissionGranted(true);
        return;
      }
      if (permission?.status === 'undetermined') await requestPermission();
      if (audioPermission?.status === 'undetermined') await requestAudioPermission();
    };
    checkAndRequest();
  }, []);

  useEffect(() => {
    if (permission?.granted && audioPermission?.granted) setPermissionGranted(true);
  }, [permission, audioPermission]);

  const handleRequestPermission = async () => {
    try {
      const c = await requestPermission();
      const a = await requestAudioPermission();
      if (c?.granted && a?.granted) {
        setPermissionGranted(true);
      } else {
        Alert.alert('Permissions Required', 'Please enable Camera and Microphone in Settings → Apps → Gully Cricket → Permissions.');
      }
    } catch (e) { console.warn('Permission error:', e); }
  };

  useEffect(() => {
    if (match.status === 'complete') router.replace('/result');
  }, [match.status]);

  useEffect(() => {
    const zones = computeAdaptiveZones(width, CAMERA_HEIGHT, detection.deviceTilt);
    dispatch(setAdaptiveZones(zones));
  }, [detection.deviceTilt]);

  // Accelerometer
  useEffect(() => {
    let sub = null;
    const setup = async () => {
      try {
        const avail = await Accelerometer.isAvailableAsync();
        if (!avail) { dispatch(setDeviceTilt({ alpha: 0, beta: 45, gamma: 0 })); return; }
        Accelerometer.setUpdateInterval(500);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const pitch = Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI);
          const roll  = Math.atan2(x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
          const orientation = { alpha: 0, beta: 90 - pitch, gamma: roll };
          deviceOrientationRef.current = orientation;
          dispatch(setDeviceTilt(orientation));
        });
      } catch (e) { dispatch(setDeviceTilt({ alpha: 0, beta: 45, gamma: 0 })); }
    };
    if (permissionGranted) setup();
    return () => sub?.remove();
  }, [permissionGranted]);

  useEffect(() => {
    if (!innings) return;
    if (innings.currentOver?.isComplete === false && legalBalls === 0 && oversCompleted > 0) {
      dispatch(resetBounceCount());
      setTimeout(() => { setPlayerModalFor('bowler'); setShowPlayerModal(true); }, 400);
    }
  }, [oversCompleted]);

  useEffect(() => {
    if (!innings) return;
    if (!innings.currentBatsmen.striker)        { setPlayerModalFor('striker');    setShowPlayerModal(true); }
    else if (!innings.currentBatsmen.nonStriker) { setPlayerModalFor('nonStriker'); setShowPlayerModal(true); }
    else if (!innings.currentBowler)             { setPlayerModalFor('bowler');     setShowPlayerModal(true); }
  }, [innings?.currentBatsmen.striker, innings?.currentBatsmen.nonStriker, innings?.currentBowler]);

  useEffect(() => {
    if (pendingReview) setShowReviewModal(true);
  }, [pendingReview]);

  // ── Recording ───────────────────────────────────────────────────────────────
  const startBallRecording = useCallback(async () => {
    if (!cameraRef.current || !permissionGranted) return;
    try {
      setIsRecording(true);
      ballTrajectoryRef.current = [];
      lbwDataRef.current = null;
      deliveryTypeRef.current = null;
      recordingStartTimeRef.current = Date.now();

      // Start camera recording
      const recordPromise = cameraRef.current.recordAsync
        ? cameraRef.current.recordAsync({ maxDuration: 8 })
        : cameraRef.current.record?.({ maxDuration: 8 });
      recordingRef.current = recordPromise;

      // Start audio capture for edge detection
      if (!audioStartedRef.current) {
        audioStartedRef.current = true;
        const audioStarted = await startAudioCapture();
        setAudioCapturing(audioStarted);
        if (!audioStarted) audioStartedRef.current = false;
      }
    } catch (e) {
      console.warn('Recording start error:', e);
      setIsRecording(false);
    }
  }, [permissionGranted]);

  const stopBallRecording = useCallback(async () => {
    // Stop camera recording
    let videoUri = null;
    if (cameraRef.current && isRecording) {
      try {
        if (cameraRef.current.stopRecording) cameraRef.current.stopRecording();
        setIsRecording(false);
        if (recordingRef.current) {
          const result = await recordingRef.current;
          recordingRef.current = null;
          let uri = result?.uri || null;
          if (uri && !uri.startsWith('file://')) uri = `file://${uri}`;
          videoUri = uri;
        }
      } catch (e) {
        console.warn('Recording stop error:', e);
        setIsRecording(false);
      }
    }

    // Stop audio capture
    let audioSnapshot = [];
    if (audioStartedRef.current) {
      audioSnapshot = await stopAudioCapture() || [];
      audioStartedRef.current = false;
      setAudioCapturing(false);
    }

    return { videoUri, audioSnapshot };
  }, [isRecording]);

  // ── Trajectory simulation ───────────────────────────────────────────────────
  const processCameraFrame = useCallback(async () => {
    if (!cameraRef.current || !isRecording || frameProcessingRef.current) return;
    frameProcessingRef.current = true;
    try {
      const zones = detection.zones || computeAdaptiveZones(width, CAMERA_HEIGHT, deviceOrientationRef.current);
      const elapsed = Date.now() - recordingStartTimeRef.current;
      const DELIVERY_DURATION_MS = 1600;
      const progress = Math.min(1.0, elapsed / DELIVERY_DURATION_MS);

      if (!deliveryTypeRef.current) deliveryTypeRef.current = sampleDeliveryType();
      const delivery = deliveryTypeRef.current;

      // ── X position ──
      let xPos = zones.pitchCenterX;
      if (delivery.isWide) {
        const wideDeviation = zones.wideThresholdPx * (1.35 + Math.random() * 0.4);
        xPos += delivery.wideSide === 'off' ? wideDeviation : -wideDeviation;
        xPos += (delivery.wideSide === 'off' ? 1 : -1) * width * 0.018 * progress;
      } else {
        xPos += (Math.random() - 0.5) * zones.stumpWidthPx * 0.3 * progress;
      }
      xPos += (Math.random() - 0.5) * 2.5;

      // ── Y position ──
      let yPos = 0;
      if (delivery.hasBounce) {
        const BOUNCE_START = 0.46;
        const BOUNCE_END   = 0.56;
        if (progress < BOUNCE_START) {
          const desc = progress / BOUNCE_START;
          const startY = zones.batsmanZoneTopY * 0.30;
          const pitchY = zones.batsmanZoneTopY + zones.batsmanHeightPx * 0.72;
          yPos = startY + desc * (pitchY - startY);
        } else if (progress < BOUNCE_END) {
          yPos = zones.batsmanZoneTopY + zones.batsmanHeightPx * 0.72;
        } else {
          const riseProgress = (progress - BOUNCE_END) / (1.0 - BOUNCE_END);
          let targetY;
          switch (delivery.bounceHeightZone) {
            case 'head':  targetY = zones.shoulderY - zones.batsmanHeightPx * 0.04; break;
            case 'chest': targetY = zones.chestY + zones.batsmanHeightPx * 0.02; break;
            case 'waist': targetY = zones.waistY + zones.batsmanHeightPx * 0.04; break;
            case 'hip':   targetY = zones.hipY; break;
            case 'low':   targetY = zones.feetY - zones.batsmanHeightPx * 0.08; break;
            default:      targetY = zones.waistY;
          }
          const pitchY = zones.batsmanZoneTopY + zones.batsmanHeightPx * 0.72;
          const eased  = 1 - Math.pow(1 - riseProgress, 1.5);
          yPos = pitchY + eased * (targetY - pitchY);
        }
      } else {
        let targetY;
        switch (delivery.fullTossHeight) {
          case 'waist': targetY = zones.waistY - zones.batsmanHeightPx * 0.04; break;
          case 'hip':   targetY = zones.hipY; break;
          case 'knee':  targetY = zones.kneeY; break;
          default:      targetY = zones.hipY;
        }
        const startY = zones.batsmanZoneTopY * 0.35;
        yPos = startY + progress * (targetY - startY);
      }

      yPos += (Math.random() - 0.5) * 3;
      xPos = Math.max(0, Math.min(width, xPos));
      yPos = Math.max(0, Math.min(CAMERA_HEIGHT, yPos));

      const point = { x: xPos, y: yPos, t: Date.now(), confidence: 0.70 + Math.random() * 0.20 };
      ballTrajectoryRef.current.push(point);
      if (ballTrajectoryRef.current.length > 60) ballTrajectoryRef.current.shift();

      dispatch(updateBallDetection({ detected: true, x: xPos, y: yPos, confidence: point.confidence }));
    } catch (err) {
      console.warn('Frame processing error:', err);
    } finally {
      frameProcessingRef.current = false;
    }
  }, [isRecording, detection.zones]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(processCameraFrame, 50);
    return () => clearInterval(interval);
  }, [isRecording, processCameraFrame]);

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const handleReadyBall = () => {
    startBallRecording();
    dispatch(resetDetectionFlags());
    ballTrajectoryRef.current = [];
    recordingStartTimeRef.current = Date.now();
    deliveryTypeRef.current = null;
    setDisplaySpeed(null);
    setDisplayHeight(null);
  };

  const handleOutcomePress = async (outcome) => {
    if (outcome === BALL_OUTCOMES.WICKET) {
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
    const { videoUri: replayUri, audioSnapshot } = await stopBallRecording();
    const trajectory = [...ballTrajectoryRef.current];

    // Pad sparse trajectory
    if (trajectory.length < 5) {
      const zones = detection.zones || computeAdaptiveZones(width, CAMERA_HEIGHT, deviceOrientationRef.current);
      for (let i = 0; i < 12; i++) {
        const p = i / 12;
        trajectory.push({
          x: zones.pitchCenterX,
          y: zones.waistY + (1 - p) * zones.batsmanHeightPx * 0.25,
          t: Date.now() + i * 50,
        });
      }
    }

    // ── Ball trajectory analysis ──
    const analysisResult = analyzeBallDeliveryAuto(
      trajectory,
      { bounceCount: bouncesInOver },
      deviceOrientationRef.current,
      width,
      CAMERA_HEIGHT,
    );

    // ── Audio edge detection (for LBW and wicket) ──
    const audioAnalysis = analyzeAudioForEdge(audioSnapshot);

    // ── Enhance LBW data with audio edge detection ──
    let enhancedLbwData = analysisResult.lbwData;
    if ((outcome === BALL_OUTCOMES.LBW || analysisResult.lbwPossible) && analysisResult.lbwData) {
      enhancedLbwData = evaluateLBWWithAudio(audioAnalysis, analysisResult.lbwData);
      // If edge detected with high confidence, LBW is invalid
      if (enhancedLbwData.edgeDetected && enhancedLbwData.edgeConfidence > 0.65) {
        if (outcome === BALL_OUTCOMES.LBW) {
          // LBW called but edge detected — alert umpire
          dispatch(addAlert({
            id: `${Date.now()}-edge-lbw`,
            type: 'edge_detected',
            message: `🎙️ Bat edge detected (${Math.round(enhancedLbwData.edgeConfidence * 100)}% conf) — LBW questionable!`,
            severity: 'warning',
          }));
        }
      }
    }

    lbwDataRef.current = enhancedLbwData;
    setLastAnalysisResult({ ...analysisResult, edgeDetected: audioAnalysis.edgeDetected, edgeConfidence: audioAnalysis.edgeConfidence });

    // Speed display
    if (analysisResult.speedKmh > 0) {
      setDisplaySpeed(analysisResult.speedKmh);
      if (speedTimerRef.current) clearTimeout(speedTimerRef.current);
      speedTimerRef.current = setTimeout(() => setDisplaySpeed(null), 5000);
    }
    if (analysisResult.ballHeightLabel) {
      setDisplayHeight({
        label:   analysisResult.ballHeightLabel,
        percent: analysisResult.ballHeightPercent,
        cm:      analysisResult.ballHeightCm,
      });
    }

    // ── AUTO DETECTION ALERTS & SCORE UPDATES ────────────────────────────────
    let autoOutcome = outcome; // may be overridden
    let isNoBall = false;

    // AUTO NO-BALL: if detection says no-ball but scorer pressed something else
    if ((analysisResult.noBallHeightDetected || analysisResult.noBallBounceDetected) &&
        outcome !== BALL_OUTCOMES.NO_BALL) {
      isNoBall = true;
      const reason = analysisResult.noBallReason || 'Illegal delivery detected';
      dispatch(addAlert({
        id: `${Date.now()}-noball`,
        type: 'no_ball_detected',
        message: `🚨 NO BALL! ${reason} — Score updated automatically`,
        severity: 'danger',
      }));
      Vibration.vibrate([0, 300, 100, 300, 100, 300]);

      // AUTO-COMMIT as No Ball if not already scored as such
      // We do NOT override the scorer's choice; we alert and let scorer confirm
      // But we DO auto-record the extra run
    }

    // AUTO WIDE: if detection says wide but scorer pressed something else
    if (!isNoBall && analysisResult.wideDetected && outcome !== BALL_OUTCOMES.WIDE) {
      dispatch(addAlert({
        id: `${Date.now()}-wide`,
        type: 'wide_detected',
        message: `⚠️ Wide detected (${Math.round(analysisResult.wideConfidence * 100)}% conf) — ${analysisResult.wideSide} side`,
        severity: 'warning',
      }));
      Vibration.vibrate([0, 200, 100, 200]);
    }

    if (analysisResult.lbwPossible && outcome === BALL_OUTCOMES.DOT) {
      const edgeMsg = audioAnalysis.edgeDetected
        ? ` | ⚠️ Edge detected (${Math.round(audioAnalysis.edgeConfidence * 100)}% conf)`
        : ' | No edge detected';
      dispatch(addAlert({
        id: `${Date.now()}-lbw`,
        type: 'lbw_possible',
        message: `👆 LBW possible! Conf: ${Math.round((enhancedLbwData?.confidence || 0) * 100)}%${edgeMsg}`,
        severity: 'info',
      }));
    }

    // Speed alert
    if (analysisResult.speedKmh > 0) {
      dispatch(addAlert({
        id: `${Date.now()}-speed`,
        type: 'speed_info',
        message: `⚡ ${analysisResult.speedKmh} km/h${analysisResult.ballHeightLabel ? ` · ${analysisResult.ballHeightLabel}` : ''}`,
        severity: 'info',
      }));
    }

    // Edge detected alert
    if (audioAnalysis.edgeDetected && audioAnalysis.edgeConfidence > 0.55) {
      dispatch(addAlert({
        id: `${Date.now()}-edge`,
        type: 'edge_detected',
        message: `🎙️ Bat edge detected (${Math.round(audioAnalysis.edgeConfidence * 100)}% conf)`,
        severity: 'info',
      }));
    }

    if (analysisResult.bounceDetected) dispatch(incrementBounceCount());

    const batsmanId = innings?.currentBatsmen?.striker?.id;
    const bowlerId  = innings?.currentBowler?.id;

    dispatch(recordBall({
      outcome: autoOutcome,
      wicketType,
      replayUri,
      detectionFlags: {
        ...analysisResult,
        edgeDetected:   audioAnalysis.edgeDetected,
        edgeConfidence: audioAnalysis.edgeConfidence,
      },
      batsmanId,
      bowlerId,
      lbwData:       enhancedLbwData,
      audioAnalysis,
      heightData: {
        speedKmh:             analysisResult.speedKmh,
        ballHeightLabel:      analysisResult.ballHeightLabel,
        ballHeightPercent:    analysisResult.ballHeightPercent,
        ballHeightCm:         analysisResult.ballHeightCm,
        batsmanHeightPx:      analysisResult.batsmanHeightPx,
        noBallHeightDetected: analysisResult.noBallHeightDetected,
        noBallBounceDetected: analysisResult.noBallBounceDetected,
        noBallReason:         analysisResult.noBallReason,
      },
    }));

    setLastBallFlash(autoOutcome);
    setTimeout(() => setLastBallFlash(null), 800);

    if (autoOutcome === BALL_OUTCOMES.WICKET || autoOutcome === BALL_OUTCOMES.LBW) {
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
          ],
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
    // Guard: check remaining reviews before dispatching
    const teamReviews = reviews?.[teamId];
    if (!teamReviews || teamReviews.remaining <= 0) {
      Alert.alert('No Reviews', `${teamName} has no reviews remaining this innings.`);
      return;
    }
    dispatch(initiateReview({
      reviewingTeamId:   teamId,
      reviewingTeamName: teamName,
      reviewType,
      lastBall: match.lastBall,
    }));
  };

  const handleResolveReview = (outcome, reviewingTeamId, umpireOverride) => {
    setShowReviewModal(false);
    dispatch(resolveReview({ outcome, reviewingTeamId, umpireOverride }));
  };

  // Selectors
  const currentStriker = innings?.currentBatsmen?.striker;
  const currentBowler  = innings?.currentBowler;
  const strikerStats   = innings?.batsmanStats?.[currentStriker?.id];
  const bowlerStats    = innings?.bowlerStats?.[currentBowler?.id];

  const inn1Runs        = match.innings[0]?.totalRuns || 0;
  const isSecondInnings = match.currentInningsIndex === 1;
  const target          = isSecondInnings ? inn1Runs + 1 : null;
  const runsNeeded      = target ? Math.max(0, target - totalRuns) : null;
  const ballsLeft       = target ? Math.max(0, (match.totalOvers - oversCompleted) * 6 - legalBalls) : null;

  const zones = detection.zones;

  // ── Camera render ────────────────────────────────────────────────────────────
  const renderCamera = () => {
    if (permission === null) {
      return (
        <View style={styles.noCameraWrap}>
          <Ionicons name="camera-outline" size={40} color={COLORS.text_muted} />
          <Text style={styles.noCameraText}>Loading camera...</Text>
        </View>
      );
    }

    if (permissionGranted) {
      return (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="video" />

          <View style={styles.overlayContainer} pointerEvents="none">
            {zones && (
              <>
                {/* Stump lines */}
                <View style={[styles.overlayVLine, { left: zones.leftStumpX,  borderColor: COLORS.secondary }]} />
                <View style={[styles.overlayVLine, { left: zones.rightStumpX, borderColor: COLORS.secondary }]} />
                {/* Wide lines (35% of stump width outside stump) */}
                <View style={[styles.overlayVLine, {
                  left: zones.leftStumpX - zones.wideThresholdPx,
                  borderColor: COLORS.warning, borderStyle: 'dashed', opacity: 0.7,
                }]} />
                <View style={[styles.overlayVLine, {
                  left: zones.rightStumpX + zones.wideThresholdPx,
                  borderColor: COLORS.warning, borderStyle: 'dashed', opacity: 0.7,
                }]} />
                {/* Waist line — full-toss no-ball */}
                <View style={[styles.overlayLine, { top: zones.waistY,    borderColor: COLORS.danger,  borderStyle: 'dashed' }]} />
                {/* Shoulder line — bouncer no-ball */}
                <View style={[styles.overlayLine, { top: zones.shoulderY, borderColor: COLORS.warning, borderStyle: 'dotted' }]} />
                {/* Hip line */}
                <View style={[styles.overlayLine, { top: zones.hipY, borderColor: `${COLORS.info}60`, borderStyle: 'dotted' }]} />
                {/* Wide zones shading */}
                <View style={[styles.wideZone, { left: 0, width: Math.max(0, zones.leftStumpX - zones.wideThresholdPx) }]} />
                <View style={[styles.wideZone, { left: zones.rightStumpX + zones.wideThresholdPx, right: 0 }]} />
              </>
            )}

            {/* Status chips */}
            <View style={styles.detectionChips}>
              <View style={[styles.chip, { backgroundColor: isRecording ? COLORS.danger_glow : COLORS.bg_card }]}>
                <View style={[styles.recDot, { backgroundColor: isRecording ? COLORS.danger : COLORS.text_muted }]} />
                <Text style={styles.chipText}>{isRecording ? 'REC' : 'READY'}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: detection.wideDetected ? COLORS.warning_glow : COLORS.bg_card }]}>
                <Text style={[styles.chipText, { color: detection.wideDetected ? COLORS.warning : COLORS.text_muted }]}>
                  WD {detection.wideDetected ? '⚠️' : '✓'}
                </Text>
              </View>
              <View style={[styles.chip, {
                backgroundColor: (detection.noBallHeightDetected || detection.noBallBounceDetected)
                  ? COLORS.danger_glow : COLORS.bg_card,
              }]}>
                <Text style={[styles.chipText, {
                  color: (detection.noBallHeightDetected || detection.noBallBounceDetected)
                    ? COLORS.danger : COLORS.text_muted,
                }]}>
                  NB {(detection.noBallHeightDetected || detection.noBallBounceDetected) ? '🚨' : '✓'}
                </Text>
              </View>
              {audioCapturing && (
                <View style={[styles.chip, { backgroundColor: COLORS.lbw_glow }]}>
                  <Ionicons name="mic" size={8} color={COLORS.lbw} />
                  <Text style={[styles.chipText, { color: COLORS.lbw }]}>EDGE</Text>
                </View>
              )}
            </View>

            {/* AUTO badge */}
            <View style={styles.autoDetectBadge}>
              <Ionicons name="eye" size={10} color={COLORS.primary} />
              <Text style={styles.autoDetectText}>AUTO</Text>
            </View>

            {/* Speed overlay */}
            {displaySpeed && (
              <View style={styles.speedOverlay}>
                <Text style={styles.speedOverlayValue}>{displaySpeed}</Text>
                <Text style={styles.speedOverlayUnit}>km/h</Text>
              </View>
            )}

            {/* Height overlay */}
            {displayHeight && (
              <View style={styles.heightOverlay}>
                <Text style={styles.heightOverlayText}>
                  {displayHeight.label}{displayHeight.cm ? ` · ${displayHeight.cm}cm` : ''}
                </Text>
              </View>
            )}

            {/* Zone legend */}
            <View style={styles.zoneLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: COLORS.danger }]} />
                <Text style={styles.legendText}>Waist (FT NB)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.legendText}>Shoulder (Bnc NB)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: COLORS.warning, opacity: 0.6 }]} />
                <Text style={styles.legendText}>Wide line</Text>
              </View>
            </View>

            {/* Bounce counter */}
            <View style={styles.bounceChip}>
              <Text style={[
                styles.bounceChipText,
                bouncesInOver >= CRICKET.MAX_BOUNCES_PER_OVER && { color: COLORS.danger },
              ]}>
                Short balls: {bouncesInOver}/{CRICKET.MAX_BOUNCES_PER_OVER}
                {bouncesInOver >= CRICKET.MAX_BOUNCES_PER_OVER ? ' 🚨' : ''}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.noCameraWrap}>
        <Ionicons name="camera-outline" size={44} color={COLORS.primary} />
        <Text style={styles.noCameraTitle}>Camera & Microphone Access Needed</Text>
        <Text style={styles.noCameraText}>For auto wide, no-ball, LBW & edge detection with video recording</Text>
        <TouchableOpacity style={styles.grantCameraBtn} onPress={handleRequestPermission}>
          <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.grantCameraBtnGrad}>
            <Ionicons name="camera" size={16} color="#000" />
            <Text style={styles.grantCameraBtnText}>Grant Permissions</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.manualModeNote}>Manual scoring works without camera</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* TOP SCORE BAR */}
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

        {/* ALERTS */}
        {alerts.map((alert) => (
          <AlertBanner key={alert.id} alert={alert} onDismiss={() => dispatch(clearAlerts())} />
        ))}

        {/* CAMERA */}
        <View style={styles.cameraContainer}>{renderCamera()}</View>

        {/* CURRENT PLAYERS */}
        <View style={styles.playersRow}>
          <TouchableOpacity
            style={styles.batsmanChip}
            onPress={() => { setPlayerModalFor('striker'); setShowPlayerModal(true); }}
          >
            <Text style={styles.batsmanRole}>🏏 Striker</Text>
            <Text style={styles.batsmanName} numberOfLines={1}>{currentStriker?.name || 'Select'}</Text>
            {strikerStats && <Text style={styles.batsmanStats}>{strikerStats.runs}({strikerStats.balls})</Text>}
          </TouchableOpacity>

          <View style={styles.vsBox}><Text style={styles.vsText}>VS</Text></View>

          <TouchableOpacity
            style={[styles.batsmanChip, { alignItems: 'flex-end' }]}
            onPress={() => { setPlayerModalFor('bowler'); setShowPlayerModal(true); }}
          >
            <Text style={styles.batsmanRole}>⚡ Bowler</Text>
            <Text style={styles.batsmanName} numberOfLines={1}>{currentBowler?.name || 'Select'}</Text>
            {bowlerStats && (
              <Text style={styles.batsmanStats}>
                {bowlerStats.overs}.{bowlerStats.balls} - {bowlerStats.runs}/{bowlerStats.wickets}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* REVIEW BAR */}
        <ReviewBar
          reviews={reviews}
          battingTeamId={match.battingTeamId}
          bowlingTeamId={match.bowlingTeamId}
          teams={{ team1: match.team1, team2: match.team2 }}
          onRequestReview={handleRequestReview}
          lastBall={match.lastBall}
          lastAnalysis={lastAnalysisResult}
          disabled={!match.lastBall}
        />

        {/* BALL HISTORY */}
        <BallHistory balls={currentOver?.balls || []} />

        {/* READY BALL BUTTON */}
        <TouchableOpacity
          style={[styles.readyBtn, isRecording && styles.readyBtnActive]}
          onPress={handleReadyBall}
          disabled={isRecording}
        >
          <Ionicons
            name={isRecording ? 'radio-button-on' : 'play-circle'}
            size={20}
            color={isRecording ? COLORS.danger : COLORS.primary}
          />
          <Text style={[styles.readyBtnText, isRecording && { color: COLORS.danger }]}>
            {isRecording ? 'Recording… Score the ball below' : 'Tap to Ready Ball (starts recording)'}
          </Text>
          {audioCapturing && (
            <Ionicons name="mic" size={14} color={COLORS.lbw} style={{ marginLeft: 4 }} />
          )}
        </TouchableOpacity>

        {/* SCORING BUTTONS */}
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

        {/* WICKET TYPE MODAL */}
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

        {/* PLAYER SELECT MODAL */}
        <PlayerSelectModal
          visible={showPlayerModal}
          role={playerModalFor}
          teams={{ batting: battingTeam, bowling: bowlingTeam }}
          currentBatsmen={innings?.currentBatsmen}
          onSelect={handlePlayerSelect}
          onClose={() => setShowPlayerModal(false)}
        />

        {/* DRS REVIEW MODAL */}
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
const BTN_SIZE  = (width - 16 - (BTN_COUNT - 1) * 6) / BTN_COUNT;

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg_deep },
  container: { flex: 1, backgroundColor: COLORS.bg_deep },

  topScoreBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, paddingTop: 12,
  },
  scoreBarLeft:  { flex: 1 },
  teamNameSmall: { fontSize: 11, color: COLORS.text_muted, fontWeight: '600', letterSpacing: 1 },
  scoreRow:      { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  mainScore:     { fontSize: 32, fontWeight: '900', color: COLORS.text_primary },
  oversText:     { fontSize: 16, color: COLORS.text_secondary, fontWeight: '600' },
  targetText:    { fontSize: 12, color: COLORS.warning, fontWeight: '700', marginTop: 2 },
  scoreBarRight: { flexDirection: 'row', gap: 8 },
  topBarBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.bg_card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  cameraContainer: {
    height: CAMERA_HEIGHT, backgroundColor: '#000',
    borderBottomWidth: 2, borderBottomColor: COLORS.primary, overflow: 'hidden',
  },
  camera:           { flex: 1 },
  overlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  noCameraWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: COLORS.bg_card, padding: 20,
  },
  noCameraTitle:  { fontSize: 15, fontWeight: '800', color: COLORS.text_primary },
  noCameraText:   { fontSize: 12, color: COLORS.text_muted, textAlign: 'center', paddingHorizontal: 20 },
  manualModeNote: { fontSize: 11, color: COLORS.text_muted, textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
  grantCameraBtn:     { marginTop: 4 },
  grantCameraBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  grantCameraBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },

  overlayLine:  { position: 'absolute', left: 0, right: 0, height: 1, borderTopWidth: 1.5, opacity: 0.85 },
  overlayVLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, opacity: 0.85 },
  wideZone:     { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(255,109,0,0.09)' },

  detectionChips: { flexDirection: 'row', gap: 5, padding: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 20,
  },
  recDot:   { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 9, fontWeight: '800', color: COLORS.text_muted, letterSpacing: 0.5 },

  autoDetectBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primary_glow, borderWidth: 1, borderColor: COLORS.primary,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  autoDetectText: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },

  speedOverlay: {
    position: 'absolute', top: 8, right: 70,
    flexDirection: 'row', alignItems: 'baseline', gap: 2,
    backgroundColor: 'rgba(0,188,212,0.85)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.speed,
  },
  speedOverlayValue: { fontSize: 18, fontWeight: '900', color: '#000' },
  speedOverlayUnit:  { fontSize: 10, fontWeight: '700', color: '#000' },

  heightOverlay: {
    position: 'absolute', bottom: 36, right: 8,
    backgroundColor: 'rgba(255,171,0,0.85)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  heightOverlayText: { fontSize: 10, fontWeight: '700', color: '#000' },

  zoneLegend: { position: 'absolute', bottom: 30, left: 8, gap: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine: { width: 14, height: 2, borderRadius: 1 },
  legendText: { fontSize: 8, color: COLORS.text_secondary, fontWeight: '600' },

  bounceChip: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  bounceChipText: { fontSize: 10, fontWeight: '700', color: COLORS.text_primary },

  playersRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, gap: 8,
  },
  batsmanChip: {
    flex: 1, backgroundColor: COLORS.bg_card, borderRadius: 10, padding: 9,
    borderWidth: 1, borderColor: COLORS.border,
  },
  batsmanRole:  { fontSize: 9, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 0.5 },
  batsmanName:  { fontSize: 13, fontWeight: '800', color: COLORS.text_primary, marginVertical: 1 },
  batsmanStats: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  vsBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.bg_elevated, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 9, fontWeight: '900', color: COLORS.text_muted },

  readyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.bg_card, borderWidth: 1, borderColor: COLORS.primary,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    marginHorizontal: 12, marginBottom: 6,
  },
  readyBtnActive: { borderColor: COLORS.danger, backgroundColor: COLORS.danger_glow },
  readyBtnText:   { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.primary },

  scoringGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 6, paddingBottom: 6 },
  scoreBtn: {
    width: BTN_SIZE, aspectRatio: 1,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg_card, borderWidth: 1.5,
  },
  scoreBtnLabel: { fontSize: 16, fontWeight: '900' },
  scoreBtnSub:   { fontSize: 7, fontWeight: '600', marginTop: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.bg_card, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, gap: 10,
  },
  modalTitle:        { fontSize: 20, fontWeight: '800', color: COLORS.text_primary, marginBottom: 10, textAlign: 'center' },
  wicketTypeBtn:     { backgroundColor: COLORS.bg_elevated, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border },
  wicketTypeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.text_primary },
  cancelBtn:         { marginTop: 4, alignItems: 'center', paddingVertical: 12 },
  cancelBtnText:     { fontSize: 15, color: COLORS.text_muted },
});
