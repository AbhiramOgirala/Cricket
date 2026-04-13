import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { markReplayViewed, selectLastBall } from '../src/store/slices/matchSlice';
import { COLORS, OUTCOME_COLORS, BALL_OUTCOMES } from '../src/constants';

const { width, height } = Dimensions.get('window');

export default function ReplayScreen() {
  const dispatch  = useDispatch();
  const params    = useLocalSearchParams();
  const lastBall  = useSelector(selectLastBall);

  const [hasWatched, setHasWatched]   = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [videoError, setVideoError]   = useState(false);
  const [videoReady, setVideoReady]   = useState(false);

  const replayUri = params.uri || lastBall?.replayUri;

  // Create player — always call the hook, but only feed URI if we have one
  const player = useVideoPlayer(replayUri || null, (p) => {
    if (!replayUri) return;
    p.loop  = false;
    p.muted = false;
  });

  // Use proper useEventListener from expo (SDK 55 pattern)
  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    setIsPlaying(playing);
  });

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'readyToPlay') {
      setVideoReady(true);
      setVideoError(false);
    }
    if (status === 'error' || error) {
      setVideoError(true);
      setVideoReady(false);
    }
  });

  // If no URI at all, show error immediately
  useEffect(() => {
    if (!replayUri) {
      setVideoError(true);
    }
  }, [replayUri]);

  const handlePlay = useCallback(() => {
    if (!player || !videoReady) return;
    try {
      player.play();
      setHasWatched(true);
    } catch (e) {
      setVideoError(true);
    }
  }, [player, videoReady]);

  const handleClose = useCallback(() => {
    dispatch(markReplayViewed());
    try { if (player) player.pause(); } catch (_) {}
    router.back();
  }, [dispatch, player]);

  const outcomeColor = lastBall
    ? (OUTCOME_COLORS[lastBall.outcome] || COLORS.primary)
    : COLORS.primary;

  const getOutcomeLabel = (outcome) => {
    const map = {
      [BALL_OUTCOMES.DOT]:     'Dot Ball',
      [BALL_OUTCOMES.ONE]:     '1 Run',
      [BALL_OUTCOMES.TWO]:     '2 Runs',
      [BALL_OUTCOMES.THREE]:   '3 Runs',
      [BALL_OUTCOMES.FOUR]:    'FOUR! 🔵',
      [BALL_OUTCOMES.SIX]:     'SIX! ⚡',
      [BALL_OUTCOMES.WIDE]:    'Wide Ball',
      [BALL_OUTCOMES.NO_BALL]: 'No Ball! 🚨',
      [BALL_OUTCOMES.WICKET]:  'WICKET! 🏏',
      [BALL_OUTCOMES.LBW]:     'LBW! 🏏',
    };
    return map[outcome] || outcome;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#000', COLORS.bg_deep]} style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.title}>🎬 Ball Replay</Text>
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={COLORS.text_muted} />
          </TouchableOpacity>
        </View>

        {/* One-time notice */}
        <View style={styles.noticeBanner}>
          <Ionicons name="information-circle" size={16} color={COLORS.warning} />
          <Text style={styles.noticeText}>
            Replay is only available once and is not stored permanently.
          </Text>
        </View>

        {/* Ball info */}
        {lastBall && (
          <View style={[styles.ballInfoCard, { borderColor: outcomeColor }]}>
            <Text style={styles.overBallText}>
              Over {lastBall.overNumber}.{lastBall.ballNumber}
            </Text>
            <Text style={[styles.outcomeLabel, { color: outcomeColor }]}>
              {getOutcomeLabel(lastBall.outcome)}
            </Text>
            {lastBall.wicketType && (
              <Text style={styles.wicketTypeText}>{lastBall.wicketType}</Text>
            )}

            {/* Detection flags */}
            <View style={styles.flagsRow}>
              {lastBall.detectionFlags?.wideDetected && (
                <View style={[styles.flag, { backgroundColor: COLORS.warning_glow, borderColor: COLORS.warning }]}>
                  <Text style={[styles.flagText, { color: COLORS.warning }]}>Wide Detected</Text>
                </View>
              )}
              {(lastBall.detectionFlags?.noBallHeightDetected ||
                lastBall.detectionFlags?.noBallBounceDetected) && (
                <View style={[styles.flag, { backgroundColor: COLORS.danger_glow, borderColor: COLORS.danger }]}>
                  <Text style={[styles.flagText, { color: COLORS.danger }]}>
                    No Ball — {lastBall.detectionFlags.noBallBounceDetected
                      ? 'Short Pitch'
                      : 'Height'}
                  </Text>
                </View>
              )}
              {lastBall.isBounce && (
                <View style={[styles.flag, { backgroundColor: COLORS.info_glow, borderColor: COLORS.info }]}>
                  <Text style={[styles.flagText, { color: COLORS.info }]}>Short Pitch</Text>
                </View>
              )}
              {lastBall.detectionFlags?.edgeDetected && (
                <View style={[styles.flag, { backgroundColor: COLORS.lbw_glow, borderColor: COLORS.lbw }]}>
                  <Text style={[styles.flagText, { color: COLORS.lbw }]}>Edge Detected 🎙️</Text>
                </View>
              )}
            </View>

            {/* Speed & height */}
            {lastBall.heightData?.speedKmh > 0 && (
              <Text style={styles.speedText}>⚡ {lastBall.heightData.speedKmh} km/h
                {lastBall.heightData.ballHeightLabel ? ` · ${lastBall.heightData.ballHeightLabel}` : ''}
              </Text>
            )}
          </View>
        )}

        {/* Video player area */}
        <View style={styles.videoWrap}>
          {replayUri && !videoError ? (
            <>
              <VideoView
                player={player}
                style={styles.video}
                contentFit="contain"
                nativeControls={hasWatched}
              />

              {/* Play overlay — shown until first play */}
              {!hasWatched && !isPlaying && videoReady && (
                <TouchableOpacity
                  style={styles.playOverlay}
                  onPress={handlePlay}
                  activeOpacity={0.85}
                >
                  <View style={styles.playCircle}>
                    <Ionicons name="play" size={40} color="#000" />
                  </View>
                  <View style={styles.playHintWrap}>
                    <Text style={styles.playHint}>Tap to watch replay</Text>
                    <Text style={styles.playHintSub}>(one-time only)</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Loading — before video ready */}
              {!videoReady && !hasWatched && !videoError && (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading replay…</Text>
                </View>
              )}
            </>
          ) : (
            /* No video / error fallback */
            <View style={styles.noVideoPlaceholder}>
              <Ionicons name="warning-outline" size={52} color={COLORS.text_muted} />
              <Text style={styles.noVideoTitle}>Video Unavailable</Text>
              <Text style={styles.noVideoText}>
                {!replayUri
                  ? 'No replay was recorded for this ball. Score a ball while the camera is recording to capture a replay.'
                  : 'The video file could not be loaded. This can happen if the file was too short or the recording failed.'}
              </Text>
            </View>
          )}
        </View>

        {/* Back button */}
        <TouchableOpacity
          style={styles.closeLargeBtn}
          onPress={handleClose}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primary_dim]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.closeLargeBtnInner}
          >
            <Ionicons name="arrow-back" size={20} color="#000" />
            <Text style={styles.closeLargeBtnText}>Back to Scoring</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.bg_card, alignItems: 'center', justifyContent: 'center',
  },
  settingsBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.bg_card, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text_primary },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.secondary_glow, borderWidth: 1, borderColor: COLORS.secondary,
    borderRadius: 10, marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  noticeText: { flex: 1, fontSize: 11, color: COLORS.secondary, fontWeight: '600' },

  ballInfoCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: COLORS.bg_card, borderRadius: 14, padding: 16, borderWidth: 1.5, gap: 4,
  },
  overBallText:   { fontSize: 11, color: COLORS.text_muted, fontWeight: '700', letterSpacing: 1 },
  outcomeLabel:   { fontSize: 24, fontWeight: '900' },
  wicketTypeText: { fontSize: 14, color: COLORS.text_secondary, fontWeight: '600' },
  speedText:      { fontSize: 12, color: COLORS.speed, fontWeight: '700', marginTop: 4 },
  flagsRow:       { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  flag: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  flagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  videoWrap: {
    flex: 1, marginHorizontal: 16, borderRadius: 16,
    overflow: 'hidden', backgroundColor: '#000', position: 'relative',
  },
  video: { flex: 1 },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  playCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  playHintWrap: { alignItems: 'center', gap: 4 },
  playHint:     { fontSize: 14, color: '#fff', fontWeight: '700' },
  playHintSub:  { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: { fontSize: 14, color: COLORS.text_secondary, fontWeight: '600' },

  noVideoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: 30,
  },
  noVideoTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text_primary },
  noVideoText: {
    fontSize: 13, color: COLORS.text_muted,
    textAlign: 'center', lineHeight: 20,
  },

  closeLargeBtn:      { margin: 16, marginBottom: 24 },
  closeLargeBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 14, paddingVertical: 16,
  },
  closeLargeBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
