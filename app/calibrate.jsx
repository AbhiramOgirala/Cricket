import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Dimensions, ScrollView, Alert
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import {
  setBatsmanCalibration,
  setStumpsCalibration,
  selectDetection,
} from '../src/store/slices/detectionSlice';
import { COLORS } from '../src/constants';

const { width, height } = Dimensions.get('window');
const CAMERA_HEIGHT = height * 0.55;

export default function CalibrateScreen() {
  const dispatch = useDispatch();
  const detection = useSelector(selectDetection);
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState(0); // 0=intro, 1=batsman, 2=stumps, 3=done
  
  // Draggable calibration lines
  const [headY, setHeadY] = useState(CAMERA_HEIGHT * 0.1);
  const [shoulderY, setShoulderY] = useState(CAMERA_HEIGHT * 0.22);
  const [feetY, setFeetY] = useState(CAMERA_HEIGHT * 0.85);
  const [leftStumpX, setLeftStumpX] = useState(width * 0.38);
  const [rightStumpX, setRightStumpX] = useState(width * 0.62);
  const [stumpTopY, setStumpTopY] = useState(CAMERA_HEIGHT * 0.25);
  const [stumpBottomY, setStumpBottomY] = useState(CAMERA_HEIGHT * 0.85);

  const steps = [
    {
      title: 'Camera Setup',
      desc: 'Position yourself at the bowling crease. Point the phone camera toward the batsman.',
      icon: 'camera-outline',
    },
    {
      title: 'Calibrate Batsman Height',
      desc: 'Drag the lines to align with the batsman\'s head, shoulder, and feet. This helps detect no-balls and bounces.',
      icon: 'person-outline',
    },
    {
      title: 'Calibrate Stumps',
      desc: 'Drag the vertical lines to align with the left and right stumps. This helps detect wides.',
      icon: 'git-branch-outline',
    },
    {
      title: 'All Set!',
      desc: 'Calibration complete. You can recalibrate anytime from the scoring screen.',
      icon: 'checkmark-circle-outline',
    },
  ];

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleBatsmanConfirm = () => {
    dispatch(setBatsmanCalibration({
      heightPx: feetY - headY,
      shoulderY,
      headY,
      feetY,
      frameWidth: width,
      frameHeight: CAMERA_HEIGHT,
    }));
    setStep(2);
  };

  const handleStumpsConfirm = () => {
    dispatch(setStumpsCalibration({
      leftX: leftStumpX,
      rightX: rightStumpX,
      topY: stumpTopY,
      bottomY: stumpBottomY,
    }));
    setStep(3);
  };

  const handleSkip = () => {
    // Use default center calibration
    dispatch(setBatsmanCalibration({
      heightPx: CAMERA_HEIGHT * 0.75,
      shoulderY: CAMERA_HEIGHT * 0.22,
      headY: CAMERA_HEIGHT * 0.1,
      feetY: CAMERA_HEIGHT * 0.85,
      frameWidth: width,
      frameHeight: CAMERA_HEIGHT,
    }));
    dispatch(setStumpsCalibration({
      leftX: width * 0.38,
      rightX: width * 0.62,
      topY: CAMERA_HEIGHT * 0.25,
      bottomY: CAMERA_HEIGHT * 0.85,
    }));
    router.replace('/scoring');
  };

  const handleFinish = () => {
    router.replace('/scoring');
  };

  if (!permission) return <View style={styles.loading}><Text style={{ color: '#fff' }}>Loading...</Text></View>;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionWrap}>
          <Ionicons name="camera" size={60} color={COLORS.primary} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionDesc}>
            Gully Cricket needs camera access to detect wide balls, no-balls, and track ball trajectory.
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Text style={styles.grantBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipPermBtn} onPress={() => router.replace('/scoring')}>
            <Text style={styles.skipPermText}>Continue without camera (manual mode)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.bg_deep, COLORS.bg_dark]} style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Calibration</Text>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {[0, 1, 2, 3].map((s) => (
            <View
              key={s}
              style={[styles.stepDot, s <= step && styles.stepDotActive]}
            />
          ))}
        </View>

        {/* Camera preview with calibration overlay */}
        <View style={styles.cameraWrap}>
          <CameraView style={styles.camera} facing="back">
            {/* Batsman calibration lines */}
            {step === 1 && (
              <>
                {/* Head line */}
                <View style={[styles.calibLine, styles.calibLineGreen, { top: headY }]}>
                  <View style={styles.calibHandle} />
                  <Text style={styles.calibLabel}>HEAD</Text>
                </View>
                {/* Shoulder line */}
                <View style={[styles.calibLine, styles.calibLineYellow, { top: shoulderY }]}>
                  <View style={[styles.calibHandle, { backgroundColor: COLORS.secondary }]} />
                  <Text style={[styles.calibLabel, { color: COLORS.secondary }]}>SHOULDER</Text>
                </View>
                {/* Feet line */}
                <View style={[styles.calibLine, styles.calibLineRed, { top: feetY }]}>
                  <View style={[styles.calibHandle, { backgroundColor: COLORS.danger }]} />
                  <Text style={[styles.calibLabel, { color: COLORS.danger }]}>FEET</Text>
                </View>
                <Text style={styles.calibHint}>Drag lines to align with batsman</Text>
              </>
            )}

            {/* Stump calibration */}
            {step === 2 && (
              <>
                <View style={[styles.stumpLine, { left: leftStumpX }]}>
                  <Text style={styles.calibLabel}>L</Text>
                </View>
                <View style={[styles.stumpLine, { left: rightStumpX }]}>
                  <Text style={styles.calibLabel}>R</Text>
                </View>
                {/* Wide zone shading */}
                <View
                  style={[
                    styles.wideZone,
                    { left: 0, width: leftStumpX * 0.65, backgroundColor: 'rgba(255,109,0,0.15)' },
                  ]}
                />
                <View
                  style={[
                    styles.wideZone,
                    {
                      left: rightStumpX + (width - rightStumpX) * 0.35,
                      right: 0,
                      backgroundColor: 'rgba(255,109,0,0.15)',
                    },
                  ]}
                />
                <Text style={styles.calibHint}>Orange zones = Wide area</Text>
              </>
            )}

            {step === 3 && (
              <View style={styles.successOverlay}>
                <Ionicons name="checkmark-circle" size={80} color={COLORS.primary} />
                <Text style={styles.successText}>Calibration Complete!</Text>
              </View>
            )}
          </CameraView>
        </View>

        {/* Step info */}
        <View style={styles.stepInfo}>
          <View style={styles.stepIconWrap}>
            <Ionicons name={steps[step].icon} size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.stepTitle}>{steps[step].title}</Text>
          <Text style={styles.stepDesc}>{steps[step].desc}</Text>
        </View>

        {/* Slider controls for step 1 */}
        {step === 1 && (
          <View style={styles.sliderSection}>
            <Text style={styles.sliderNote}>Use +/- buttons to adjust lines:</Text>
            {[
              { label: 'Head Y', value: headY, setValue: setHeadY, color: COLORS.primary },
              { label: 'Shoulder Y', value: shoulderY, setValue: setShoulderY, color: COLORS.secondary },
              { label: 'Feet Y', value: feetY, setValue: setFeetY, color: COLORS.danger },
            ].map(({ label, value, setValue, color }) => (
              <View key={label} style={styles.adjRow}>
                <Text style={[styles.adjLabel, { color }]}>{label}</Text>
                <TouchableOpacity
                  style={styles.adjBtn}
                  onPress={() => setValue(Math.max(10, value - 10))}
                >
                  <Ionicons name="remove" size={18} color={color} />
                </TouchableOpacity>
                <Text style={[styles.adjValue, { color }]}>{Math.round(value)}</Text>
                <TouchableOpacity
                  style={styles.adjBtn}
                  onPress={() => setValue(Math.min(CAMERA_HEIGHT - 10, value + 10))}
                >
                  <Ionicons name="add" size={18} color={color} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Stump controls */}
        {step === 2 && (
          <View style={styles.sliderSection}>
            <Text style={styles.sliderNote}>Adjust stump positions:</Text>
            {[
              { label: 'Left Stump', value: leftStumpX, setValue: setLeftStumpX, color: COLORS.primary },
              { label: 'Right Stump', value: rightStumpX, setValue: setRightStumpX, color: COLORS.secondary },
            ].map(({ label, value, setValue, color }) => (
              <View key={label} style={styles.adjRow}>
                <Text style={[styles.adjLabel, { color }]}>{label}</Text>
                <TouchableOpacity
                  style={styles.adjBtn}
                  onPress={() => setValue(Math.max(10, value - 10))}
                >
                  <Ionicons name="remove" size={18} color={color} />
                </TouchableOpacity>
                <Text style={[styles.adjValue, { color }]}>{Math.round(value)}</Text>
                <TouchableOpacity
                  style={styles.adjBtn}
                  onPress={() => setValue(Math.min(width - 10, value + 10))}
                >
                  <Ionicons name="add" size={18} color={color} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {step === 0 && (
            <TouchableOpacity
              onPress={() => setStep(1)}
              activeOpacity={0.85}
              style={styles.actionBtnWrap}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primary_dim]}
                style={styles.actionBtn}
              >
                <Text style={styles.actionBtnText}>Start Calibration</Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          )}
          {step === 1 && (
            <TouchableOpacity
              onPress={handleBatsmanConfirm}
              activeOpacity={0.85}
              style={styles.actionBtnWrap}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Confirm & Next</Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity
              onPress={handleStumpsConfirm}
              activeOpacity={0.85}
              style={styles.actionBtnWrap}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Confirm Stumps</Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          )}
          {step === 3 && (
            <TouchableOpacity
              onPress={handleFinish}
              activeOpacity={0.85}
              style={styles.actionBtnWrap}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primary_dim]} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Start Scoring!</Text>
                <Ionicons name="play" size={20} color="#000" />
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
  loading: { flex: 1, backgroundColor: COLORS.bg_deep, alignItems: 'center', justifyContent: 'center' },
  permissionWrap: {
    flex: 1,
    backgroundColor: COLORS.bg_deep,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text_primary,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    color: COLORS.text_secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  grantBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 10,
  },
  grantBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  skipPermBtn: { marginTop: 8 },
  skipPermText: { color: COLORS.text_muted, fontSize: 13, textDecorationLine: 'underline' },
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
  skipText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  stepDotActive: { backgroundColor: COLORS.primary, width: 20 },
  cameraWrap: {
    height: CAMERA_HEIGHT,
    overflow: 'hidden',
    borderRadius: 0,
  },
  camera: { flex: 1 },
  calibLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  calibLineGreen: { backgroundColor: COLORS.primary },
  calibLineYellow: { backgroundColor: COLORS.secondary },
  calibLineRed: { backgroundColor: COLORS.danger },
  calibHandle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },
  calibLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    letterSpacing: 1,
  },
  calibHint: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    fontSize: 12,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stumpLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.secondary,
  },
  wideZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  successOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  stepInfo: {
    alignItems: 'center',
    padding: 16,
    gap: 6,
  },
  stepIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary_glow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 4,
  },
  stepTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text_primary },
  stepDesc: {
    fontSize: 13,
    color: COLORS.text_secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sliderSection: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sliderNote: { fontSize: 11, color: COLORS.text_muted, marginBottom: 4 },
  adjRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bg_card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adjLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  adjBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.bg_elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjValue: { width: 40, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionBtnWrap: {},
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  actionBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
