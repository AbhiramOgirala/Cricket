import { supabase } from './supabase';

// ── MATCHES ──────────────────────────────────────────────────────────────────
export async function createMatch(matchData) {
  const { data, error } = await supabase
    .from('matches').insert([matchData]).select().single();
  if (error) throw error;
  return data;
}

export async function updateMatch(matchId, updates) {
  const { data, error } = await supabase
    .from('matches').update(updates).eq('id', matchId).select().single();
  if (error) throw error;
  return data;
}

export async function getMatches() {
  const { data, error } = await supabase
    .from('matches').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMatchById(matchId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*, innings(*, balls(*))')
    .eq('id', matchId).single();
  if (error) throw error;
  return data;
}

// ── INNINGS ──────────────────────────────────────────────────────────────────
export async function createInnings(inningsData) {
  const { data, error } = await supabase
    .from('innings').insert([inningsData]).select().single();
  if (error) throw error;
  return data;
}

export async function updateInnings(inningsId, updates) {
  const { data, error } = await supabase
    .from('innings').update(updates).eq('id', inningsId).select().single();
  if (error) throw error;
  return data;
}

// ── BALLS ─────────────────────────────────────────────────────────────────────
export async function saveBall(ballData) {
  // Map from Redux ball structure to DB columns
  const dbBall = {
    innings_id: ballData.inningsId,
    match_id: ballData.matchId,
    over_number: ballData.overNumber,
    ball_number: ballData.ballNumber,
    outcome: ballData.outcome,
    runs: ballData.runs,
    is_extra: ballData.isExtra,
    extra_type: ballData.extraType,
    is_wicket: ballData.isWicket,
    wicket_type: ballData.wicketType,
    batsman_id: ballData.batsmanId,
    bowler_id: ballData.bowlerId,
    is_bounce: ballData.isBounce,
    wide_detected: ballData.detectionFlags?.wideDetected || false,
    wide_confidence: ballData.detectionFlags?.wideConfidence || 0,
    no_ball_height_detected: ballData.detectionFlags?.noBallHeightDetected || false,
    no_ball_height_conf: ballData.detectionFlags?.noBallHeightConfidence || 0,
    no_ball_bounce_detected: ballData.detectionFlags?.noBallBounceDetected || false,
    no_ball_bounce_conf: ballData.detectionFlags?.noBallBounceConfidence || 0,
    // LBW fields
    lbw_possible: ballData.lbwData?.possible || false,
    lbw_confidence: ballData.lbwData?.confidence || 0,
    lbw_pitch_in_line: ballData.lbwData?.pitchInLine || false,
    lbw_impact_in_line: ballData.lbwData?.impactInLine || false,
    lbw_would_hit_stumps: ballData.lbwData?.wouldHitStumps || false,
    lbw_pitched_outside_off: ballData.lbwData?.pitchedOnOffSide || false,
    lbw_is_umpires_call: ballData.lbwData?.isUmpireCall || false,
    replay_uri: ballData.replayUri,
  };

  const { data, error } = await supabase.from('balls').insert([dbBall]).select().single();
  if (error) throw error;
  return data;
}

export async function getBallsForInnings(inningsId) {
  const { data, error } = await supabase
    .from('balls').select('*').eq('innings_id', inningsId)
    .order('over_number', { ascending: true })
    .order('ball_number', { ascending: true });
  if (error) throw error;
  return data;
}

// ── REVIEWS ───────────────────────────────────────────────────────────────────
export async function saveReview(reviewData) {
  const dbReview = {
    innings_id: reviewData.inningsId,
    match_id: reviewData.matchId,
    reviewing_team_id: reviewData.reviewingTeamId,
    review_type: reviewData.reviewType,
    ball_id: reviewData.ballId,
    original_outcome: reviewData.originalOutcome,
    review_outcome: reviewData.outcome,
    review_retained: reviewData.reviewRetained || false,
  };

  const { data, error } = await supabase.from('reviews').insert([dbReview]).select().single();
  if (error) throw error;
  return data;
}

export async function getReviewsForMatch(matchId) {
  const { data, error } = await supabase
    .from('reviews').select('*').eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// ── PLAYERS ──────────────────────────────────────────────────────────────────
export async function getPlayers() {
  const { data, error } = await supabase.from('players').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createPlayer(playerData) {
  const { data, error } = await supabase.from('players').insert([playerData]).select().single();
  if (error) throw error;
  return data;
}

export async function upsertPlayers(players) {
  const { data, error } = await supabase.from('players').upsert(players).select();
  if (error) throw error;
  return data;
}

// ── TEAMS ─────────────────────────────────────────────────────────────────────
export async function createTeam(teamData) {
  const { data, error } = await supabase.from('teams').insert([teamData]).select().single();
  if (error) throw error;
  return data;
}

export async function getTeams() {
  const { data, error } = await supabase
    .from('teams').select('*, team_players(player_id, players(*))').order('name');
  if (error) throw error;
  return data;
}
