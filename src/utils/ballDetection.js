/**
 * Ball Detection Engine
 * Analyzes trajectory data to determine:
 * - Wide: ball passes outside the stump line by threshold
 * - No Ball (Height): ball at batsman crease is above shoulder height
 * - No Ball (Bounce): second short-pitch delivery in over
 * - Bounce: ball pitches and rises above mid-chest height
 *
 * NOTE: This runs on the TRAJECTORY data captured from the camera frames.
 * The camera frames themselves are processed by the CameraView component
 * using color detection to track the ball position.
 */

import { CRICKET } from '../constants';

/**
 * Detect if a ball trajectory indicates a WIDE
 * Wide: ball passes to the side of the batsman outside the crease line
 *
 * @param {Array} trajectory - [{x, y, t}] ball positions
 * @param {Object} calibration - {leftStumpX, rightStumpX, stumpTopY, stumpBottomY, frameWidth}
 * @returns {{ detected: boolean, confidence: number, side: 'off' | 'leg' | null }}
 */
export function detectWide(trajectory, calibration) {
  if (!trajectory || trajectory.length < 5) return { detected: false, confidence: 0, side: null };
  if (!calibration || !calibration.leftStumpX) return { detected: false, confidence: 0, side: null };

  const { leftStumpX, rightStumpX, frameWidth } = calibration;
  const stumpWidth = rightStumpX - leftStumpX;
  const threshold = stumpWidth * CRICKET.WIDE_THRESHOLD;

  // Get ball positions near the batsman crease (middle 40-70% of frame Y)
  // We look at the horizontal extent of the trajectory
  const creasePoints = trajectory.filter(
    (p) => p.y > calibration.frameHeight * 0.3 && p.y < calibration.frameHeight * 0.75
  );

  if (creasePoints.length === 0) return { detected: false, confidence: 0, side: null };

  const minX = Math.min(...creasePoints.map((p) => p.x));
  const maxX = Math.max(...creasePoints.map((p) => p.x));

  // Check off side (right)
  if (maxX > rightStumpX + threshold) {
    const overshoot = maxX - (rightStumpX + threshold);
    const confidence = Math.min(0.95, CRICKET.WIDE_CONFIDENCE + (overshoot / frameWidth) * 0.5);
    return { detected: true, confidence, side: 'off' };
  }

  // Check leg side (left)
  if (minX < leftStumpX - threshold) {
    const overshoot = (leftStumpX - threshold) - minX;
    const confidence = Math.min(0.95, CRICKET.WIDE_CONFIDENCE + (overshoot / frameWidth) * 0.5);
    return { detected: true, confidence, side: 'leg' };
  }

  return { detected: false, confidence: 0, side: null };
}

/**
 * Detect if a ball trajectory indicates a NO BALL due to height
 * The ball should not be above the batsman's shoulder at the crease
 *
 * @param {Array} trajectory - [{x, y, t}]
 * @param {Object} calibration - {batsmanShoulderY, batsmanHeightPx, frameHeight}
 * @returns {{ detected: boolean, confidence: number }}
 */
export function detectNoBallHeight(trajectory, calibration) {
  if (!trajectory || trajectory.length < 5) return { detected: false, confidence: 0 };
  if (!calibration || !calibration.batsmanCalibrated) return { detected: false, confidence: 0 };

  const { batsmanShoulderY } = calibration;

  // Find the minimum Y (highest point) of ball when near the batsman
  // Near batsman = bottom 40% of frame
  const nearBatsmanPoints = trajectory.filter(
    (p) => p.y > calibration.frameHeight * 0.4
  );

  if (nearBatsmanPoints.length === 0) return { detected: false, confidence: 0 };

  const minY = Math.min(...nearBatsmanPoints.map((p) => p.y));

  // In image coords, smaller Y = higher up
  // If ball Y < shoulderY, ball is above shoulder = no ball
  const margin = calibration.batsmanHeightPx * 0.05; // 5% tolerance
  if (minY < batsmanShoulderY - margin) {
    const excess = (batsmanShoulderY - minY) / calibration.batsmanHeightPx;
    const confidence = Math.min(0.95, CRICKET.NO_BALL_CONFIDENCE + excess * 0.4);
    return { detected: true, confidence };
  }

  return { detected: false, confidence: 0 };
}

/**
 * Detect if a bounce occurred and its height
 *
 * @param {Array} trajectory - [{x, y, t}]
 * @param {Object} calibration - { batsmanMidY, stumpBottomY, batsmanHeightPx }
 * @returns {{ detected: boolean, bounceY: number, height: 'low'|'chest'|'head', pitchPoint: {x,y} | null }}
 */
export function detectBounce(trajectory, calibration) {
  if (!trajectory || trajectory.length < 10) return { detected: false };
  if (!calibration || !calibration.batsmanCalibrated) return { detected: false };

  // Bounce = trajectory has a local minimum in Y (ball hits ground) then rises
  // In image coords: Y increases downward, so pitch = local MAX in Y, then Y decreases (ball rises)
  let pitchIndex = -1;
  let pitchMaxY = 0;

  for (let i = 2; i < trajectory.length - 2; i++) {
    const prev = trajectory[i - 1].y;
    const curr = trajectory[i].y;
    const next = trajectory[i + 1].y;
    if (curr > prev && curr > next && curr > pitchMaxY) {
      pitchMaxY = curr;
      pitchIndex = i;
    }
  }

  if (pitchIndex === -1) return { detected: false };

  // After pitching, find the highest rise (minimum Y after pitch)
  const afterPitch = trajectory.slice(pitchIndex);
  if (afterPitch.length < 3) return { detected: false };

  const minYAfterPitch = Math.min(...afterPitch.map((p) => p.y));
  const bounceRise = pitchMaxY - minYAfterPitch;

  // Minimum bounce rise to be considered real (not noise)
  if (bounceRise < calibration.batsmanHeightPx * 0.15) return { detected: false };

  const { batsmanMidY, batsmanShoulderY, stumpBottomY } = calibration;

  let height = 'low';
  if (minYAfterPitch < batsmanShoulderY) height = 'head';
  else if (minYAfterPitch < batsmanMidY) height = 'chest';

  const isNoBall = height === 'head'; // Above shoulder = no ball (short pitch)

  return {
    detected: true,
    bounceY: minYAfterPitch,
    height,
    isNoBall,
    pitchPoint: { x: trajectory[pitchIndex].x, y: trajectory[pitchIndex].y },
    confidence: Math.min(0.9, CRICKET.BOUNCE_CONFIDENCE + (bounceRise / calibration.batsmanHeightPx) * 0.4),
  };
}

/**
 * Main analysis function - runs all detections on a trajectory
 */
export function analyzeBallDelivery(trajectory, detectionState, calibration) {
  const result = {
    wideDetected: false,
    wideConfidence: 0,
    wideSide: null,
    noBallHeightDetected: false,
    noBallHeightConfidence: 0,
    noBallBounceDetected: false,
    noBallBounceConfidence: 0,
    bounceDetected: false,
    bounceHeight: null,
    bounceIsNoBall: false,
    pitchPoint: null,
    isBounce: false,
  };

  if (!trajectory || trajectory.length < 5) return result;

  // Wide detection
  const wide = detectWide(trajectory, calibration);
  result.wideDetected = wide.detected;
  result.wideConfidence = wide.confidence;
  result.wideSide = wide.side;

  // Height no-ball detection
  const noBallH = detectNoBallHeight(trajectory, calibration);
  result.noBallHeightDetected = noBallH.detected;
  result.noBallHeightConfidence = noBallH.confidence;

  // Bounce detection
  const bounce = detectBounce(trajectory, calibration);
  if (bounce.detected) {
    result.bounceDetected = true;
    result.isBounce = true;
    result.bounceHeight = bounce.height;
    result.pitchPoint = bounce.pitchPoint;

    // No ball if head-high bounce
    if (bounce.isNoBall) {
      result.noBallBounceDetected = true;
      result.noBallBounceConfidence = bounce.confidence;
    }

    // No ball if it's the 2nd+ bounce in the over
    const currentBounces = detectionState.bounceCount;
    if (currentBounces >= CRICKET.MAX_BOUNCES_PER_OVER) {
      result.noBallBounceDetected = true;
      result.noBallBounceConfidence = Math.max(result.noBallBounceConfidence, 0.9);
    }
  }

  return result;
}

/**
 * Simple color-based ball detection from a pixel buffer
 * Looks for red/pink circular regions (cricket ball)
 * Returns the centroid of the largest detected region
 *
 * In practice this would be called per-frame on camera output
 * For Expo Go compatibility, we use a simplified heuristic
 *
 * @param {Uint8ClampedArray} pixels - RGBA pixel buffer
 * @param {number} width
 * @param {number} height
 * @returns {{ detected: boolean, x: number, y: number, confidence: number }}
 */
export function detectBallInFrame(pixels, width, height) {
  if (!pixels) return { detected: false, x: 0, y: 0, confidence: 0 };

  let sumX = 0, sumY = 0, count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Cricket ball is typically red/dark red
    // Detect: high R, low G, low B
    const isRed = r > 140 && g < 80 && b < 80 && r > g * 2 && r > b * 2;
    // Also detect white/yellow for tape ball
    const isYellow = r > 200 && g > 180 && b < 80;
    const isWhite = r > 220 && g > 220 && b > 220;

    if (isRed || isYellow || isWhite) {
      const pixelIndex = i / 4;
      const px = pixelIndex % width;
      const py = Math.floor(pixelIndex / width);
      sumX += px;
      sumY += py;
      count++;
    }
  }

  if (count < 20 || count > width * height * 0.1) {
    return { detected: false, x: 0, y: 0, confidence: 0 };
  }

  const cx = sumX / count;
  const cy = sumY / count;
  const confidence = Math.min(0.95, 0.5 + (count / (width * height * 0.01)) * 0.1);

  return { detected: true, x: cx, y: cy, confidence };
}
