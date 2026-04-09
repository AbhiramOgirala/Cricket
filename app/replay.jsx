import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { markReplayViewed, selectLastBall } from '../src/store/slices/matchSlice';
import { COLORS, OUTCOME_COLORS, BALL_OUTCOMES } from '../src/constants';

const { width, height } = Dimensions.get('window');

export default function ReplayScreen() {
  const dispatch = useDispatch();
  const params = useLocalSearchParams();
  const lastBall = useSelector(selectLastBall);
  const [hasWatched, setHasWatched] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const replayUri = params.uri || lastBall?.replayUri;

  const player = useVideoPlayer(replayUri || '', (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    if (!replayUri) {
      Alert.alert('No Replay', 'No replay available for this ball.');
      router.back();
    }
  }, [replayUri]);

  useEffect(() => {
    if (!player) return;
    const subscription = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
      if (!playing) {
        setHasWatched(true);
      }
    });
    return () => subscription.remove();
  }, [player]);

  const handlePlay = () => {
    if (!hasWatched) {
      player.play();
      setHasWatched(true);
    }
  };

  const handleClose = () => {
    dispatch(markReplayViewed());
    player.pause();
    router.back();
  };

  const outcomeColor = lastBall ? (OUTCOME_COLORS[lastBall.outcome] || COLORS.primary) : COLORS.primary;

  const getOutcomeLabel = (outcome) => {
    const map = {
      [BALL_OUTCOMES.DOT]: 'Dot Ball',
      [BALL_OUTCOMES.ONE]: '1 Run',
      [BALL_OUTCOMES.TWO]: '2 Runs',
      [BALL_OUTCOMES.THREE]: '3 Runs',
      [BALL_OUTCOMES.FOUR]: 'FOUR! 🔵',
      [BALL_OUTCOMES.SIX]: 'SIX! ⚡',
      [BALL_OUTCOMES.WIDE]: 'Wide Ball',
      [BALL_OUTCOMES.NO_BALL]: 'No Ball! 🚨',
      [BALL_OUTCOMES.WICKET]: 'WICKET! 🏏',
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
          <View style={{ width: 44 }} />
        </View>

        {/* One-time notice */}
        <View style={styles.noticeBanner}>
          <Ionicons name="information-circle" size={16} color={COLORS.warning} />
          <Text style={styles.noticeText}>
            This replay can only be viewed once and is not stored.
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
              {(lastBall.detectionFlags?.noBallHeightDetected || lastBall.detectionFlags?.noBallBounceDetected) && (
                <View style={[styles.flag, { backgroundColor: COLORS.danger_glow, borderColor: COLORS.danger }]}>
                  <Text style={[styles.flagText, { color: COLORS.danger }]}>No Ball Detected</Text>
                </View>
              )}
              {lastBall.isBounce && (
                <View style={[styles.flag, { backgroundColor: COLORS.info_glow, borderColor: COLORS.info }]}>
                  <Text style={[styles.flagText, { color: COLORS.info }]}>Short Pitch</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Video player */}
        <View style={styles.videoWrap}>
          {replayUri ? (
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={hasWatched}
            />
          ) : (
            <View style={styles.noVideoPlaceholder}>
              <Ionicons name="videocam-off" size={50} color={COLORS.text_muted} />
              <Text style={styles.noVideoText}>No video available</Text>
            </View>
          )}

          {/* Play overlay for first play */}
          {!hasWatched && !isPlaying && replayUri && (
            <TouchableOpacity style={styles.playOverlay} onPress={handlePlay}>
              <View style={styles.playCircle}>
                <Ionicons name="play" size={40} color="#000" />
              </View>
              <Text style={styles.playHint}>Tap to watch (one-time only)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Close button */}
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
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.bg_card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text_primary,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary_glow,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  ballInfoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.bg_card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    gap: 4,
  },
  overBallText: {
    fontSize: 11,
    color: COLORS.text_muted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  outcomeLabel: {
    fontSize: 24,
    fontWeight: '900',
  },
  wicketTypeText: {
    fontSize: 14,
    color: COLORS.text_secondary,
    fontWeight: '600',
  },
  flagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  flag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  flagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  videoWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    flex: 1,
  },
  noVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  noVideoText: {
    fontSize: 16,
    color: COLORS.text_muted,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  playCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHint: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  closeLargeBtn: {
    margin: 16,
    marginBottom: 24,
  },
  closeLargeBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  closeLargeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
});
