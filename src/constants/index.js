// ─── THEME COLORS ───────────────────────────────────────────────────────────
export const COLORS = {
  // Backgrounds
  bg_deep: '#070c1b',
  bg_dark: '#0d1427',
  bg_card: '#111827',
  bg_elevated: '#1a2235',

  // Primary Accent - Electric Green (Cricket Pitch vibe)
  primary: '#00e676',
  primary_dim: '#00c853',
  primary_glow: 'rgba(0,230,118,0.2)',

  // Secondary Accent - Vibrant Amber (Ball color)
  secondary: '#ffab00',
  secondary_dim: '#ff8f00',
  secondary_glow: 'rgba(255,171,0,0.2)',

  // Danger - Red (Wicket / No Ball)
  danger: '#ff1744',
  danger_dim: '#c62828',
  danger_glow: 'rgba(255,23,68,0.2)',

  // Warning - Orange (Wide / Bounce)
  warning: '#ff6d00',
  warning_dim: '#e65100',
  warning_glow: 'rgba(255,109,0,0.2)',

  // Info - Blue
  info: '#2979ff',
  info_dim: '#1565c0',
  info_glow: 'rgba(41,121,255,0.2)',

  // Text
  text_primary: '#ffffff',
  text_secondary: '#94a3b8',
  text_muted: '#4a5568',
  text_inverse: '#070c1b',

  // Borders
  border: '#1e2d45',
  border_light: '#2d3f5c',

  // Ball events
  dot_ball: '#4a5568',
  single: '#00e676',
  double: '#00bcd4',
  triple: '#9c27b0',
  four: '#2979ff',
  six: '#ffab00',
  wide: '#ff6d00',
  no_ball: '#ff1744',
  wicket: '#ff1744',
  out: '#ff1744',
};

// ─── CRICKET CONSTANTS ───────────────────────────────────────────────────────
export const CRICKET = {
  BALLS_PER_OVER: 6,
  MAX_BOUNCES_PER_OVER: 1,

  // Pitch zones relative to stumps width (normalized 0-1)
  WIDE_THRESHOLD: 0.35, // 35% outside off/leg stump line

  // Ball height thresholds relative to batsman height (normalized 0-1)
  // These are rough guidelines; actual detection uses camera feed
  NO_BALL_HEIGHT_RATIO: 0.85, // Ball above 85% of batsman shoulder height = no ball
  BOUNCE_HEIGHT_RATIO: 0.65,  // Bounce ball above 65% batsman chest = dangerous short pitch

  // Detection confidence thresholds
  MIN_DETECTION_CONFIDENCE: 0.6,
  WIDE_CONFIDENCE: 0.7,
  NO_BALL_CONFIDENCE: 0.65,
  BOUNCE_CONFIDENCE: 0.60,
};

// ─── BALL OUTCOMES ──────────────────────────────────────────────────────────
export const BALL_OUTCOMES = {
  DOT: 'dot',
  ONE: '1',
  TWO: '2',
  THREE: '3',
  FOUR: '4',
  SIX: '6',
  WIDE: 'wide',
  NO_BALL: 'no_ball',
  WICKET: 'wicket',
  BYE: 'bye',
  LEG_BYE: 'leg_bye',
};

export const OUTCOME_COLORS = {
  [BALL_OUTCOMES.DOT]: COLORS.dot_ball,
  [BALL_OUTCOMES.ONE]: COLORS.single,
  [BALL_OUTCOMES.TWO]: COLORS.double,
  [BALL_OUTCOMES.THREE]: COLORS.triple,
  [BALL_OUTCOMES.FOUR]: COLORS.four,
  [BALL_OUTCOMES.SIX]: COLORS.six,
  [BALL_OUTCOMES.WIDE]: COLORS.wide,
  [BALL_OUTCOMES.NO_BALL]: COLORS.no_ball,
  [BALL_OUTCOMES.WICKET]: COLORS.wicket,
  [BALL_OUTCOMES.BYE]: COLORS.info,
  [BALL_OUTCOMES.LEG_BYE]: COLORS.info_dim,
};

export const OUTCOME_RUNS = {
  [BALL_OUTCOMES.DOT]: 0,
  [BALL_OUTCOMES.ONE]: 1,
  [BALL_OUTCOMES.TWO]: 2,
  [BALL_OUTCOMES.THREE]: 3,
  [BALL_OUTCOMES.FOUR]: 4,
  [BALL_OUTCOMES.SIX]: 6,
  [BALL_OUTCOMES.WIDE]: 1,
  [BALL_OUTCOMES.NO_BALL]: 1,
  [BALL_OUTCOMES.WICKET]: 0,
  [BALL_OUTCOMES.BYE]: 1,
  [BALL_OUTCOMES.LEG_BYE]: 1,
};

// Extra balls given for these outcomes
export const EXTRA_BALL_OUTCOMES = [BALL_OUTCOMES.WIDE, BALL_OUTCOMES.NO_BALL];

// ─── WICKET TYPES ────────────────────────────────────────────────────────────
export const WICKET_TYPES = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  RUN_OUT: 'Run Out',
  STUMPED: 'Stumped',
  HIT_WICKET: 'Hit Wicket',
  RETIRED: 'Retired',
};

// ─── DETECTION ALERT TYPES ──────────────────────────────────────────────────
export const ALERT_TYPES = {
  WIDE_DETECTED: 'wide_detected',
  NO_BALL_HEIGHT: 'no_ball_height',
  NO_BALL_BOUNCE: 'no_ball_bounce',
  BOUNCE_WARNING: 'bounce_warning',
};
