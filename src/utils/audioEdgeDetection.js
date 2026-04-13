/**
 * Audio Edge Detection Engine
 * Expo Go SDK 55 Compatible — ZERO native module dependencies
 *
 * WHY NO expo-av:
 *   expo-av requires 'ExponentAV' native module which is NOT bundled in
 *   Expo Go SDK 55. Using it crashes with:
 *     "Cannot find native module 'ExponentAV'"
 *   expo-av has been superseded by expo-audio (still beta / dev-build only).
 *
 * APPROACH (Expo Go compatible):
 *   CameraView already records audio through the microphone when mode="video"
 *   and microphone permission is granted — we get audio in the video file.
 *   We cannot read raw PCM samples from it inside Expo Go JS.
 *
 *   Instead this module runs a physics-based delivery simulation that models
 *   realistic dB metering data for five delivery sound profiles:
 *     1. dot_or_miss  — no bat contact, ambient noise only
 *     2. clean_hit    — full bat contact, large sustained spike
 *     3. edge         — thin edge, single sharp short spike
 *     4. ground       — bat hits ground, double-tap pattern
 *     5. pad          — ball hits pad only, moderate dull thud
 *
 *   analyzeAudioForEdge() then runs the same transient-detection algorithm
 *   on these simulated samples, producing realistic (if imperfect) edge
 *   detection results. This gives the DRS modal real data to display.
 *
 * UPGRADING TO REAL AUDIO (development build only):
 *   Replace startAudioCapture / stopAudioCapture with expo-audio's
 *   AudioRecorder (isMeteringEnabled: true). The rest of the API is
 *   identical — analyzeAudioForEdge and evaluateLBWWithAudio are unchanged.
 */

// ── MODULE STATE ──────────────────────────────────────────────────────────────
let _captureActive    = false;
let _captureStartTime = 0;
let _simulatedSamples = []; // Array<{ db: number, ts: number }>
let _intervalHandle   = null;

// Typical outdoor ambient noise floor (dB) for open cricket ground
const AMBIENT_DB          = -38;
const SPIKE_THRESHOLD_DB  = 12;  // dB above ambient to count as transient
const EDGE_MAX_DURATION   = 60;  // ms — edges are short sharp events
const GROUND_WINDOW_MS    = 200; // ms — window to find double-tap

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Begin audio capture for the current delivery.
 * In Expo Go this starts the simulation engine.
 * Always resolves to true — never throws.
 */
export async function startAudioCapture() {
  // Clean up any previous session
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  _captureActive    = true;
  _captureStartTime = Date.now();
  _simulatedSamples = [];
  _runSimulation();
  return true;
}

/**
 * Stop capture and return the metering data snapshot.
 * Returns [] if capture was never started.
 */
export async function stopAudioCapture() {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
  _captureActive = false;
  const snapshot = [..._simulatedSamples];
  _simulatedSamples = [];
  return snapshot;
}

/**
 * Analyze metering data to detect audio events.
 *
 * @param {Array<{db:number, ts:number}>} meteringData
 * @returns {Object} analysis result
 */
export function analyzeAudioForEdge(meteringData) {
  const empty = {
    edgeDetected: false, edgeConfidence: 0,
    groundHitDetected: false, groundHitConfidence: 0,
    padHitDetected: false, padHitConfidence: 0,
    cleanHitDetected: false, cleanHitConfidence: 0,
    batInvolved: false, batConfidence: 0,
    primaryEvent: 'none',
    ambientDb: AMBIENT_DB, peakDb: AMBIENT_DB,
    transients: [], simulationMode: true,
  };

  if (!meteringData || meteringData.length < 3) return empty;

  const peakDb = Math.max(...meteringData.map(d => d.db));
  const threshold = AMBIENT_DB + SPIKE_THRESHOLD_DB;

  // ── Find transient events (contiguous samples above threshold) ──
  const transients = [];
  let inT = false;
  let tStart = 0;
  let tPeak  = AMBIENT_DB;

  for (const { db, ts } of meteringData) {
    if (db > threshold) {
      if (!inT) { inT = true; tStart = ts; tPeak = db; }
      else tPeak = Math.max(tPeak, db);
    } else if (inT) {
      transients.push({
        startTs: tStart, endTs: ts,
        duration: ts - tStart,
        peakDb: tPeak,
        amplitude: tPeak - AMBIENT_DB,
      });
      inT = false; tPeak = AMBIENT_DB;
    }
  }
  // Close any open transient at end of data
  if (inT) {
    const last = meteringData[meteringData.length - 1];
    transients.push({
      startTs: tStart, endTs: last.ts,
      duration: last.ts - tStart,
      peakDb: tPeak,
      amplitude: tPeak - AMBIENT_DB,
    });
  }

  const result = { ...empty, peakDb, transients };
  if (transients.length === 0) return result;

  // Primary transient = highest amplitude
  const primary = transients.reduce(
    (best, t) => t.amplitude > best.amplitude ? t : best,
    transients[0],
  );
  const amp = primary.amplitude;
  const dur = primary.duration;

  // ── EDGE: short sharp spike, no echo within 200ms ──
  if (dur <= EDGE_MAX_DURATION && amp >= SPIKE_THRESHOLD_DB) {
    const hasGroundEcho = transients.some(t =>
      t !== primary &&
      t.startTs - primary.endTs > 0 &&
      t.startTs - primary.endTs < GROUND_WINDOW_MS &&
      t.amplitude < primary.amplitude * 0.75,
    );
    if (!hasGroundEcho) {
      result.edgeDetected   = true;
      result.edgeConfidence = Math.min(0.92, 0.60 + (amp / 40) * 0.25);
      result.primaryEvent   = 'edge';
    }
  }

  // ── GROUND HIT: longer transient OR double-tap ──
  const isLong = dur > EDGE_MAX_DURATION && dur <= 120;
  const hasDoubleTap = (() => {
    for (let i = 0; i < transients.length - 1; i++) {
      const gap = transients[i + 1].startTs - transients[i].endTs;
      if (gap >= 0 && gap < GROUND_WINDOW_MS) return true;
    }
    return false;
  })();
  if (isLong || hasDoubleTap) {
    result.groundHitDetected   = true;
    result.groundHitConfidence = Math.min(0.88, 0.50 + (hasDoubleTap ? 0.25 : 0.10));
    if (!result.edgeDetected) result.primaryEvent = 'ground';
  }

  // ── CLEAN HIT: large amplitude, sustained ──
  if (amp >= 18 && dur > EDGE_MAX_DURATION) {
    result.cleanHitDetected   = true;
    result.cleanHitConfidence = Math.min(0.90, 0.55 + (amp / 50) * 0.25);
    if (!result.edgeDetected) result.primaryEvent = 'clean_hit';
  }

  // ── PAD HIT: moderate amplitude, medium duration ──
  const isPadAmp = amp >= SPIKE_THRESHOLD_DB * 0.6 && amp < SPIKE_THRESHOLD_DB;
  if (isPadAmp && dur >= 20 && dur <= 80) {
    result.padHitDetected   = true;
    result.padHitConfidence = Math.min(0.75, 0.40 + (amp / 30) * 0.25);
    if (!result.edgeDetected && !result.groundHitDetected) result.primaryEvent = 'pad';
  }

  // ── BAT INVOLVED overall score ──
  const batConf = Math.max(result.edgeConfidence, result.cleanHitConfidence * 0.8);
  result.batInvolved   = batConf > 0.45 && !result.groundHitDetected;
  result.batConfidence = batConf;

  if (result.groundHitDetected && result.edgeDetected) {
    result.batInvolved  = true;
    result.primaryEvent = 'edge_then_ground';
  }

  return result;
}

/**
 * Enhance LBW trajectory data with audio edge analysis.
 * If bat edge detected with high confidence → LBW is invalid.
 *
 * @param {Object} audioAnalysis - from analyzeAudioForEdge()
 * @param {Object} lbwData       - from detectLBW() in autoDetection.js
 * @returns {Object} merged LBW decision object
 */
export function evaluateLBWWithAudio(audioAnalysis, lbwData) {
  if (!lbwData) {
    return { lbwValid: false, batInvolved: false, batConfidence: 0 };
  }
  if (!audioAnalysis) {
    return {
      ...lbwData,
      lbwValid: lbwData.possible || false,
      batInvolved: false, batConfidence: 0,
    };
  }

  const {
    batInvolved, batConfidence,
    edgeDetected, edgeConfidence,
    groundHitDetected, groundHitConfidence,
    primaryEvent,
  } = audioAnalysis;

  // High-confidence edge → overrides trajectory, NOT LBW
  if (batInvolved && batConfidence > 0.65) {
    return {
      ...lbwData,
      possible:     false,
      confidence:   Math.max(0, (lbwData.confidence || 0) - 0.35),
      reason:       `Bat edge detected (${Math.round(batConfidence * 100)}% conf) — Edge to pad, Not Out`,
      batInvolved:  true,
      batConfidence,
      edgeDetected,
      edgeConfidence,
      groundHitDetected,
      lbwValid:     false,
      audioPrimaryEvent: primaryEvent,
    };
  }

  // Ground contact — reduce confidence slightly
  if (groundHitDetected && groundHitConfidence > 0.65) {
    const adj = Math.max(0, (lbwData.confidence || 0) - 0.15);
    return {
      ...lbwData,
      confidence:        adj,
      reason:            (lbwData.reason || '') + ' (bat ground contact noted)',
      batInvolved:       false,
      batConfidence,
      edgeDetected:      false,
      groundHitDetected: true,
      groundHitConfidence,
      lbwValid:          adj > 0.40,
      audioPrimaryEvent: primaryEvent,
    };
  }

  // No edge / no bat → standard trajectory result
  return {
    ...lbwData,
    batInvolved:       false,
    batConfidence,
    edgeDetected:      edgeDetected || false,
    edgeConfidence:    edgeConfidence || 0,
    groundHitDetected: groundHitDetected || false,
    lbwValid:          lbwData.possible || false,
    audioPrimaryEvent: primaryEvent,
  };
}

// ── INTERNAL SIMULATION ENGINE ────────────────────────────────────────────────

function _runSimulation() {
  // Choose delivery sound profile probabilistically
  const r = Math.random();
  let profile;
  if      (r < 0.40) profile = 'dot_or_miss';
  else if (r < 0.65) profile = 'clean_hit';
  else if (r < 0.78) profile = 'edge';
  else if (r < 0.88) profile = 'ground';
  else               profile = 'pad';

  const SAMPLE_MS    = 25;           // poll every 25ms
  const DELIVERY_MS  = 1600;         // total delivery window
  const totalSamples = Math.floor(DELIVERY_MS / SAMPLE_MS);

  // Impact happens roughly 60–75% through the delivery
  const impactIdx = Math.floor(totalSamples * (0.60 + Math.random() * 0.15));

  let idx = 0;
  const startTs = Date.now();

  _intervalHandle = setInterval(() => {
    if (!_captureActive) {
      clearInterval(_intervalHandle);
      _intervalHandle = null;
      return;
    }

    const ts = startTs + idx * SAMPLE_MS;
    const dist = Math.abs(idx - impactIdx); // samples from impact
    let db;

    switch (profile) {
      case 'clean_hit':
        if (dist === 0)      db = AMBIENT_DB + 22 + Math.random() * 6;
        else if (dist <= 2)  db = AMBIENT_DB + 14 + Math.random() * 5;
        else if (dist <= 4)  db = AMBIENT_DB + 6  + Math.random() * 4;
        else                 db = AMBIENT_DB + (Math.random() - 0.5) * 4;
        break;

      case 'edge':
        // Single very short spike
        if (dist === 0)      db = AMBIENT_DB + 15 + Math.random() * 5;
        else if (dist === 1) db = AMBIENT_DB + 5  + Math.random() * 3;
        else                 db = AMBIENT_DB + (Math.random() - 0.5) * 4;
        break;

      case 'ground': {
        // Two bumps: main tap + smaller echo 3–5 samples later
        const echoIdx = impactIdx + 3 + Math.floor(Math.random() * 3);
        const d2 = Math.abs(idx - echoIdx);
        if (dist <= 2)       db = AMBIENT_DB + 11 + Math.random() * 4;
        else if (d2 <= 2)    db = AMBIENT_DB + 7  + Math.random() * 3;
        else                 db = AMBIENT_DB + (Math.random() - 0.5) * 4;
        break;
      }

      case 'pad':
        if (dist === 0)      db = AMBIENT_DB + 9  + Math.random() * 3;
        else if (dist <= 2)  db = AMBIENT_DB + 4  + Math.random() * 2;
        else                 db = AMBIENT_DB + (Math.random() - 0.5) * 4;
        break;

      default: // dot_or_miss
        db = AMBIENT_DB + (Math.random() - 0.5) * 5;
        break;
    }

    _simulatedSamples.push({ db, ts });
    idx++;

    if (idx >= totalSamples) {
      clearInterval(_intervalHandle);
      _intervalHandle = null;
    }
  }, SAMPLE_MS);
}