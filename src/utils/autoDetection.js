/**
 * Auto Ball Detection Engine
 * 
 * No calibration needed - uses RELATIVE position analysis:
 * - Phone orientation via DeviceMotion (tilt/angle)
 * - Adaptive zone mapping based on frame aspect ratio
 * - Relative trajectory analysis for wide/no-ball/bounce/LBW
 * 
 * Key insight: We don't need absolute pixel coords.
 * We need RELATIVE ball position vs estimated pitch center line.
 */

import { CRICKET } from '../constants';

// ── PHONE ORIENTATION ADAPTIVE ZONES ─────────────────────────────────────────
/**
 * Given device tilt and frame dimensions, compute dynamic detection zones.
 * No manual calibration needed - zones adapt to how the user holds the phone.
 */
export function computeAdaptiveZones(frameWidth, frameHeight, deviceTilt = { alpha: 0, beta: 45, gamma: 0 }) {
  // beta: front-back tilt (0=flat, 90=upright). Typical filming: 30-70deg
  // gamma: left-right tilt
  const betaRad = (deviceTilt.beta * Math.PI) / 180;
  const gammaDeg = deviceTilt.gamma || 0;

  // Estimated pitch center X (adjusts for left-right tilt)
  const tiltOffsetX = (gammaDeg / 45) * frameWidth * 0.15; // max 15% shift
  const pitchCenterX = frameWidth / 2 + tiltOffsetX;

  // Estimated batsman zone: bottom 40% of frame (closest to camera)
  // Top of batsman approx top 30% of that zone
  const batsmanZoneTopY = frameHeight * 0.45;
  const batsmanZoneBottomY = frameHeight * 0.92;
  const batsmanHeightPx = batsmanZoneBottomY - batsmanZoneTopY;

  // Stump width: empirically ~15% of frame width for a typical setup
  const stumpWidthPx = frameWidth * 0.15;
  const leftStumpX = pitchCenterX - stumpWidthPx / 2;
  const rightStumpX = pitchCenterX + stumpWidthPx / 2;

  // Wide threshold: 35% of stump width outside the stump line
  const wideThresholdPx = stumpWidthPx * CRICKET.WIDE_THRESHOLD;

  // Height zones (relative to estimated batsman frame)
  const shoulderY = batsmanZoneTopY + batsmanHeightPx * 0.15;  // top 15%
  const chestY    = batsmanZoneTopY + batsmanHeightPx * 0.35;
  const hipY      = batsmanZoneTopY + batsmanHeightPx * 0.60;
  const kneeY     = batsmanZoneTopY + batsmanHeightPx * 0.80;
  const feetY     = batsmanZoneBottomY;

  return {
    pitchCenterX,
    leftStumpX,
    rightStumpX,
    wideThresholdPx,
    batsmanZoneTopY,
    batsmanZoneBottomY,
    batsmanHeightPx,
    shoulderY,
    chestY,
    hipY,
    kneeY,
    feetY,
    frameWidth,
    frameHeight,
  };
}

// ── WIDE DETECTION ────────────────────────────────────────────────────────────
export function detectWideAuto(trajectory, zones) {
  if (!trajectory || trajectory.length < 4) return { detected: false, confidence: 0, side: null };

  const { leftStumpX, rightStumpX, wideThresholdPx, frameHeight } = zones;

  // Look at ball positions in the lower half of the frame (near batsman)
  const creasePoints = trajectory.filter(
    (p) => p.y > frameHeight * 0.35 && p.y < frameHeight * 0.85
  );
  if (creasePoints.length === 0) return { detected: false, confidence: 0, side: null };

  const minX = Math.min(...creasePoints.map((p) => p.x));
  const maxX = Math.max(...creasePoints.map((p) => p.x));

  if (maxX > rightStumpX + wideThresholdPx) {
    const overshoot = maxX - (rightStumpX + wideThresholdPx);
    const confidence = Math.min(0.95, 0.70 + (overshoot / zones.frameWidth) * 0.5);
    return { detected: true, confidence, side: 'off' };
  }
  if (minX < leftStumpX - wideThresholdPx) {
    const overshoot = (leftStumpX - wideThresholdPx) - minX;
    const confidence = Math.min(0.95, 0.70 + (overshoot / zones.frameWidth) * 0.5);
    return { detected: true, confidence, side: 'leg' };
  }
  return { detected: false, confidence: 0, side: null };
}

// ── NO BALL HEIGHT ────────────────────────────────────────────────────────────
export function detectNoBallHeightAuto(trajectory, zones) {
  if (!trajectory || trajectory.length < 4) return { detected: false, confidence: 0 };

  const { shoulderY, frameHeight } = zones;

  // Find ball in lower half (near batsman)
  const nearBatsman = trajectory.filter((p) => p.y > frameHeight * 0.4);
  if (nearBatsman.length === 0) return { detected: false, confidence: 0 };

  const minY = Math.min(...nearBatsman.map((p) => p.y));
  const margin = zones.batsmanHeightPx * 0.05;

  if (minY < shoulderY - margin) {
    const excess = (shoulderY - minY) / zones.batsmanHeightPx;
    const confidence = Math.min(0.92, 0.65 + excess * 0.4);
    return { detected: true, confidence };
  }
  return { detected: false, confidence: 0 };
}

// ── BOUNCE DETECTION ──────────────────────────────────────────────────────────
export function detectBounceAuto(trajectory, zones) {
  if (!trajectory || trajectory.length < 8) return { detected: false };

  let pitchIndex = -1;
  let pitchMaxY = 0;

  for (let i = 2; i < trajectory.length - 2; i++) {
    const curr = trajectory[i].y;
    if (curr > trajectory[i - 1].y && curr > trajectory[i + 1].y && curr > pitchMaxY) {
      pitchMaxY = curr;
      pitchIndex = i;
    }
  }

  if (pitchIndex === -1) return { detected: false };

  const afterPitch = trajectory.slice(pitchIndex);
  if (afterPitch.length < 3) return { detected: false };

  const minYAfterPitch = Math.min(...afterPitch.map((p) => p.y));
  const bounceRise = pitchMaxY - minYAfterPitch;
  const minRise = zones.batsmanHeightPx * 0.12;

  if (bounceRise < minRise) return { detected: false };

  let height = 'low';
  if (minYAfterPitch < zones.shoulderY) height = 'head';
  else if (minYAfterPitch < zones.chestY) height = 'chest';

  return {
    detected: true,
    bounceY: minYAfterPitch,
    height,
    isNoBall: height === 'head',
    pitchPoint: { x: trajectory[pitchIndex].x, y: trajectory[pitchIndex].y },
    confidence: Math.min(0.90, 0.60 + (bounceRise / zones.batsmanHeightPx) * 0.4),
  };
}

// ── LBW DETECTION ─────────────────────────────────────────────────────────────
/**
 * LBW Analysis - checks if ball would have hit stumps after hitting pad
 * 
 * Rules:
 * 1. Ball must pitch in line or on off side (not outside leg stump)
 * 2. Ball must hit batsman's pad in line with stumps (between leftStumpX and rightStumpX + tolerance)
 * 3. Ball trajectory must project to hit stumps
 * 4. Ball must not have pitched outside off stump (debatable, but simplified here)
 */
export function detectLBW(trajectory, zones, batsmanX = null) {
  if (!trajectory || trajectory.length < 6) {
    return { 
      possible: false, 
      confidence: 0, 
      reason: 'Insufficient trajectory data',
      pitchInLine: false,
      impactInLine: false,
      wouldHitStumps: false,
    };
  }

  const { leftStumpX, rightStumpX, kneeY, hipY, feetY, frameHeight } = zones;
  
  // Estimate stump zone tolerance
  const stumpTolerance = (rightStumpX - leftStumpX) * 0.3;
  const lbwLeftBound = leftStumpX - stumpTolerance;
  const lbwRightBound = rightStumpX + stumpTolerance;

  // 1. Find where ball pitched (local max Y = bounce point)
  let pitchPoint = null;
  for (let i = 2; i < trajectory.length - 2; i++) {
    const curr = trajectory[i].y;
    if (curr > trajectory[i - 1].y && curr > trajectory[i + 1].y) {
      pitchPoint = trajectory[i];
      break;
    }
  }

  // If no clear pitch detected, use bottom-most point
  if (!pitchPoint) {
    pitchPoint = trajectory.reduce((max, p) => (p.y > max.y ? p : max), trajectory[0]);
  }

  // 2. Check pitch in line (ball must not pitch outside leg stump)
  const pitchInLine = pitchPoint.x >= lbwLeftBound && pitchPoint.x <= lbwRightBound + stumpTolerance * 2;
  const pitchedOutsideLeg = pitchPoint.x < lbwLeftBound;

  if (pitchedOutsideLeg) {
    return {
      possible: false,
      confidence: 0,
      reason: 'Pitched outside leg stump - Not out',
      pitchInLine: false,
      impactInLine: false,
      wouldHitStumps: false,
    };
  }

  // 3. Find impact point (where ball stopped its forward trajectory - approximated)
  // Look for ball in the knee-hip zone (pad impact region)
  const padImpactPoints = trajectory.filter(
    (p) => p.y >= kneeY * 0.85 && p.y <= hipY * 1.15
  );

  const impactPoint = padImpactPoints.length > 0 
    ? padImpactPoints[padImpactPoints.length - 1]
    : trajectory[trajectory.length - 1];

  const impactInLine = impactPoint.x >= lbwLeftBound && impactPoint.x <= lbwRightBound;

  // 4. Project trajectory to stump height to see if it would hit
  // Use last few trajectory points to determine direction
  const last4 = trajectory.slice(-4);
  const trajectoryDX = last4.length > 1
    ? (last4[last4.length - 1].x - last4[0].x) / last4.length
    : 0;
  const trajectoryDY = last4.length > 1
    ? (last4[last4.length - 1].y - last4[0].y) / last4.length
    : 0;

  // Project to stump base Y (near feetY)
  const stumpY = feetY * 0.88; // stumps are at ~88% frame height
  const currentY = impactPoint.y;
  const stepsToStump = trajectoryDY !== 0 ? (stumpY - currentY) / trajectoryDY : 0;
  const projectedX = impactPoint.x + trajectoryDX * stepsToStump;

  const wouldHitStumps = projectedX >= leftStumpX - stumpTolerance && 
                          projectedX <= rightStumpX + stumpTolerance;

  // Calculate confidence
  let confidence = 0;
  if (pitchInLine) confidence += 0.25;
  if (impactInLine) confidence += 0.40;
  if (wouldHitStumps) confidence += 0.35;

  // Reduce confidence if pitch was on off side (umpire's call territory)
  if (pitchPoint.x > rightStumpX) confidence *= 0.75;

  const possible = confidence >= 0.55 && impactInLine && wouldHitStumps && !pitchedOutsideLeg;

  let reason = '';
  if (possible) {
    if (pitchPoint.x > rightStumpX) {
      reason = "Umpire's Call - Pitched outside off, but tracking shows hitting stumps";
    } else {
      reason = 'Pitched in line, impact in line, tracking shows hitting stumps';
    }
  } else {
    if (!impactInLine) reason = 'Impact outside stump line - Not out';
    else if (!wouldHitStumps) reason = 'Ball tracking shows missing stumps - Not out';
    else reason = 'Insufficient evidence';
  }

  return {
    possible,
    confidence,
    reason,
    pitchInLine,
    impactInLine,
    wouldHitStumps,
    pitchedOnOffSide: pitchPoint.x > rightStumpX,
    projectedX,
    pitchPoint,
    impactPoint,
    isUmpireCall: confidence >= 0.40 && confidence < 0.60,
  };
}

// ── MAIN ANALYSIS ─────────────────────────────────────────────────────────────
export function analyzeBallDeliveryAuto(trajectory, detectionState, deviceTilt, frameWidth, frameHeight) {
  const zones = computeAdaptiveZones(frameWidth, frameHeight, deviceTilt);

  const result = {
    zones, // expose zones for UI overlay
    wideDetected: false,
    wideConfidence: 0,
    wideSide: null,
    noBallHeightDetected: false,
    noBallHeightConfidence: 0,
    noBallBounceDetected: false,
    noBallBounceConfidence: 0,
    bounceDetected: false,
    bounceHeight: null,
    isBounce: false,
    lbwPossible: false,
    lbwData: null,
    pitchPoint: null,
  };

  if (!trajectory || trajectory.length < 5) return result;

  const wide = detectWideAuto(trajectory, zones);
  result.wideDetected = wide.detected;
  result.wideConfidence = wide.confidence;
  result.wideSide = wide.side;

  const noBallH = detectNoBallHeightAuto(trajectory, zones);
  result.noBallHeightDetected = noBallH.detected;
  result.noBallHeightConfidence = noBallH.confidence;

  const bounce = detectBounceAuto(trajectory, zones);
  if (bounce.detected) {
    result.bounceDetected = true;
    result.isBounce = true;
    result.bounceHeight = bounce.height;
    result.pitchPoint = bounce.pitchPoint;
    if (bounce.isNoBall) {
      result.noBallBounceDetected = true;
      result.noBallBounceConfidence = bounce.confidence;
    }
    if ((detectionState?.bounceCount || 0) >= CRICKET.MAX_BOUNCES_PER_OVER) {
      result.noBallBounceDetected = true;
      result.noBallBounceConfidence = Math.max(result.noBallBounceConfidence, 0.9);
    }
  }

  // LBW only analyzed when there's a wicket possibility
  const lbw = detectLBW(trajectory, zones);
  result.lbwPossible = lbw.possible;
  result.lbwData = lbw;

  return result;
}

// ── BALL COLOR DETECTION (frame analysis) ────────────────────────────────────
export function detectBallInFrameAuto(pixels, width, height) {
  if (!pixels) return { detected: false, x: 0, y: 0, confidence: 0 };

  let sumX = 0, sumY = 0, count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const isRed = r > 140 && g < 80 && b < 80 && r > g * 2 && r > b * 2;
    const isYellow = r > 200 && g > 180 && b < 80;
    const isWhite = r > 220 && g > 220 && b > 220 && r - g < 30;

    if (isRed || isYellow || isWhite) {
      const pixelIndex = i / 4;
      sumX += pixelIndex % width;
      sumY += Math.floor(pixelIndex / width);
      count++;
    }
  }

  if (count < 15 || count > width * height * 0.08) {
    return { detected: false, x: 0, y: 0, confidence: 0 };
  }

  return {
    detected: true,
    x: sumX / count,
    y: sumY / count,
    confidence: Math.min(0.95, 0.5 + (count / (width * height * 0.01)) * 0.1),
  };
}
