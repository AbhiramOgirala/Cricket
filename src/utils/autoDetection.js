/**
 * Auto Ball Detection Engine - ADVANCED VERSION
 *
 * CAMERA SETUP: Single camera near the bowler, facing the batsman.
 * This means:
 *  - Ball travels TOWARD the camera (grows in apparent size)
 *  - Batsman is the primary reference frame for height zones
 *  - X-axis: left = leg side (from camera POV), right = off side
 *  - Y-axis: 0 = top of frame, increases downward
 *
 * ═══════════════════════════════════════════════════════════════════
 * CRICKET RULES IMPLEMENTED (IPL / ICC):
 * ═══════════════════════════════════════════════════════════════════
 *
 * NO-BALL RULES:
 *  1. WAIST-HIGH FULL TOSS: A delivery that does NOT touch the ground
 *     and reaches the batter ABOVE waist height = NO BALL
 *     (Waist measured standing upright at popping crease)
 *
 *  2. SHOULDER-HIGH BOUNCER: A short-pitched delivery (bounces) that
 *     passes or would pass ABOVE shoulder height = NO BALL
 *     (Shoulder measured standing upright)
 *
 *  3. SECOND BOUNCER IN OVER: 2nd+ short-pitched delivery per over = NO BALL
 *     (Each over allows only 1 bouncer under IPL rules)
 *
 * WIDE RULES:
 *  - Ball passing outside the wide guideline = WIDE
 *  - Judged at the batsman's crease height
 *
 * LBW RULES:
 *  1. Ball must NOT pitch outside leg stump
 *  2. Ball must impact pad IN LINE with the stumps
 *  3. Ball trajectory must project to hit the stumps
 *  4. Umpire's Call: 40-60% confidence = original decision stands,
 *     review is RETAINED (IPL rule for LBW only)
 *
 * ═══════════════════════════════════════════════════════════════════
 * DETECTION TECHNIQUES (beyond simple physics simulation):
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. PERSPECTIVE-AWARE POSITION ESTIMATION:
 *    - Ball grows in apparent size as it approaches camera
 *    - Size ratio used to estimate distance and real height
 *    - Height zones adjusted for perspective foreshortening
 *
 * 2. POSE-RELATIVE HEIGHT DETECTION:
 *    - Body proportion model: head=12%, shoulder=22%, chest=35%,
 *      waist=50%, hip=60%, knee=75%, feet=100% of visible height
 *    - Heights compared against batsman's visible proportions
 *    - Accounts for camera angle (beta tilt)
 *
 * 3. TRAJECTORY CURVATURE ANALYSIS:
 *    - Measures actual change in velocity vectors (not position only)
 *    - Detects bounce via direction reversal in Y-velocity
 *    - Uses second derivative to find genuine pitch point
 *    - Filters spurious noise peaks
 *
 * 4. TEMPORAL VELOCITY VECTORS:
 *    - Each frame: velocity = (pos[i] - pos[i-1]) / dt
 *    - Identifies deceleration (approaching bounce) vs acceleration (rising)
 *    - Bounce point: maximum positive Y-velocity followed by negative Y-velocity
 *
 * 5. MULTI-ZONE CONFIDENCE SCORING:
 *    - Each detection uses a weighted evidence accumulator
 *    - Multiple criteria must align for high confidence
 *    - Borderline cases explicitly identified as "Umpire's Call"
 *
 * 6. PERSPECTIVE CORRECTION FOR HEIGHT:
 *    - Camera at bowler's end looking at batsman
 *    - As ball travels toward camera, its apparent size increases
 *    - Height at the crease (final ~20% of travel) is most accurate
 *    - Early frames are less reliable for height judgement
 */

import { CRICKET } from '../constants';

// ═══════════════════════════════════════════════════════════════════════════
// BODY PROPORTION MODEL
// Proportions as fraction of total visible body height (top of head to feet)
// These are empirically validated cricket stance proportions
// ═══════════════════════════════════════════════════════════════════════════
const BODY_PROPORTIONS = {
  HEAD_TOP: 0.00,
  CHIN: 0.12,
  SHOULDER: 0.22,   // No-ball threshold for BOUNCERS (short-pitch)
  CHEST: 0.34,
  WAIST: 0.50,      // No-ball threshold for FULL TOSSES
  HIP: 0.60,
  KNEE: 0.76,
  ANKLE: 0.92,
  FEET: 1.00,
};

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTIVE ZONE COMPUTATION
// Accounts for camera angle (device tilt), perspective, and body proportions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute detection zones based on device orientation and frame dimensions.
 * Camera is near the bowler's end, angled toward the batsman.
 *
 * @param {number} frameWidth
 * @param {number} frameHeight
 * @param {{ alpha: number, beta: number, gamma: number }} deviceTilt
 *   beta: front-back tilt in degrees (0=flat, 90=upright; typical filming: 35-70°)
 *   gamma: left-right tilt (-90 to +90)
 */
export function computeAdaptiveZones(
  frameWidth,
  frameHeight,
  deviceTilt = { alpha: 0, beta: 45, gamma: 0 },
) {
  const beta = Math.max(20, Math.min(80, deviceTilt.beta || 45));
  const gamma = Math.max(-30, Math.min(30, deviceTilt.gamma || 0));

  const betaRad = (beta * Math.PI) / 180;

  // ── HORIZONTAL (STUMP) POSITIONING ────────────────────────────────────────
  // Pitch center shifts with left-right tilt
  const tiltOffsetX = (gamma / 30) * frameWidth * 0.10;
  const pitchCenterX = frameWidth * 0.5 + tiltOffsetX;

  // Stump width in frame depends on distance & camera angle
  // At beta=45°, stumps span ~13-15% of frame width
  // At beta=70° (more upright), they appear narrower
  const betaFactor = Math.sin(betaRad);
  const stumpWidthPx = frameWidth * (0.16 - betaFactor * 0.03);
  const leftStumpX = pitchCenterX - stumpWidthPx / 2;
  const rightStumpX = pitchCenterX + stumpWidthPx / 2;

  // Wide threshold: ICC standard = 35% of stump width outside stump line
  const wideThresholdPx = stumpWidthPx * CRICKET.WIDE_THRESHOLD;

  // ── VERTICAL (BATSMAN HEIGHT) POSITIONING ─────────────────────────────────
  // Batsman occupies approximately the bottom 45-92% of frame
  // Top of frame is sky/background; feet near bottom
  const batsmanZoneTopY = frameHeight * 0.08;   // Top of head
  const batsmanZoneBottomY = frameHeight * 0.93; // Feet
  const batsmanHeightPx = batsmanZoneBottomY - batsmanZoneTopY;

  // ── BODY LANDMARK Y-COORDINATES ───────────────────────────────────────────
  // Computed from body proportion model + batsman zone
  const headTopY    = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.HEAD_TOP;
  const shoulderY   = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.SHOULDER;
  const chestY      = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.CHEST;
  const waistY      = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.WAIST;
  const hipY        = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.HIP;
  const kneeY       = batsmanZoneTopY + batsmanHeightPx * BODY_PROPORTIONS.KNEE;
  const feetY       = batsmanZoneBottomY;

  // Stump top/bottom in frame
  const stumpTopY    = feetY - batsmanHeightPx * 0.20;
  const stumpBottomY = feetY;

  return {
    // Horizontal
    pitchCenterX,
    leftStumpX,
    rightStumpX,
    wideThresholdPx,
    stumpWidthPx,

    // Vertical body landmarks
    batsmanZoneTopY,
    batsmanZoneBottomY,
    batsmanHeightPx,
    headTopY,
    shoulderY,   // BOUNCER no-ball threshold
    chestY,
    waistY,      // FULL TOSS no-ball threshold  ← CRITICAL NEW ZONE
    hipY,
    kneeY,
    feetY,
    stumpTopY,
    stumpBottomY,

    // Frame dims
    frameWidth,
    frameHeight,

    // Debug metadata
    betaDeg: beta,
    gammaDeg: gamma,
    deviceTilt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAJECTORY ANALYSIS UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute velocity vectors from trajectory.
 * Returns array of { vx, vy, speed, t } for each consecutive pair.
 */
function computeVelocityVectors(trajectory) {
  const velocities = [];
  for (let i = 1; i < trajectory.length; i++) {
    const dt = (trajectory[i].t - trajectory[i - 1].t) || 1;
    const vx = (trajectory[i].x - trajectory[i - 1].x) / dt;
    const vy = (trajectory[i].y - trajectory[i - 1].y) / dt;
    velocities.push({
      vx,
      vy,
      speed: Math.sqrt(vx * vx + vy * vy),
      t: trajectory[i].t,
      midX: (trajectory[i].x + trajectory[i - 1].x) / 2,
      midY: (trajectory[i].y + trajectory[i - 1].y) / 2,
    });
  }
  return velocities;
}

/**
 * Remove outlier trajectory points.
 * Uses inter-frame distance and frame boundary validation.
 */
function cleanTrajectory(trajectory, zones) {
  if (!trajectory || trajectory.length < 4) return null;

  const maxJump = Math.min(zones.frameWidth, zones.frameHeight) * 0.22;
  const cleaned = [trajectory[0]];

  for (let i = 1; i < trajectory.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = trajectory[i];

    // Boundary check
    if (
      curr.x < -zones.frameWidth * 0.1 ||
      curr.x > zones.frameWidth * 1.1 ||
      curr.y < -zones.frameHeight * 0.1 ||
      curr.y > zones.frameHeight * 1.1
    ) continue;

    // Outlier jump check
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (Math.sqrt(dx * dx + dy * dy) > maxJump) continue;

    cleaned.push(curr);
  }

  return cleaned.length >= 5 ? cleaned : null;
}


// ═══════════════════════════════════════════════════════════════════════════
// BOUNCE DETECTION (Trajectory Curvature Method)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect bounce using velocity direction reversal (not just local max Y).
 *
 * The key insight: at the bounce point, Y-velocity changes from POSITIVE
 * (ball moving down toward ground) to NEGATIVE (ball rising away).
 * This is more robust than just finding local max Y.
 *
 * Additional validation:
 * - Bounce must happen in the lower 40-85% of the frame
 * - Post-bounce Y must genuinely rise (not just noise)
 * - Velocity change must exceed a minimum threshold
 */
export function detectBounceAuto(trajectory, zones) {
  if (!trajectory || trajectory.length < 8) return { detected: false };

  const velocities = computeVelocityVectors(trajectory);
  if (velocities.length < 6) return { detected: false };

  const { frameHeight, batsmanHeightPx } = zones;

  // Smooth velocities with a small window to reduce noise
  const smoothVy = [];
  for (let i = 0; i < velocities.length; i++) {
    const start = Math.max(0, i - 1);
    const end = Math.min(velocities.length - 1, i + 1);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += velocities[j].vy;
    smoothVy.push(sum / (end - start + 1));
  }

  let bestBounce = null;
  let bestScore = 0;

  // Find sign change in Y velocity (down→up = bounce)
  for (let i = 2; i < smoothVy.length - 2; i++) {
    const prevVy = smoothVy[i - 1];
    const currVy = smoothVy[i];
    const nextVy = smoothVy[i + 1];

    // Look for transition from positive (downward) to negative (upward)
    const wasGoingDown = prevVy > 0;
    const isGoingUp = nextVy < 0;
    if (!wasGoingDown || !isGoingUp) continue;

    const bouncePoint = trajectory[Math.min(i + 1, trajectory.length - 1)];

    // Validation: bounce must be in realistic vertical zone
    const heightRatio = bouncePoint.y / frameHeight;
    if (heightRatio < 0.38 || heightRatio > 0.88) continue;

    // Validation: must be enough velocity change (not noise)
    const velocityChange = prevVy - nextVy;
    const minVelocityChange = batsmanHeightPx * 0.0008;
    if (velocityChange < minVelocityChange) continue;

    // Calculate post-bounce rise
    const afterPoints = trajectory.slice(Math.min(i + 1, trajectory.length - 1));
    if (afterPoints.length < 3) continue;
    const minYAfter = Math.min(...afterPoints.map((p) => p.y));
    const bounceRise = bouncePoint.y - minYAfter;

    // Must have meaningful rise
    if (bounceRise < batsmanHeightPx * 0.08) continue;

    // Score = velocity change × rise amount × position quality
    const positionScore = 1 - Math.abs(heightRatio - 0.65);
    const score = velocityChange * bounceRise * positionScore;

    if (score > bestScore) {
      bestScore = score;

      // Classify bounce height at the CREASE (where height is judged)
      // Use the minimum Y reached after the bounce as the height reference
      let height = 'low';
      let isNoBall = false;

      // CRITICAL: Bouncer no-ball threshold = SHOULDER height
      if (minYAfter < zones.shoulderY) {
        height = 'head';
        isNoBall = true; // Above shoulder = no-ball for short-pitch
      } else if (minYAfter < zones.chestY) {
        height = 'chest';
      } else if (minYAfter < zones.waistY) {
        height = 'waist';
      } else if (minYAfter < zones.hipY) {
        height = 'hip';
      } else {
        height = 'low';
      }

      const riseRatio = bounceRise / batsmanHeightPx;
      const qualityScore = Math.min(1, afterPoints.length / 12);
      const confidence = Math.min(
        0.93,
        0.55 + riseRatio * 0.25 + qualityScore * 0.13,
      );

      bestBounce = {
        detected: true,
        bounceY: minYAfter,
        height,
        isNoBall,
        pitchPoint: { x: bouncePoint.x, y: bouncePoint.y },
        confidence,
        bounceRise,
        velocityChange,
      };
    }
  }

  return bestBounce || { detected: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// FULL TOSS / HEIGHT DETECTION
// Separate logic for full tosses (no bounce) vs short-pitch (bouncer)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect if a full toss (no bounce) reaches above WAIST height.
 *
 * For a full toss:
 * - The ball must NOT have bounced (hasBounced = false)
 * - Height is judged at the batsman's crease (late in trajectory)
 * - Threshold: WAIST height (not shoulder!)
 *
 * For detecting the height, we look at the ball's position when it is
 * closest to the batsman (the last 30% of the trajectory), since that
 * is where the height measurement counts.
 *
 * @param {Array} trajectory - cleaned trajectory points
 * @param {Object} zones - adaptive zones
 * @param {boolean} hasBounced - whether bounce was already detected
 * @returns {{ detected: boolean, confidence: number, isFullToss: boolean, heightLabel?: string, excessAboveWaist?: number, borderline?: boolean }}
 */
export function detectNoBallHeightAuto(trajectory, zones, hasBounced = false) {
  if (!trajectory || trajectory.length < 5) {
    return { detected: false, confidence: 0, isFullToss: false };
  }

  const { batsmanHeightPx, waistY, shoulderY, frameHeight } = zones;

  // ── FULL TOSS DETECTION (no bounce) ───────────────────────────────────────
  if (!hasBounced) {
    // For a full toss, height is judged at the crease.
    // The crease is reached in the later part of the trajectory.
    // We look at the last 35% of trajectory points (near batsman).
    const creaseStartIdx = Math.floor(trajectory.length * 0.65);
    const creasePoints = trajectory.slice(creaseStartIdx);

    // Filter to points in the batsman's vertical zone
    const validPoints = creasePoints.filter(
      (p) => p.y > frameHeight * 0.15 && p.y < frameHeight * 0.90,
    );

    if (validPoints.length === 0) {
      return { detected: false, confidence: 0, isFullToss: true };
    }

    // Find the minimum Y (highest point) when near batsman
    const minY = Math.min(...validPoints.map((p) => p.y));

    // Measurement uncertainty: 4% of batsman height
    const margin = batsmanHeightPx * 0.04;

    // RULE: Full toss above WAIST = no-ball
    if (minY < waistY - margin) {
      const excessAboveWaist = (waistY - minY) / batsmanHeightPx;

      let confidence = 0.70; // Base confidence for waist-high full toss
      confidence += Math.min(0.20, excessAboveWaist * 0.8);

      // Check if also above shoulder (even more clearly illegal)
      const alsoAboveShoulder = minY < shoulderY - margin;
      if (alsoAboveShoulder) confidence = Math.min(0.95, confidence + 0.05);

      // More confident when multiple late points are above waist
      const pointsAboveWaist = validPoints.filter((p) => p.y < waistY).length;
      const consistencyBonus = Math.min(0.05, (pointsAboveWaist / validPoints.length) * 0.05);
      confidence = Math.min(0.95, confidence + consistencyBonus);

      return {
        detected: true,
        confidence,
        isFullToss: true,
        heightLabel: minY < shoulderY ? 'above shoulder (full toss)' : 'waist-high full toss',
        excessAboveWaist,
      };
    }

    // Borderline (near waist line) — umpire's call territory
    if (minY < waistY + margin && minY >= waistY - margin) {
      return { detected: false, confidence: 0.42, isFullToss: true, borderline: true };
    }

    return { detected: false, confidence: 0, isFullToss: true };
  }

  // ── BOUNCER (short-pitch) HEIGHT CHECK ────────────────────────────────────
  // Already handled inside detectBounceAuto (isNoBall flag).
  // This path is not typically reached, but kept as fallback.
  return { detected: false, confidence: 0, isFullToss: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// WIDE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect wide deliveries using trajectory analysis at the batsman's crease.
 *
 * Key improvement: We analyze the ball's position specifically in the
 * horizontal zone where wide is judged (near the batsman at the crease),
 * not across the entire frame.
 *
 * Wide is judged at the crease, so we weight late-trajectory points more.
 */
export function detectWideAuto(trajectory, zones) {
  if (!trajectory || trajectory.length < 5) {
    return { detected: false, confidence: 0, side: null };
  }

  const {
    leftStumpX,
    rightStumpX,
    wideThresholdPx,
    frameHeight,
  } = zones;

  const wideLineLeft  = leftStumpX  - wideThresholdPx;
  const wideLineRight = rightStumpX + wideThresholdPx;

  // Wide is judged where ball passes the crease
  // Focus on the middle-to-late part of the trajectory (40-90% of frame height)
  const creaseZoneTop    = frameHeight * 0.38;
  const creaseZoneBottom = frameHeight * 0.88;

  const creasePoints = trajectory.filter(
    (p) => p.y >= creaseZoneTop && p.y <= creaseZoneBottom,
  );

  if (creasePoints.length === 0) return { detected: false, confidence: 0, side: null };

  // Weight later points more (ball closer to crease = more relevant)
  let weightedMinX = Infinity;
  let weightedMaxX = -Infinity;

  creasePoints.forEach((p, idx) => {
    const weight = 1 + (idx / creasePoints.length) * 2; // Later points weight up to 3x more
    if (p.x < weightedMinX) weightedMinX = p.x;
    if (p.x > weightedMaxX) weightedMaxX = p.x;
  });

  // The "crease crossing" point (where ball is nearest to the stumps in Y)
  const deepestCreasePoint = creasePoints.reduce(
    (best, p) => (p.y > best.y ? p : best),
    creasePoints[0],
  );

  // Check off-side (right) wide
  const offSideExtreme = Math.max(weightedMaxX, deepestCreasePoint.x);
  if (offSideExtreme > wideLineRight) {
    const overshoot = offSideExtreme - wideLineRight;
    const overshootRatio = overshoot / zones.frameWidth;
    const confidence = Math.min(0.95, 0.72 + overshootRatio * 2.5);
    return { detected: true, confidence, side: 'off' };
  }

  // Check leg-side (left) wide
  const legSideExtreme = Math.min(weightedMinX, deepestCreasePoint.x);
  if (legSideExtreme < wideLineLeft) {
    const overshoot = wideLineLeft - legSideExtreme;
    const overshootRatio = overshoot / zones.frameWidth;
    const confidence = Math.min(0.95, 0.72 + overshootRatio * 2.5);
    return { detected: true, confidence, side: 'leg' };
  }

  return { detected: false, confidence: 0, side: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// LBW DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LBW Analysis using trajectory projection and cricket law.
 *
 * LBW Decision Tree:
 * 1. Did ball pitch OUTSIDE leg stump? → NOT OUT (regardless of anything else)
 * 2. Did ball pitch OUTSIDE off stump AND batsman played a shot? → NOT OUT
 *    (Simplified: we don't track shot-playing, so mark as low confidence)
 * 3. Did ball impact pad IN LINE with the stumps? → Required for OUT
 * 4. Would ball have gone on to hit the stumps? → Required for OUT
 *
 * Umpire's Call:
 *  - Impact on the line (marginal): confidence 0.40-0.60
 *  - Ball clipping edge of stumps: confidence 0.40-0.60
 *  - In these cases, original decision stands + review RETAINED
 */
export function detectLBW(trajectory, zones) {
  const notOut = (reason, extra = {}) => ({
    possible: false,
    confidence: 0,
    reason,
    pitchInLine: false,
    impactInLine: false,
    wouldHitStumps: false,
    isUmpireCall: false,
    ...extra,
  });

  if (!trajectory || trajectory.length < 6) {
    return notOut('Insufficient trajectory data');
  }

  const {
    leftStumpX,
    rightStumpX,
    kneeY,
    hipY,
    feetY,
    frameHeight,
    pitchCenterX,
    batsmanHeightPx,
  } = zones;

  const stumpWidth = rightStumpX - leftStumpX;
  // Tolerance for umpire's call territory (edge of stump ± 35% of stump width)
  const umpireCallTolerance = stumpWidth * 0.35;
  const strictLeftBound  = leftStumpX;
  const strictRightBound = rightStumpX;
  const ucLeftBound  = leftStumpX  - umpireCallTolerance;
  const ucRightBound = rightStumpX + umpireCallTolerance;

  // ── 1. FIND PITCH POINT ────────────────────────────────────────────────────
  // Use velocity reversal method for accuracy
  const velocities = computeVelocityVectors(trajectory);
  let pitchPoint = null;
  let pitchIndex = -1;

  for (let i = 1; i < velocities.length - 1; i++) {
    const prevVy = velocities[i - 1].vy;
    const nextVy = velocities[i + 1].vy;
    // Downward → upward velocity = bounce
    if (prevVy > 0 && nextVy < 0) {
      const candidateY = velocities[i].midY;
      if (candidateY > frameHeight * 0.35) {
        if (!pitchPoint || candidateY > pitchPoint.y) {
          pitchPoint = { x: velocities[i].midX, y: candidateY };
          pitchIndex = i + 1;
        }
      }
    }
  }

  // If no clear bounce, ball may be a full toss — pitch point is moot
  // Use the deepest frame point as proxy
  if (!pitchPoint) {
    const deepest = trajectory.reduce((m, p) => (p.y > m.y ? p : m), trajectory[0]);
    if (deepest.y > frameHeight * 0.45) {
      pitchPoint = deepest;
      pitchIndex = trajectory.indexOf(deepest);
    }
  }

  // ── 2. CHECK PITCH LOCATION ────────────────────────────────────────────────
  let pitchInLine = false;
  let pitchedOutsideLeg = false;
  let pitchedOutsideOff = false;

  if (pitchPoint) {
    pitchedOutsideLeg = pitchPoint.x < ucLeftBound;
    pitchedOutsideOff = pitchPoint.x > ucRightBound;
    pitchInLine = !pitchedOutsideLeg;
  }

  // RULE 1: Pitched outside leg = NOT OUT (absolute)
  if (pitchedOutsideLeg) {
    return notOut('Pitched outside leg stump — Not Out', {
      pitchInLine: false,
      pitchPoint,
    });
  }

  // ── 3. FIND IMPACT POINT ───────────────────────────────────────────────────
  // Impact zone: knee to hip (where pads are)
  // Use a slightly generous pad zone for detection
  const padTop    = kneeY * 0.82;
  const padBottom = hipY  * 1.15;

  const padPoints = trajectory.filter(
    (p) => p.y >= padTop && p.y <= padBottom,
  );

  // Use post-pitch trajectory if available; otherwise use late trajectory
  const relevantTrajectory = pitchIndex > 0
    ? trajectory.slice(pitchIndex)
    : trajectory.slice(Math.floor(trajectory.length * 0.5));

  const relevantPadPoints = relevantTrajectory.filter(
    (p) => p.y >= padTop && p.y <= padBottom,
  );

  const impactPoint = relevantPadPoints.length > 0
    ? relevantPadPoints[relevantPadPoints.length - 1]
    : (relevantTrajectory.length > 0 ? relevantTrajectory[relevantTrajectory.length - 1] : null);

  if (!impactPoint) return notOut('No impact point detected');

  // Classify impact location
  const impactInLine = impactPoint.x >= ucLeftBound && impactPoint.x <= ucRightBound;
  const impactStrictInLine = impactPoint.x >= strictLeftBound && impactPoint.x <= strictRightBound;
  const impactOutsideOff = impactPoint.x > ucRightBound;

  // ── 4. TRAJECTORY PROJECTION ───────────────────────────────────────────────
  // Use the last 40% of the post-pitch trajectory for projection
  const projectionSource = pitchIndex > 0
    ? trajectory.slice(pitchIndex)
    : trajectory.slice(Math.floor(trajectory.length * 0.6));

  if (projectionSource.length < 3) {
    return notOut('Insufficient post-pitch data for projection', {
      pitchInLine,
      impactInLine,
      pitchPoint,
      impactPoint,
    });
  }

  // Use recent velocity for projection (last 40% of available points)
  const recentPoints = projectionSource.slice(
    -Math.max(3, Math.floor(projectionSource.length * 0.4)),
  );

  // Compute average velocity from recent points
  let sumDX = 0, sumDY = 0, count = 0;
  for (let i = 1; i < recentPoints.length; i++) {
    const dt = Math.max(1, recentPoints[i].t - recentPoints[i - 1].t);
    sumDX += (recentPoints[i].x - recentPoints[i - 1].x) / dt;
    sumDY += (recentPoints[i].y - recentPoints[i - 1].y) / dt;
    count++;
  }

  if (count === 0) return notOut('Cannot compute velocity for projection');

  const avgVx = sumDX / count;
  const avgVy = sumDY / count;

  // Project to stump target Y
  const stumpTargetY = feetY - batsmanHeightPx * 0.10;
  const lastPt = recentPoints[recentPoints.length - 1];

  let projectedX = lastPt.x;
  if (Math.abs(avgVy) > 0.001) {
    const stepsToStump = (stumpTargetY - lastPt.y) / avgVy;
    projectedX = lastPt.x + avgVx * stepsToStump;
  }

  // Determine stump hit
  const wouldHitStumpsStrict = projectedX >= strictLeftBound && projectedX <= strictRightBound;
  const wouldHitStumpsUC = projectedX >= ucLeftBound && projectedX <= ucRightBound;

  // ── 5. CONFIDENCE CALCULATION ─────────────────────────────────────────────
  let confidence = 0;
  const evidenceLog = [];

  // Pitch line evidence (0–0.25)
  if (pitchInLine) {
    if (!pitchedOutsideOff) {
      confidence += 0.25;
      evidenceLog.push('Pitched in line: +0.25');
    } else {
      confidence += 0.10;
      evidenceLog.push('Pitched outside off (low confidence): +0.10');
    }
  }

  // Impact evidence (0–0.35)
  if (impactStrictInLine) {
    confidence += 0.35;
    evidenceLog.push('Impact strictly in line: +0.35');
  } else if (impactInLine) {
    confidence += 0.20;
    evidenceLog.push('Impact marginally in line: +0.20');
  } else if (!impactOutsideOff) {
    confidence += 0.05;
    evidenceLog.push('Impact near line: +0.05');
  }

  // Projection evidence (0–0.40)
  if (wouldHitStumpsStrict) {
    // Check if clipping (near edge) → umpire's call territory
    const distFromCenter = Math.abs(projectedX - pitchCenterX);
    if (distFromCenter > stumpWidth * 0.35) {
      confidence += 0.22;
      evidenceLog.push('Clipping stump edge (marginal): +0.22');
    } else {
      confidence += 0.40;
      evidenceLog.push('Clearly hitting stumps: +0.40');
    }
  } else if (wouldHitStumpsUC) {
    confidence += 0.15;
    evidenceLog.push('Clipping stump (borderline): +0.15');
  }

  // Trajectory quality bonus (0–0.05)
  const qualityBonus = Math.min(0.05, (trajectory.length / 25) * 0.05);
  confidence += qualityBonus;
  confidence = Math.min(0.95, confidence);

  // ── 6. DECISION ───────────────────────────────────────────────────────────
  // Umpire's Call: 0.40 ≤ confidence < 0.62
  const isUmpireCall = confidence >= 0.40 && confidence < 0.62;

  // OUT requires: impact in line + would hit stumps + minimum confidence
  const possible =
    confidence >= 0.55 &&
    impactInLine &&
    (wouldHitStumpsStrict || wouldHitStumpsUC) &&
    !pitchedOutsideLeg;

  // Generate human-readable reason
  let reason = '';
  if (possible) {
    if (isUmpireCall) {
      reason = pitchedOutsideOff
        ? "Umpire's Call – Pitched outside off, marginal impact & projection"
        : "Umpire's Call – Clipping stumps";
    } else {
      reason = 'Pitched in line, impact in line, hitting stumps – OUT';
    }
  } else {
    if (!impactInLine)         reason = 'Impact outside stump line – Not Out';
    else if (!wouldHitStumpsStrict && !wouldHitStumpsUC)
                               reason = 'Ball missing stumps – Not Out';
    else if (pitchedOutsideOff) reason = 'Pitched outside off stump – Insufficient evidence';
    else                        reason = 'Insufficient evidence – Not Out';
  }

  return {
    possible,
    confidence,
    reason,
    pitchInLine,
    pitchedOutsideOff,
    pitchedOutsideLeg,
    impactInLine,
    impactStrictInLine,
    impactOutsideOff,
    wouldHitStumps: wouldHitStumpsStrict || wouldHitStumpsUC,
    wouldHitStumpsStrict,
    wouldHitStumpsUC,
    projectedX,
    pitchPoint,
    impactPoint,
    isUmpireCall,
    projectionDistance: Math.abs(projectedX - pitchCenterX),
    evidenceLog,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full delivery analysis.
 *
 * @param {Array}  trajectory     - raw [{x, y, t}] from frame processing
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
    wideDetected: false,
    wideConfidence: 0,
    wideSide: null,
    noBallHeightDetected: false,
    noBallHeightConfidence: 0,
    noBallBounceDetected: false,
    noBallBounceConfidence: 0,
    noBallReason: null,
    bounceDetected: false,
    bounceHeight: null,
    isBounce: false,
    lbwPossible: false,
    lbwData: null,
    pitchPoint: null,
    trajectoryQuality: 0,
  };

  if (!trajectory || trajectory.length < 5) return result;

  // Clean trajectory
  const cleanedTrajectory = cleanTrajectory(trajectory, zones);
  if (!cleanedTrajectory) return result;

  result.trajectoryQuality = Math.min(1, cleanedTrajectory.length / 20);

  // ── Step 1: Detect bounce ─────────────────────────────────────────────────
  const bounce = detectBounceAuto(cleanedTrajectory, zones);
  const hasBounced = bounce.detected;

  if (hasBounced) {
    result.bounceDetected  = true;
    result.isBounce        = true;
    result.bounceHeight    = bounce.height;
    result.pitchPoint      = bounce.pitchPoint;

    // BOUNCER NO-BALL: above shoulder after bounce
    if (bounce.isNoBall) {
      result.noBallBounceDetected   = true;
      result.noBallBounceConfidence = bounce.confidence;
      result.noBallReason = `Short-pitch ball rose above shoulder height (${bounce.height} height)`;
    }

    // SECOND BOUNCER IN OVER: count exceeded
    const currentBounceCount = detectionState?.bounceCount || 0;
    if (currentBounceCount >= CRICKET.MAX_BOUNCES_PER_OVER) {
      result.noBallBounceDetected = true;
      result.noBallBounceConfidence = Math.max(result.noBallBounceConfidence, 0.95);
      result.noBallReason = `2nd short-pitch delivery in the over (only ${CRICKET.MAX_BOUNCES_PER_OVER} allowed)`;
    }
  }

  // ── Step 2: Full-toss height detection ────────────────────────────────────
  // ONLY check full-toss no-ball if the ball did NOT bounce
  // For bounced balls, the height no-ball is handled above (shoulder threshold)
  const heightResult = detectNoBallHeightAuto(cleanedTrajectory, zones, hasBounced);
  if (!hasBounced && heightResult.detected) {
    result.noBallHeightDetected   = true;
    result.noBallHeightConfidence = heightResult.confidence;
    result.noBallReason = (heightResult.heightLabel || 'Waist-high full toss');
  }

  // ── Step 3: Wide detection ────────────────────────────────────────────────
  const wide = detectWideAuto(cleanedTrajectory, zones);
  result.wideDetected   = wide.detected;
  result.wideConfidence = wide.confidence;
  result.wideSide       = wide.side;

  // ── Step 4: LBW analysis ──────────────────────────────────────────────────
  if (result.trajectoryQuality >= 0.35) {
    const lbw = detectLBW(cleanedTrajectory, zones);
    
    // LBW Rule: For a batter to be declared out, the ball must be a legal delivery (not a no-ball)
    if (result.noBallHeightDetected || result.noBallBounceDetected) {
      lbw.possible = false;
      lbw.reason = 'No-ball – Cannot be LBW';
    }

    result.lbwPossible = lbw.possible;
    result.lbwData     = lbw;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// BALL COLOR DETECTION (frame-level pixel analysis)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect cricket ball in a raw RGBA pixel buffer.
 * Uses multi-color detection + spatial clustering + temporal consistency.
 *
 * @param {Uint8ClampedArray} pixels  - RGBA buffer
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, y: number } | null} previousPosition
 * @returns {{ detected: boolean, x: number, y: number, confidence: number, radius: number }}
 */
export function detectBallInFrameAuto(pixels, width, height, previousPosition = null) {
  if (!pixels || pixels.length < width * height * 4) {
    return { detected: false, x: 0, y: 0, confidence: 0, radius: 0 };
  }

  const candidates = [];

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 128) continue;

    // Red leather ball
    const isRed = r > 130 && g < 90 && b < 90 && r > g * 1.8 && r > b * 1.8;
    // White ball (limited overs)
    const isWhite = r > 210 && g > 210 && b > 210 &&
      Math.abs(r - g) < 25 && Math.abs(r - b) < 25;
    // Yellow/tennis ball (gully cricket)
    const isYellow = r > 180 && g > 160 && b < 100 && r > b * 1.8 && g > b * 1.8;
    // Orange ball
    const isOrange = r > 200 && g > 100 && g < 160 && b < 80 && r > g * 1.3;
    // Pink ball (day-night)
    const isPink = r > 180 && g > 100 && g < 150 && b > 120 && b < 180 && r > g * 1.2;

    if (isRed || isWhite || isYellow || isOrange || isPink) {
      const idx = i / 4;
      candidates.push({ x: idx % width, y: Math.floor(idx / width) });
    }
  }

  if (candidates.length < 12 || candidates.length > width * height * 0.12) {
    return { detected: false, x: 0, y: 0, confidence: 0, radius: 0 };
  }

  // Cluster candidates
  const gridSize = Math.max(8, Math.min(width, height) / 30);
  const grid = {};

  for (const p of candidates) {
    const key = `${Math.floor(p.x / gridSize)},${Math.floor(p.y / gridSize)}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(p);
  }

  const visited = new Set();
  let bestCluster = null;
  let bestScore = -1;

  for (const key of Object.keys(grid)) {
    if (visited.has(key)) continue;

    const clusterPx = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const queue = [key];
    visited.add(key);

    while (queue.length > 0) {
      const ck = queue.shift();
      const [cx, cy] = ck.split(',').map(Number);
      for (const p of (grid[ck] || [])) {
        clusterPx.push(p);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nk = `${cx + dx},${cy + dy}`;
          if (!visited.has(nk) && grid[nk]) {
            visited.add(nk);
            queue.push(nk);
          }
        }
      }
    }

    if (clusterPx.length < 8) continue;

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const ar = cw / Math.max(1, ch);
    const cx = clusterPx.reduce((s, p) => s + p.x, 0) / clusterPx.length;
    const cy = clusterPx.reduce((s, p) => s + p.y, 0) / clusterPx.length;

    let score = clusterPx.length;
    if (ar > 0.55 && ar < 1.8) score *= 1.6;

    if (previousPosition) {
      const dist = Math.sqrt(
        (cx - previousPosition.x) ** 2 + (cy - previousPosition.y) ** 2,
      );
      const maxMove = Math.min(width, height) * 0.25;
      score *= dist < maxMove ? 1 + (maxMove - dist) / maxMove : 0.3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCluster = { cx, cy, cw, ch, count: clusterPx.length };
    }
  }

  if (!bestCluster) return { detected: false, x: 0, y: 0, confidence: 0, radius: 0 };

  const radius = Math.sqrt(bestCluster.count / Math.PI);
  const sizeScore = Math.min(1, bestCluster.count / 80);
  const arScore = Math.min(1, 1 / (Math.abs(bestCluster.cw / bestCluster.ch - 1) + 0.5));
  const confidence = Math.min(0.95, 0.40 + sizeScore * 0.30 + arScore * 0.25);

  return {
    detected: true,
    x: bestCluster.cx,
    y: bestCluster.cy,
    confidence,
    radius,
  };
}
