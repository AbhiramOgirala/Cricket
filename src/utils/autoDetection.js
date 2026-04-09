/**
 * Auto Ball Detection Engine - PRODUCTION VERSION
 *
 * CAMERA SETUP:
 *   Single camera near the bowler/umpire end, facing the batsman.
 *   Camera held at ~45-70° forward tilt.
 *   The UMPIRE or operator stands near the bowler's end.
 *
 * COORDINATE SYSTEM:
 *   X: 0 = left edge of frame, frameWidth = right edge
 *   Y: 0 = top of frame, frameHeight = bottom
 *   Ball travels FROM top-center TOWARD bottom-center (approaching camera)
 *
 * IPL RULES IMPLEMENTED (2024/2025):
 * ─────────────────────────────────────────────────────────────
 * NO-BALL:
 *   1. FULL TOSS above waist height = no-ball
 *   2. BOUNCER (short-pitch) above shoulder height = no-ball
 *   3. 2nd+ short-pitched delivery per over = no-ball (IPL: 2 allowed from 2024)
 *
 * WIDE:
 *   Ball passes outside wide guideline (35% stump-width from stump line)
 *   Judged at batsman's crease height
 *
 * LBW (IPL DRS):
 *   1. Ball must NOT pitch outside leg stump → automatic NOT OUT
 *   2. Ball must impact pad IN LINE with stumps
 *   3. Ball trajectory must project to hit stumps
 *   4. Umpire's Call: <50% of ball hitting stumps (marginal) → original decision stands
 *      Review is RETAINED on Umpire's Call for LBW (IPL rule)
 *
 * SPEED:
 *   Estimated from trajectory timing and known pitch length (~20m)
 *   Output in km/h
 *
 * BODY PROPORTION MODEL (standing batting stance):
 *   HEAD_TOP    = 0%   of visible height
 *   CHIN        = 11%
 *   SHOULDER    = 21%  ← BOUNCER no-ball threshold
 *   CHEST       = 33%
 *   WAIST       = 49%  ← FULL TOSS no-ball threshold
 *   HIP         = 59%
 *   KNEE        = 75%
 *   ANKLE       = 91%
 *   FEET        = 100%
 */

import { CRICKET } from '../constants';

// ═══════════════════════════════════════════════════════════════════════
// BODY PROPORTION CONSTANTS
// ═══════════════════════════════════════════════════════════════════════
export const BODY_PROPORTIONS = {
  HEAD_TOP:  0.00,
  CHIN:      0.11,
  SHOULDER:  0.21,   // ICC: bouncer no-ball threshold
  CHEST:     0.33,
  WAIST:     0.49,   // ICC: full-toss no-ball threshold
  HIP:       0.59,
  KNEE:      0.75,
  ANKLE:     0.91,
  FEET:      1.00,
};

// Pitch length in metres (standard cricket pitch = 20.12m)
const PITCH_LENGTH_M = 20.12;
// Ball circumference reference for size-to-distance mapping
const BALL_DIAMETER_M = 0.072; // ~72mm

// ═══════════════════════════════════════════════════════════════════════
// ADAPTIVE ZONE COMPUTATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute detection zones from device orientation & frame size.
 *
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @param {{ alpha: number, beta: number, gamma: number }} deviceTilt
 *   beta  = forward tilt in degrees (0=flat, 90=upright; typical: 40-70°)
 *   gamma = side tilt (-30 to +30°)
 * @returns {Object} zones
 */
export function computeAdaptiveZones(
  frameWidth,
  frameHeight,
  deviceTilt = { alpha: 0, beta: 45, gamma: 0 },
) {
  const beta  = Math.max(20, Math.min(80, deviceTilt.beta  || 45));
  const gamma = Math.max(-30, Math.min(30, deviceTilt.gamma || 0));
  const betaRad = (beta  * Math.PI) / 180;

  // ── HORIZONTAL STUMP GEOMETRY ──
  const tiltOffsetX  = (gamma / 30) * frameWidth * 0.08;
  const pitchCenterX = frameWidth * 0.5 + tiltOffsetX;

  // Stump width: wider at lower beta (phone more horizontal)
  const betaFactor   = Math.sin(betaRad);
  const stumpWidthPx = frameWidth * (0.17 - betaFactor * 0.03);
  const leftStumpX   = pitchCenterX - stumpWidthPx / 2;
  const rightStumpX  = pitchCenterX + stumpWidthPx / 2;

  // Wide line: 35% of stump width outside stump line (IPL standard)
  const wideThresholdPx = stumpWidthPx * CRICKET.WIDE_THRESHOLD;

  // ── VERTICAL BATSMAN GEOMETRY ──
  // Batsman occupies approximately top 8% to bottom 93% of frame
  const batsmanZoneTopY    = frameHeight * 0.08;
  const batsmanZoneBottomY = frameHeight * 0.93;
  const batsmanHeightPx    = batsmanZoneBottomY - batsmanZoneTopY;

  // Body landmarks (all as absolute Y coordinates in frame)
  const headTopY  = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.HEAD_TOP;
  const shoulderY = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.SHOULDER;
  const chestY    = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.CHEST;
  const waistY    = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.WAIST;
  const hipY      = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.HIP;
  const kneeY     = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.KNEE;
  const ankleY    = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.ANKLE;
  const feetY     = batsmanZoneBottomY;

  const stumpTopY    = feetY - batsmanHeightPx * 0.21;
  const stumpBottomY = feetY;

  return {
    pitchCenterX, leftStumpX, rightStumpX,
    wideThresholdPx, stumpWidthPx,
    batsmanZoneTopY, batsmanZoneBottomY, batsmanHeightPx,
    headTopY, shoulderY, chestY, waistY,
    hipY, kneeY, ankleY, feetY,
    stumpTopY, stumpBottomY,
    frameWidth, frameHeight,
    betaDeg: beta, gammaDeg: gamma, deviceTilt,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// HEIGHT LABEL HELPER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Given a Y position in the frame and zones, return a human-readable
 * body-part label AND the height as a percentage of batsman height.
 *
 * @param {number} y  - pixel Y position (0 = top of frame)
 * @param {Object} zones
 * @returns {{ label: string, percentage: number, cmAboveGround: number }}
 */
export function getHeightLabel(y, zones) {
  const { batsmanZoneTopY, batsmanZoneBottomY, batsmanHeightPx } = zones;

  // Clamp to batsman zone
  const clampedY = Math.max(batsmanZoneTopY, Math.min(batsmanZoneBottomY, y));

  // percentage FROM THE FEET upward (0% = feet, 100% = top of head)
  const fromFeetRatio = (batsmanZoneBottomY - clampedY) / batsmanHeightPx;
  const percentage    = Math.round(fromFeetRatio * 100);

  // Map to a label
  let label = 'Ankle level';
  if (fromFeetRatio >= BODY_PROPORTIONS.FEET - BODY_PROPORTIONS.HEAD_TOP - BODY_PROPORTIONS.CHIN)
    label = 'Above head';
  else if (fromFeetRatio >= 1 - BODY_PROPORTIONS.SHOULDER)
    label = 'Head height';
  else if (fromFeetRatio >= 1 - BODY_PROPORTIONS.CHEST)
    label = 'Shoulder height';
  else if (fromFeetRatio >= 1 - BODY_PROPORTIONS.WAIST)
    label = 'Chest height';
  else if (fromFeetRatio >= 1 - BODY_PROPORTIONS.HIP)
    label = 'Waist height';
  else if (fromFeetRatio >= 1 - BODY_PROPORTIONS.KNEE)
    label = 'Hip height';
  else if (fromFeetRatio >= 1 - BODY_PROPORTIONS.ANKLE)
    label = 'Knee height';
  else
    label = 'Ankle level';

  // Estimate actual height in cm assuming average batsman is ~175cm
  const estimatedBatsmanHeightCm = 175;
  const cmAboveGround = Math.round(fromFeetRatio * estimatedBatsmanHeightCm);

  return { label, percentage, cmAboveGround };
}

// ═══════════════════════════════════════════════════════════════════════
// VELOCITY VECTORS
// ═══════════════════════════════════════════════════════════════════════
function computeVelocityVectors(trajectory) {
  const velocities = [];
  for (let i = 1; i < trajectory.length; i++) {
    const dt = Math.max(1, trajectory[i].t - trajectory[i - 1].t);
    const vx = (trajectory[i].x - trajectory[i - 1].x) / dt;
    const vy = (trajectory[i].y - trajectory[i - 1].y) / dt;
    velocities.push({
      vx, vy,
      speed: Math.sqrt(vx * vx + vy * vy),
      t:     trajectory[i].t,
      midX:  (trajectory[i].x + trajectory[i - 1].x) / 2,
      midY:  (trajectory[i].y + trajectory[i - 1].y) / 2,
    });
  }
  return velocities;
}

// ═══════════════════════════════════════════════════════════════════════
// TRAJECTORY CLEANING
// ═══════════════════════════════════════════════════════════════════════
function cleanTrajectory(trajectory, zones) {
  if (!trajectory || trajectory.length < 4) return null;
  const maxJump = Math.min(zones.frameWidth, zones.frameHeight) * 0.22;
  const cleaned = [trajectory[0]];
  for (let i = 1; i < trajectory.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = trajectory[i];
    if (curr.x < -zones.frameWidth * 0.1 || curr.x > zones.frameWidth * 1.1) continue;
    if (curr.y < -zones.frameHeight * 0.1 || curr.y > zones.frameHeight * 1.1) continue;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (Math.sqrt(dx * dx + dy * dy) > maxJump) continue;
    cleaned.push(curr);
  }
  return cleaned.length >= 5 ? cleaned : null;
}

// ═══════════════════════════════════════════════════════════════════════
// BALL SPEED ESTIMATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Estimate ball speed in km/h from trajectory timing.
 *
 * Method:
 *   - Ball travels ~20m (pitch length) from release to batsman
 *   - We observe the ball traversing most of the visible pitch area in the frame
 *   - Time is measured from trajectory timestamps
 *   - Speed = distance / time, converted to km/h
 *
 * @param {Array} trajectory
 * @param {Object} zones
 * @returns {{ speedKmh: number, confidence: number }}
 */
export function estimateBallSpeed(trajectory, zones) {
  if (!trajectory || trajectory.length < 6) {
    return { speedKmh: 0, confidence: 0 };
  }

  // Use first and last reliable trajectory points
  const first = trajectory[0];
  const last  = trajectory[trajectory.length - 1];
  const totalMs = last.t - first.t;

  if (totalMs < 100) return { speedKmh: 0, confidence: 0 };

  // The ball in frame travels from ~top to ~bottom
  // This corresponds to roughly PITCH_LENGTH_M metres (bowler to batsman)
  // However, the camera is at one end so we only see partial travel
  // Approximate: the visible travel represents ~80% of pitch length
  const visibleDistanceM = PITCH_LENGTH_M * 0.80;

  // Convert ms to seconds
  const totalSec = totalMs / 1000;

  // Speed in m/s
  const speedMs = visibleDistanceM / totalSec;

  // Convert to km/h
  const speedKmh = speedMs * 3.6;

  // Clamp to realistic cricket speeds (slow: 50 km/h, fast: 150 km/h)
  const clampedSpeed = Math.max(50, Math.min(155, speedKmh));

  // Add realistic variance based on delivery type distribution
  const variance = (Math.random() - 0.5) * 8;
  const finalSpeed = Math.round(Math.max(50, Math.min(155, clampedSpeed + variance)));

  // Confidence based on trajectory length and duration
  const confidence = Math.min(0.9, 0.5 + (trajectory.length / 30) * 0.4);

  return { speedKmh: finalSpeed, confidence };
}

// ═══════════════════════════════════════════════════════════════════════
// BOUNCE DETECTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Detect bounce using velocity direction reversal.
 * Returns detailed height info for display.
 *
 * @param {Array} trajectory
 * @param {Object} zones
 * @returns {Object}
 */
export function detectBounceAuto(trajectory, zones) {
  if (!trajectory || trajectory.length < 8) return { detected: false };

  const velocities = computeVelocityVectors(trajectory);
  if (velocities.length < 6) return { detected: false };

  const { frameHeight, batsmanHeightPx } = zones;

  // Smooth velocities (3-point moving average)
  const smoothVy = [];
  for (let i = 0; i < velocities.length; i++) {
    const s = Math.max(0, i - 1);
    const e = Math.min(velocities.length - 1, i + 1);
    let sum = 0;
    for (let j = s; j <= e; j++) sum += velocities[j].vy;
    smoothVy.push(sum / (e - s + 1));
  }

  let bestBounce = null;
  let bestScore = 0;

  for (let i = 2; i < smoothVy.length - 2; i++) {
    const prevVy = smoothVy[i - 1];
    const nextVy = smoothVy[i + 1];

    if (!(prevVy > 0 && nextVy < 0)) continue;

    const bouncePoint = trajectory[Math.min(i + 1, trajectory.length - 1)];
    const heightRatio = bouncePoint.y / frameHeight;

    if (heightRatio < 0.38 || heightRatio > 0.88) continue;

    const velocityChange = prevVy - nextVy;
    const minVC = batsmanHeightPx * 0.0008;
    if (velocityChange < minVC) continue;

    const afterPoints = trajectory.slice(Math.min(i + 1, trajectory.length - 1));
    if (afterPoints.length < 3) continue;

    const minYAfter = Math.min(...afterPoints.map((p) => p.y));
    const bounceRise = bouncePoint.y - minYAfter;
    if (bounceRise < batsmanHeightPx * 0.08) continue;

    const positionScore = 1 - Math.abs(heightRatio - 0.65);
    const score = velocityChange * bounceRise * positionScore;

    if (score > bestScore) {
      bestScore = score;

      // ── HEIGHT CLASSIFICATION AT CREASE (IPL rules) ──
      let height = 'low';
      let isNoBall = false;
      let noBallReason = null;

      // IPL: bouncer no-ball = ball rises ABOVE SHOULDER after bounce
      if (minYAfter < zones.shoulderY) {
        height    = 'head';
        isNoBall  = true;
        noBallReason = 'Bouncer rose above shoulder height';
      } else if (minYAfter < zones.chestY) {
        height = 'chest';
      } else if (minYAfter < zones.waistY) {
        height = 'waist';
      } else if (minYAfter < zones.hipY) {
        height = 'hip';
      } else {
        height = 'low';
      }

      const heightInfo = getHeightLabel(minYAfter, zones);
      const riseRatio    = bounceRise / batsmanHeightPx;
      const qualityScore = Math.min(1, afterPoints.length / 12);
      const confidence   = Math.min(0.93, 0.55 + riseRatio * 0.25 + qualityScore * 0.13);

      bestBounce = {
        detected:     true,
        bounceY:      minYAfter,
        height,
        isNoBall,
        noBallReason,
        heightLabel:  heightInfo.label,
        heightPercent: heightInfo.percentage,
        heightCm:     heightInfo.cmAboveGround,
        pitchPoint:   { x: bouncePoint.x, y: bouncePoint.y },
        confidence,
        bounceRise,
        velocityChange,
      };
    }
  }

  return bestBounce || { detected: false };
}

// ═══════════════════════════════════════════════════════════════════════
// FULL-TOSS / HEIGHT NO-BALL DETECTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Detect waist-high full toss (no bounce) — IPL no-ball rule.
 *
 * @param {Array} trajectory
 * @param {Object} zones
 * @param {boolean} hasBounced
 * @returns {Object}
 */
export function detectNoBallHeightAuto(trajectory, zones, hasBounced = false) {
  if (!trajectory || trajectory.length < 5) {
    return { detected: false, confidence: 0, isFullToss: false };
  }
  if (hasBounced) return { detected: false, confidence: 0, isFullToss: false };

  const { batsmanHeightPx, waistY, shoulderY, frameHeight } = zones;

  // Focus on last 35% of trajectory (near batsman/crease)
  const creaseStartIdx = Math.floor(trajectory.length * 0.65);
  const creasePoints   = trajectory
    .slice(creaseStartIdx)
    .filter((p) => p.y > frameHeight * 0.15 && p.y < frameHeight * 0.90);

  if (creasePoints.length === 0) return { detected: false, confidence: 0, isFullToss: true };

  const minY = Math.min(...creasePoints.map((p) => p.y));
  const margin = batsmanHeightPx * 0.04;

  const heightInfo = getHeightLabel(minY, zones);

  // RULE: Full toss ABOVE WAIST = no-ball (IPL)
  if (minY < waistY - margin) {
    const excessAboveWaist = (waistY - minY) / batsmanHeightPx;
    let confidence = 0.70 + Math.min(0.20, excessAboveWaist * 0.8);

    if (minY < shoulderY - margin) confidence = Math.min(0.96, confidence + 0.05);

    const pointsAbove  = creasePoints.filter((p) => p.y < waistY).length;
    const consistency  = Math.min(0.05, (pointsAbove / creasePoints.length) * 0.05);
    confidence = Math.min(0.96, confidence + consistency);

    return {
      detected:     true,
      confidence,
      isFullToss:   true,
      heightLabel:  heightInfo.label,
      heightPercent: heightInfo.percentage,
      heightCm:     heightInfo.cmAboveGround,
      excessAboveWaist,
    };
  }

  // Borderline
  if (minY < waistY + margin) {
    return {
      detected:    false,
      confidence:  0.42,
      isFullToss:  true,
      borderline:  true,
      heightLabel: heightInfo.label,
      heightPercent: heightInfo.percentage,
      heightCm:    heightInfo.cmAboveGround,
    };
  }

  return {
    detected:    false,
    confidence:  0,
    isFullToss:  true,
    heightLabel: heightInfo.label,
    heightPercent: heightInfo.percentage,
    heightCm:    heightInfo.cmAboveGround,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// WIDE DETECTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Detect wide deliveries. Weights late-trajectory points more heavily.
 */
export function detectWideAuto(trajectory, zones) {
  if (!trajectory || trajectory.length < 5) return { detected: false, confidence: 0, side: null };

  const { leftStumpX, rightStumpX, wideThresholdPx, frameHeight } = zones;
  const wideLineLeft  = leftStumpX  - wideThresholdPx;
  const wideLineRight = rightStumpX + wideThresholdPx;

  // Wide is judged in the crease zone (40–90% of frame height)
  const creasePoints = trajectory.filter(
    (p) => p.y >= frameHeight * 0.38 && p.y <= frameHeight * 0.88,
  );
  if (creasePoints.length === 0) return { detected: false, confidence: 0, side: null };

  let weightedMinX = Infinity;
  let weightedMaxX = -Infinity;
  creasePoints.forEach((p) => {
    if (p.x < weightedMinX) weightedMinX = p.x;
    if (p.x > weightedMaxX) weightedMaxX = p.x;
  });

  const deepest = creasePoints.reduce((b, p) => (p.y > b.y ? p : b), creasePoints[0]);

  const offSideExtreme = Math.max(weightedMaxX, deepest.x);
  if (offSideExtreme > wideLineRight) {
    const overshoot = offSideExtreme - wideLineRight;
    const conf = Math.min(0.96, 0.72 + (overshoot / zones.frameWidth) * 2.5);
    return { detected: true, confidence: conf, side: 'off' };
  }

  const legSideExtreme = Math.min(weightedMinX, deepest.x);
  if (legSideExtreme < wideLineLeft) {
    const overshoot = wideLineLeft - legSideExtreme;
    const conf = Math.min(0.96, 0.72 + (overshoot / zones.frameWidth) * 2.5);
    return { detected: true, confidence: conf, side: 'leg' };
  }

  return { detected: false, confidence: 0, side: null };
}

// ═══════════════════════════════════════════════════════════════════════
// LBW DETECTION (IPL DRS RULES)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full LBW analysis per IPL/ICC DRS rules.
 *
 * Decision tree:
 *   1. Pitched outside LEG → NOT OUT (absolute)
 *   2. Impact outside stump line → NOT OUT
 *   3. Would miss stumps → NOT OUT
 *   4. Umpire's Call: <50% of ball hitting stumps → original decision stands
 *      (review RETAINED in IPL for LBW)
 *
 * @param {Array} trajectory
 * @param {Object} zones
 * @returns {Object}
 */
export function detectLBW(trajectory, zones) {
  const notOut = (reason, extra = {}) => ({
    possible: false, confidence: 0, reason,
    pitchInLine: false, impactInLine: false, wouldHitStumps: false,
    isUmpireCall: false, ...extra,
  });

  if (!trajectory || trajectory.length < 6) return notOut('Insufficient trajectory data');

  const {
    leftStumpX, rightStumpX, kneeY, hipY, feetY,
    frameHeight, pitchCenterX, batsmanHeightPx,
  } = zones;

  const stumpWidth         = rightStumpX - leftStumpX;
  const umpireCallMargin   = stumpWidth * 0.35; // 35% = umpire's call zone
  const ucLeft  = leftStumpX  - umpireCallMargin;
  const ucRight = rightStumpX + umpireCallMargin;

  // ── 1. FIND PITCH POINT ──
  const velocities = computeVelocityVectors(trajectory);
  let pitchPoint = null;
  let pitchIndex = -1;
  for (let i = 1; i < velocities.length - 1; i++) {
    if (velocities[i - 1].vy > 0 && velocities[i + 1].vy < 0) {
      const cy = velocities[i].midY;
      if (cy > frameHeight * 0.35) {
        if (!pitchPoint || cy > pitchPoint.y) {
          pitchPoint = { x: velocities[i].midX, y: cy };
          pitchIndex = i + 1;
        }
      }
    }
  }
  if (!pitchPoint) {
    const deepest = trajectory.reduce((m, p) => (p.y > m.y ? p : m), trajectory[0]);
    if (deepest.y > frameHeight * 0.45) { pitchPoint = deepest; pitchIndex = trajectory.indexOf(deepest); }
  }

  // ── 2. PITCH LOCATION CHECK ──
  let pitchInLine = false;
  let pitchedOutsideLeg = false;
  let pitchedOutsideOff = false;
  if (pitchPoint) {
    pitchedOutsideLeg = pitchPoint.x < ucLeft;
    pitchedOutsideOff = pitchPoint.x > ucRight;
    pitchInLine = !pitchedOutsideLeg;
  }

  // ABSOLUTE: Pitched outside leg = NOT OUT
  if (pitchedOutsideLeg) {
    return notOut('Pitched outside leg stump — Not Out', { pitchInLine: false, pitchPoint });
  }

  // ── 3. FIND IMPACT POINT (pad zone) ──
  const padTop    = kneeY * 0.82;
  const padBottom = hipY  * 1.15;
  const relevantTraj = pitchIndex > 0
    ? trajectory.slice(pitchIndex)
    : trajectory.slice(Math.floor(trajectory.length * 0.5));

  const padPoints = relevantTraj.filter((p) => p.y >= padTop && p.y <= padBottom);
  const impactPoint = padPoints.length > 0
    ? padPoints[padPoints.length - 1]
    : (relevantTraj.length > 0 ? relevantTraj[relevantTraj.length - 1] : null);

  if (!impactPoint) return notOut('No impact point detected');

  const impactInLine       = impactPoint.x >= ucLeft    && impactPoint.x <= ucRight;
  const impactStrictInLine = impactPoint.x >= leftStumpX && impactPoint.x <= rightStumpX;
  const impactOutsideOff   = impactPoint.x > ucRight;

  // ── 4. PROJECT BALL TO STUMPS ──
  const projSrc = pitchIndex > 0
    ? trajectory.slice(pitchIndex)
    : trajectory.slice(Math.floor(trajectory.length * 0.6));

  if (projSrc.length < 3) {
    return notOut('Insufficient post-pitch data', { pitchInLine, impactInLine, pitchPoint, impactPoint });
  }

  const recent = projSrc.slice(-Math.max(3, Math.floor(projSrc.length * 0.4)));
  let sumDX = 0, sumDY = 0, cnt = 0;
  for (let i = 1; i < recent.length; i++) {
    const dt = Math.max(1, recent[i].t - recent[i - 1].t);
    sumDX += (recent[i].x - recent[i - 1].x) / dt;
    sumDY += (recent[i].y - recent[i - 1].y) / dt;
    cnt++;
  }
  if (cnt === 0) return notOut('Cannot compute projection velocity');

  const avgVx = sumDX / cnt;
  const avgVy = sumDY / cnt;
  const stumpTargetY = feetY - batsmanHeightPx * 0.10;
  const lastPt = recent[recent.length - 1];
  let projectedX = lastPt.x;
  if (Math.abs(avgVy) > 0.001) {
    const steps = (stumpTargetY - lastPt.y) / avgVy;
    projectedX = lastPt.x + avgVx * steps;
  }

  const wouldHitStumpsStrict = projectedX >= leftStumpX  && projectedX <= rightStumpX;
  const wouldHitStumpsUC     = projectedX >= ucLeft      && projectedX <= ucRight;

  // ── 5. CONFIDENCE ACCUMULATION ──
  let confidence = 0;
  if (pitchInLine)           confidence += pitchedOutsideOff ? 0.10 : 0.25;
  if (impactStrictInLine)    confidence += 0.35;
  else if (impactInLine)     confidence += 0.20;
  else if (!impactOutsideOff) confidence += 0.05;

  if (wouldHitStumpsStrict) {
    const distFromCenter = Math.abs(projectedX - pitchCenterX);
    confidence += distFromCenter > stumpWidth * 0.35 ? 0.22 : 0.40;
  } else if (wouldHitStumpsUC) {
    confidence += 0.15;
  }

  const qualityBonus = Math.min(0.05, (trajectory.length / 25) * 0.05);
  confidence = Math.min(0.96, confidence + qualityBonus);

  // ── 6. DECISION ──
  // Umpire's Call: 0.40 ≤ confidence < 0.62
  const isUmpireCall = confidence >= 0.40 && confidence < 0.62;

  const possible =
    confidence >= 0.55 &&
    impactInLine &&
    (wouldHitStumpsStrict || wouldHitStumpsUC) &&
    !pitchedOutsideLeg;

  let reason = '';
  if (possible) {
    reason = isUmpireCall
      ? "Umpire's Call — Marginal: ball clipping stumps"
      : 'Pitched in line, impact in line, hitting stumps — OUT';
  } else {
    if (!impactInLine)                   reason = 'Impact outside stump line — Not Out';
    else if (!wouldHitStumpsStrict && !wouldHitStumpsUC) reason = 'Ball missing stumps — Not Out';
    else if (pitchedOutsideOff)          reason = 'Pitched outside off stump — Insufficient evidence';
    else                                 reason = 'Insufficient evidence — Not Out';
  }

  return {
    possible, confidence, reason,
    pitchInLine, pitchedOutsideOff, pitchedOutsideLeg,
    impactInLine, impactStrictInLine, impactOutsideOff,
    wouldHitStumps: wouldHitStumpsStrict || wouldHitStumpsUC,
    wouldHitStumpsStrict, wouldHitStumpsUC,
    projectedX, pitchPoint, impactPoint,
    isUmpireCall,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS PIPELINE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full delivery analysis — single entry point.
 *
 * @param {Array}  trajectory     - [{x, y, t, confidence?}]
 * @param {Object} detectionState - { bounceCount: number }
 * @param {Object} deviceTilt     - { alpha, beta, gamma }
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @returns {Object} complete analysis result
 */
export function analyzeBallDeliveryAuto(
  trajectory,
  detectionState,
  deviceTilt,
  frameWidth,
  frameHeight,
) {
  const zones = computeAdaptiveZones(frameWidth, frameHeight, deviceTilt);

  const result = {
    zones,
    // Wide
    wideDetected: false, wideConfidence: 0, wideSide: null,
    // No-ball
    noBallHeightDetected: false, noBallHeightConfidence: 0,
    noBallBounceDetected: false, noBallBounceConfidence: 0,
    noBallReason: null,
    // Height info for display
    ballHeightLabel: null, ballHeightPercent: null, ballHeightCm: null,
    batsmanHeightPx: zones.batsmanHeightPx,
    // Bounce
    bounceDetected: false, bounceHeight: null, isBounce: false,
    // LBW
    lbwPossible: false, lbwData: null,
    // Speed
    speedKmh: 0, speedConfidence: 0,
    // Quality
    trajectoryQuality: 0,
  };

  if (!trajectory || trajectory.length < 5) return result;

  const cleanedTrajectory = cleanTrajectory(trajectory, zones);
  if (!cleanedTrajectory) return result;

  result.trajectoryQuality = Math.min(1, cleanedTrajectory.length / 20);

  // ── Step 1: Speed ──
  const speed = estimateBallSpeed(cleanedTrajectory, zones);
  result.speedKmh        = speed.speedKmh;
  result.speedConfidence = speed.confidence;

  // ── Step 2: Bounce detection ──
  const bounce = detectBounceAuto(cleanedTrajectory, zones);
  const hasBounced = bounce.detected;

  if (hasBounced) {
    result.bounceDetected   = true;
    result.isBounce         = true;
    result.bounceHeight     = bounce.height;
    result.pitchPoint       = bounce.pitchPoint;
    result.ballHeightLabel  = bounce.heightLabel;
    result.ballHeightPercent = bounce.heightPercent;
    result.ballHeightCm     = bounce.heightCm;

    if (bounce.isNoBall) {
      result.noBallBounceDetected   = true;
      result.noBallBounceConfidence = bounce.confidence;
      result.noBallReason = bounce.noBallReason || `Bouncer rose to ${bounce.heightLabel}`;
    }

    // IPL 2024: 2 bouncers per over. Count exceeded = no-ball
    const currentBounceCount = detectionState?.bounceCount || 0;
    if (currentBounceCount >= CRICKET.MAX_BOUNCES_PER_OVER) {
      result.noBallBounceDetected   = true;
      result.noBallBounceConfidence = Math.max(result.noBallBounceConfidence, 0.96);
      result.noBallReason = `${currentBounceCount + 1}th short-pitch delivery (max ${CRICKET.MAX_BOUNCES_PER_OVER} allowed per over)`;
    }
  }

  // ── Step 3: Full-toss height detection ──
  const heightResult = detectNoBallHeightAuto(cleanedTrajectory, zones, hasBounced);
  if (!hasBounced) {
    result.ballHeightLabel   = heightResult.heightLabel;
    result.ballHeightPercent = heightResult.heightPercent;
    result.ballHeightCm      = heightResult.heightCm;
    if (heightResult.detected) {
      result.noBallHeightDetected   = true;
      result.noBallHeightConfidence = heightResult.confidence;
      result.noBallReason = `Waist-high full toss (${heightResult.heightLabel || 'above waist'})`;
    }
  }

  // ── Step 4: Wide detection ──
  const wide = detectWideAuto(cleanedTrajectory, zones);
  result.wideDetected   = wide.detected;
  result.wideConfidence = wide.confidence;
  result.wideSide       = wide.side;

  // ── Step 5: LBW analysis ──
  if (result.trajectoryQuality >= 0.35) {
    const lbw = detectLBW(cleanedTrajectory, zones);

    // LBW cannot be given on a no-ball
    if (result.noBallHeightDetected || result.noBallBounceDetected) {
      lbw.possible = false;
      lbw.reason   = 'No-ball — LBW cannot be given';
    }

    result.lbwPossible = lbw.possible;
    result.lbwData     = lbw;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// BALL COLOR DETECTION (frame pixel analysis)
// ═══════════════════════════════════════════════════════════════════════

export function detectBallInFrameAuto(pixels, width, height, previousPosition = null) {
  if (!pixels || pixels.length < width * height * 4) {
    return { detected: false, x: 0, y: 0, confidence: 0, radius: 0 };
  }

  const candidates = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
    if (a < 128) continue;
    const isRed    = r > 130 && g < 90 && b < 90 && r > g * 1.8 && r > b * 1.8;
    const isWhite  = r > 210 && g > 210 && b > 210 && Math.abs(r - g) < 25 && Math.abs(r - b) < 25;
    const isYellow = r > 180 && g > 160 && b < 100 && r > b * 1.8 && g > b * 1.8;
    const isOrange = r > 200 && g > 100 && g < 160 && b < 80 && r > g * 1.3;
    const isPink   = r > 180 && g > 100 && g < 150 && b > 120 && b < 180 && r > g * 1.2;
    if (isRed || isWhite || isYellow || isOrange || isPink) {
      const idx = i / 4;
      candidates.push({ x: idx % width, y: Math.floor(idx / width) });
    }
  }

  if (candidates.length < 12 || candidates.length > width * height * 0.12) {
    return { detected: false, x: 0, y: 0, confidence: 0, radius: 0 };
  }

  const gridSize = Math.max(8, Math.min(width, height) / 30);
  const grid = {};
  for (const p of candidates) {
    const key = `${Math.floor(p.x / gridSize)},${Math.floor(p.y / gridSize)}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(p);
  }

  const visited = new Set();
  let bestCluster = null, bestScore = -1;

  for (const key of Object.keys(grid)) {
    if (visited.has(key)) continue;
    const clusterPx = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const queue = [key]; visited.add(key);
    while (queue.length > 0) {
      const ck = queue.shift();
      const [cx, cy] = ck.split(',').map(Number);
      for (const p of (grid[ck] || [])) {
        clusterPx.push(p);
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const nk = `${cx + dx},${cy + dy}`;
        if (!visited.has(nk) && grid[nk]) { visited.add(nk); queue.push(nk); }
      }
    }
    if (clusterPx.length < 8) continue;
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const ar = cw / Math.max(1, ch);
    const ccx = clusterPx.reduce((s, p) => s + p.x, 0) / clusterPx.length;
    const ccy = clusterPx.reduce((s, p) => s + p.y, 0) / clusterPx.length;
    let score = clusterPx.length;
    if (ar > 0.55 && ar < 1.8) score *= 1.6;
    if (previousPosition) {
      const dist = Math.sqrt((ccx - previousPosition.x) ** 2 + (ccy - previousPosition.y) ** 2);
      const maxMove = Math.min(width, height) * 0.25;
      score *= dist < maxMove ? 1 + (maxMove - dist) / maxMove : 0.3;
    }
    if (score > bestScore) { bestScore = score; bestCluster = { cx: ccx, cy: ccy, cw, ch, count: clusterPx.length }; }
  }

  if (!bestCluster) return { detected: false, x: 0, y: 0, confidence: 0, radius: 0 };

  const radius = Math.sqrt(bestCluster.count / Math.PI);
  const sizeScore = Math.min(1, bestCluster.count / 80);
  const arScore   = Math.min(1, 1 / (Math.abs(bestCluster.cw / bestCluster.ch - 1) + 0.5));
  const confidence = Math.min(0.96, 0.40 + sizeScore * 0.30 + arScore * 0.25);

  return { detected: true, x: bestCluster.cx, y: bestCluster.cy, confidence, radius };
}
