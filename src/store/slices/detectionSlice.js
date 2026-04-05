import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isDetecting: false,
  isRecording: false,

  // Auto-detected adaptive zones (no manual calibration)
  zones: null, // { pitchCenterX, leftStumpX, rightStumpX, shoulderY, ... }

  // Device orientation (for adaptive zone computation)
  deviceTilt: { alpha: 0, beta: 45, gamma: 0 },

  // Live detection results
  ballDetected: false,
  ballX: 0,
  ballY: 0,
  ballConfidence: 0,

  // Trajectory
  ballTrajectory: [],
  pitchPoint: null,
  bounceDetected: false,
  bounceHeight: 0,
  bounceCount: 0,

  // Live decision flags
  wideDetected: false,
  wideConfidence: 0,
  noBallHeightDetected: false,
  noBallHeightConfidence: 0,
  noBallBounceDetected: false,
  noBallBounceConfidence: 0,
  lbwPossible: false,
  lbwData: null,

  // Settings
  detectionSensitivity: 0.65,
  showOverlay: true,
  mirrorMode: false,
};

const detectionSlice = createSlice({
  name: 'detection',
  initialState,
  reducers: {
    // Auto zones - set from camera frame analysis
    setAdaptiveZones: (state, action) => {
      state.zones = action.payload;
    },

    setDeviceTilt: (state, action) => {
      state.deviceTilt = action.payload;
    },

    updateBallDetection: (state, action) => {
      const { detected, x, y, confidence } = action.payload;
      state.ballDetected = detected;
      state.ballX = x;
      state.ballY = y;
      state.ballConfidence = confidence;

      if (detected) {
        state.ballTrajectory.push({ x, y, t: Date.now() });
        if (state.ballTrajectory.length > 60) state.ballTrajectory.shift();
      }
    },

    updateDecisionFlags: (state, action) => {
      const {
        wideDetected, wideConfidence,
        noBallHeightDetected, noBallHeightConfidence,
        noBallBounceDetected, noBallBounceConfidence,
        bounceDetected, bounceHeight,
        lbwPossible, lbwData,
      } = action.payload;

      state.wideDetected = wideDetected ?? state.wideDetected;
      state.wideConfidence = wideConfidence ?? state.wideConfidence;
      state.noBallHeightDetected = noBallHeightDetected ?? state.noBallHeightDetected;
      state.noBallHeightConfidence = noBallHeightConfidence ?? state.noBallHeightConfidence;
      state.noBallBounceDetected = noBallBounceDetected ?? state.noBallBounceDetected;
      state.noBallBounceConfidence = noBallBounceConfidence ?? state.noBallBounceConfidence;
      state.bounceDetected = bounceDetected ?? state.bounceDetected;
      state.bounceHeight = bounceHeight ?? state.bounceHeight;
      state.lbwPossible = lbwPossible ?? state.lbwPossible;
      state.lbwData = lbwData ?? state.lbwData;
    },

    incrementBounceCount: (state) => { state.bounceCount += 1; },
    resetBounceCount: (state) => { state.bounceCount = 0; },

    resetDetectionFlags: (state) => {
      state.wideDetected = false;
      state.wideConfidence = 0;
      state.noBallHeightDetected = false;
      state.noBallHeightConfidence = 0;
      state.noBallBounceDetected = false;
      state.noBallBounceConfidence = 0;
      state.bounceDetected = false;
      state.bounceHeight = 0;
      state.lbwPossible = false;
      state.lbwData = null;
      state.ballTrajectory = [];
      state.pitchPoint = null;
    },

    setIsDetecting: (state, action) => { state.isDetecting = action.payload; },
    setIsRecording: (state, action) => { state.isRecording = action.payload; },
    toggleOverlay: (state) => { state.showOverlay = !state.showOverlay; },
    setDetectionSensitivity: (state, action) => { state.detectionSensitivity = action.payload; },
    setPitchPoint: (state, action) => { state.pitchPoint = action.payload; },
    // Keep for backwards compatibility (result.jsx imports this)
    resetCalibration: (state) => {
      state.zones = null;
      state.bounceCount = 0;
    },
  },
});

export const {
  setAdaptiveZones,
  setDeviceTilt,
  updateBallDetection,
  updateDecisionFlags,
  incrementBounceCount,
  resetBounceCount,
  resetDetectionFlags,
  setIsDetecting,
  setIsRecording,
  toggleOverlay,
  setDetectionSensitivity,
  setPitchPoint,
  resetCalibration,
} = detectionSlice.actions;

export const selectDetection = (state) => state.detection;
export const selectBounceCount = (state) => state.detection.bounceCount;
export const selectWideDetected = (state) => state.detection.wideDetected;
export const selectLBWPossible = (state) => state.detection.lbwPossible;
export const selectAdaptiveZones = (state) => state.detection.zones;
export const selectNoBallDetected = (state) =>
  state.detection.noBallHeightDetected || state.detection.noBallBounceDetected;

export default detectionSlice.reducer;
