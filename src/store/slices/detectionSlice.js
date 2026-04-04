import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isDetecting: false,
  isRecording: false,

  // Batsman calibration
  batsmanCalibrated: false,
  batsmanHeightPx: 0,          // pixel height of batsman in frame
  batsmanShoulderY: 0,         // Y pixel for shoulder line
  batsmanHeadY: 0,             // Y pixel for head
  batsmanFeetY: 0,             // Y pixel for feet
  batsmanMidY: 0,              // Y pixel mid (chest)
  frameWidth: 0,
  frameHeight: 0,

  // Stump calibration
  stumpsCalibrated: false,
  leftStumpX: 0,
  rightStumpX: 0,
  stumpTopY: 0,
  stumpBottomY: 0,

  // Live detection results
  ballDetected: false,
  ballX: 0,
  ballY: 0,
  ballConfidence: 0,

  // Trajectory analysis
  ballTrajectory: [],         // [{x, y, t}] for last 30 frames
  pitchPoint: null,           // Where ball pitched
  bounceDetected: false,
  bounceHeight: 0,
  bounceCount: 0,             // in current over

  // Live decision flags
  wideDetected: false,
  wideConfidence: 0,
  noBallHeightDetected: false,
  noBallHeightConfidence: 0,
  noBallBounceDetected: false,
  noBallBounceConfidence: 0,

  // Detection settings
  detectionSensitivity: 0.65,
  showOverlay: true,
  showTrajectory: true,
  showZones: true,
  mirrorMode: false,
};

const detectionSlice = createSlice({
  name: 'detection',
  initialState,
  reducers: {
    setBatsmanCalibration: (state, action) => {
      const { heightPx, shoulderY, headY, feetY, frameWidth, frameHeight } = action.payload;
      state.batsmanCalibrated = true;
      state.batsmanHeightPx = heightPx;
      state.batsmanShoulderY = shoulderY;
      state.batsmanHeadY = headY;
      state.batsmanFeetY = feetY;
      state.batsmanMidY = (shoulderY + feetY) / 2;
      state.frameWidth = frameWidth;
      state.frameHeight = frameHeight;
    },

    setStumpsCalibration: (state, action) => {
      const { leftX, rightX, topY, bottomY } = action.payload;
      state.stumpsCalibrated = true;
      state.leftStumpX = leftX;
      state.rightStumpX = rightX;
      state.stumpTopY = topY;
      state.stumpBottomY = bottomY;
    },

    updateBallDetection: (state, action) => {
      const { detected, x, y, confidence } = action.payload;
      state.ballDetected = detected;
      state.ballX = x;
      state.ballY = y;
      state.ballConfidence = confidence;

      if (detected) {
        state.ballTrajectory.push({ x, y, t: Date.now() });
        if (state.ballTrajectory.length > 60) {
          state.ballTrajectory.shift();
        }
      }
    },

    updateDecisionFlags: (state, action) => {
      const {
        wideDetected, wideConfidence,
        noBallHeightDetected, noBallHeightConfidence,
        noBallBounceDetected, noBallBounceConfidence,
        bounceDetected, bounceHeight,
      } = action.payload;

      state.wideDetected = wideDetected ?? state.wideDetected;
      state.wideConfidence = wideConfidence ?? state.wideConfidence;
      state.noBallHeightDetected = noBallHeightDetected ?? state.noBallHeightDetected;
      state.noBallHeightConfidence = noBallHeightConfidence ?? state.noBallHeightConfidence;
      state.noBallBounceDetected = noBallBounceDetected ?? state.noBallBounceDetected;
      state.noBallBounceConfidence = noBallBounceConfidence ?? state.noBallBounceConfidence;
      state.bounceDetected = bounceDetected ?? state.bounceDetected;
      state.bounceHeight = bounceHeight ?? state.bounceHeight;
    },

    incrementBounceCount: (state) => {
      state.bounceCount += 1;
    },

    resetBounceCount: (state) => {
      state.bounceCount = 0;
    },

    resetDetectionFlags: (state) => {
      state.wideDetected = false;
      state.wideConfidence = 0;
      state.noBallHeightDetected = false;
      state.noBallHeightConfidence = 0;
      state.noBallBounceDetected = false;
      state.noBallBounceConfidence = 0;
      state.bounceDetected = false;
      state.bounceHeight = 0;
      state.ballTrajectory = [];
      state.pitchPoint = null;
    },

    setIsDetecting: (state, action) => {
      state.isDetecting = action.payload;
    },

    setIsRecording: (state, action) => {
      state.isRecording = action.payload;
    },

    toggleOverlay: (state) => {
      state.showOverlay = !state.showOverlay;
    },

    toggleZones: (state) => {
      state.showZones = !state.showZones;
    },

    toggleTrajectory: (state) => {
      state.showTrajectory = !state.showTrajectory;
    },

    setDetectionSensitivity: (state, action) => {
      state.detectionSensitivity = action.payload;
    },

    setPitchPoint: (state, action) => {
      state.pitchPoint = action.payload;
    },

    resetCalibration: (state) => {
      state.batsmanCalibrated = false;
      state.stumpsCalibrated = false;
      state.batsmanHeightPx = 0;
    },
  },
});

export const {
  setBatsmanCalibration,
  setStumpsCalibration,
  updateBallDetection,
  updateDecisionFlags,
  incrementBounceCount,
  resetBounceCount,
  resetDetectionFlags,
  setIsDetecting,
  setIsRecording,
  toggleOverlay,
  toggleZones,
  toggleTrajectory,
  setDetectionSensitivity,
  setPitchPoint,
  resetCalibration,
} = detectionSlice.actions;

export const selectDetection = (state) => state.detection;
export const selectBatsmanCalibrated = (state) => state.detection.batsmanCalibrated;
export const selectStumpsCalibrated = (state) => state.detection.stumpsCalibrated;
export const selectBounceCount = (state) => state.detection.bounceCount;
export const selectWideDetected = (state) => state.detection.wideDetected;
export const selectNoBallDetected = (state) =>
  state.detection.noBallHeightDetected || state.detection.noBallBounceDetected;
export const selectDetectionFlags = (state) => ({
  wideDetected: state.detection.wideDetected,
  noBallHeightDetected: state.detection.noBallHeightDetected,
  noBallBounceDetected: state.detection.noBallBounceDetected,
  bounceDetected: state.detection.bounceDetected,
});

export default detectionSlice.reducer;
