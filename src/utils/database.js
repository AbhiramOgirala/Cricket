import { supabase } from './supabase';

// ── MATCHES ──────────────────────────────────────────────────────────────────
export async function createMatch(matchData) {
  const { data, error } = await supabase
    .from('matches')
    .insert([matchData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMatch(matchId, updates) {
  const { data, error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMatchById(matchId) {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      innings(
        *,
        balls(*)
      )
    `)
    .eq('id', matchId)
    .single();
  if (error) throw error;
  return data;
}

// ── INNINGS ──────────────────────────────────────────────────────────────────
export async function createInnings(inningsData) {
  const { data, error } = await supabase
    .from('innings')
    .insert([inningsData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInnings(inningsId, updates) {
  const { data, error } = await supabase
    .from('innings')
    .update(updates)
    .eq('id', inningsId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── BALLS ─────────────────────────────────────────────────────────────────────
export async function saveBall(ballData) {
  const { data, error } = await supabase
    .from('balls')
    .insert([ballData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getBallsForInnings(inningsId) {
  const { data, error } = await supabase
    .from('balls')
    .select('*')
    .eq('innings_id', inningsId)
    .order('over_number', { ascending: true })
    .order('ball_number', { ascending: true });
  if (error) throw error;
  return data;
}

// ── PLAYERS ──────────────────────────────────────────────────────────────────
export async function getPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function createPlayer(playerData) {
  const { data, error } = await supabase
    .from('players')
    .insert([playerData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertPlayers(players) {
  const { data, error } = await supabase
    .from('players')
    .upsert(players)
    .select();
  if (error) throw error;
  return data;
}

// ── TEAMS ─────────────────────────────────────────────────────────────────────
export async function createTeam(teamData) {
  const { data, error } = await supabase
    .from('teams')
    .insert([teamData])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select(`*, team_players(player_id, players(*))`)
    .order('name');
  if (error) throw error;
  return data;
}
