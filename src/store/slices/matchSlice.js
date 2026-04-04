import { createSlice } from '@reduxjs/toolkit';
import { BALL_OUTCOMES, OUTCOME_RUNS, EXTRA_BALL_OUTCOMES } from '../../constants';

const initialBall = {
  id: null,
  overNumber: 0,
  ballNumber: 0,
  outcome: null,
  runs: 0,
  isExtra: false,
  extraType: null,
  isWicket: false,
  wicketType: null,
  batsmanId: null,
  bowlerId: null,
  timestamp: null,
  replayUri: null,
  replayAvailable: false,
  replayViewed: false,
  isBounce: false,
  detectionFlags: {
    wideDetected: false,
    noBallHeightDetected: false,
    noBallBounceDetected: false,
  },
};

const initialState = {
  matchId: null,
  matchName: '',
  status: 'setup', // 'setup' | 'toss' | 'innings1' | 'innings2' | 'complete'

  // Teams
  team1: { id: 'team1', name: 'Team 1', players: [] },
  team2: { id: 'team2', name: 'Team 2', players: [] },

  // Innings
  battingTeamId: null,
  bowlingTeamId: null,
  totalOvers: 6,

  // Current innings stats
  innings: [
    {
      inningsNumber: 1,
      battingTeamId: null,
      bowlingTeamId: null,
      totalRuns: 0,
      totalWickets: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      overs: [],
      currentOver: {
        overNumber: 1,
        balls: [],
        legalBalls: 0,
        totalRuns: 0,
        bounces: 0,
        isComplete: false,
      },
      currentBatsmen: { striker: null, nonStriker: null },
      currentBowler: null,
      batsmanStats: {}, // { playerId: { runs, balls, fours, sixes, isOut } }
      bowlerStats: {},  // { playerId: { overs, balls, runs, wickets, wides, noBalls } }
      fallOfWickets: [],
      isComplete: false,
    },
  ],
  currentInningsIndex: 0,

  // Match settings
  batsmen: { striker: null, nonStriker: null },
  currentBowler: null,

  // Last ball info for replay (only one at a time)
  lastBall: null,
  replayUri: null,
  replayAvailableUntilNextBall: false,

  // Alerts
  pendingAlerts: [],

  // Match result
  result: null,
};

const matchSlice = createSlice({
  name: 'match',
  initialState,
  reducers: {
    // ── SETUP ──────────────────────────────────────────────────────────────
    setupMatch: (state, action) => {
      const { matchId, matchName, team1, team2, totalOvers, tossWinner, battingFirst } = action.payload;
      state.matchId = matchId;
      state.matchName = matchName;
      state.team1 = team1;
      state.team2 = team2;
      state.totalOvers = totalOvers;
      state.status = 'innings1';

      const battingTeamId = battingFirst;
      const bowlingTeamId = battingFirst === team1.id ? team2.id : team1.id;

      state.battingTeamId = battingTeamId;
      state.bowlingTeamId = bowlingTeamId;

      state.innings[0].battingTeamId = battingTeamId;
      state.innings[0].bowlingTeamId = bowlingTeamId;
    },

    setCurrentBatsmen: (state, action) => {
      const { striker, nonStriker } = action.payload;
      const innings = state.innings[state.currentInningsIndex];
      innings.currentBatsmen = { striker, nonStriker };

      // Initialize stats if not present
      if (striker && !innings.batsmanStats[striker.id]) {
        innings.batsmanStats[striker.id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dotBalls: 0 };
      }
      if (nonStriker && !innings.batsmanStats[nonStriker.id]) {
        innings.batsmanStats[nonStriker.id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dotBalls: 0 };
      }
    },

    setCurrentBowler: (state, action) => {
      const bowler = action.payload;
      const innings = state.innings[state.currentInningsIndex];
      innings.currentBowler = bowler;

      if (bowler && !innings.bowlerStats[bowler.id]) {
        innings.bowlerStats[bowler.id] = { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, maidens: 0 };
      }
    },

    // ── RECORD BALL ────────────────────────────────────────────────────────
    recordBall: (state, action) => {
      const {
        outcome,
        wicketType = null,
        replayUri = null,
        detectionFlags = {},
        batsmanId,
        bowlerId,
      } = action.payload;

      const innings = state.innings[state.currentInningsIndex];
      const currentOver = innings.currentOver;
      const isExtra = EXTRA_BALL_OUTCOMES.includes(outcome);
      const isWicket = outcome === BALL_OUTCOMES.WICKET;
      const runs = OUTCOME_RUNS[outcome] || 0;

      // Mark previous replay as no longer available
      state.replayAvailableUntilNextBall = false;
      state.replayUri = null;

      const ball = {
        ...initialBall,
        id: `${innings.inningsNumber}-${currentOver.overNumber}-${currentOver.balls.length + 1}`,
        overNumber: currentOver.overNumber,
        ballNumber: currentOver.balls.length + 1,
        outcome,
        runs,
        isExtra,
        extraType: isExtra ? outcome : null,
        isWicket,
        wicketType,
        batsmanId,
        bowlerId,
        timestamp: new Date().toISOString(),
        replayUri,
        replayAvailable: !!replayUri,
        replayViewed: false,
        isBounce: detectionFlags.isBounce || false,
        detectionFlags,
      };

      // Push ball to current over
      currentOver.balls.push(ball);
      currentOver.totalRuns += runs;

      // Track bounces in over
      if (ball.isBounce) {
        currentOver.bounces += 1;
      }

      // Count legal balls
      if (!isExtra) {
        currentOver.legalBalls += 1;
      }

      // Update innings totals
      innings.totalRuns += runs;

      // Second innings: check if target is reached
      if (state.currentInningsIndex === 1) {
        const target = state.innings[0].totalRuns + 1;
        if (innings.totalRuns >= target) {
          innings.isComplete = true;
          state.status = 'complete';
          const team = innings.battingTeamId === state.team1.id ? state.team1 : state.team2;
          const battingTeamRef = innings.battingTeamId === state.team1.id ? state.team1 : state.team2;
          const wicketsLeft = (battingTeamRef.players.length - 1) - innings.totalWickets;
          state.result = `${team.name} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`;
          state.lastBall = { ...ball };
          state.replayUri = replayUri;
          state.replayAvailableUntilNextBall = !!replayUri;
          return;
        }
      }
      if (outcome === BALL_OUTCOMES.WIDE) innings.extras.wides += 1;
      if (outcome === BALL_OUTCOMES.NO_BALL) innings.extras.noBalls += 1;
      if (outcome === BALL_OUTCOMES.BYE) innings.extras.byes += 1;
      if (outcome === BALL_OUTCOMES.LEG_BYE) innings.extras.legByes += 1;

      // Update batsman stats
      const strikerStats = innings.batsmanStats[batsmanId];
      if (strikerStats && !isExtra) {
        strikerStats.balls += 1;
        if (outcome !== BALL_OUTCOMES.WICKET) {
          strikerStats.runs += runs;
          if (outcome === BALL_OUTCOMES.FOUR) strikerStats.fours += 1;
          if (outcome === BALL_OUTCOMES.SIX) strikerStats.sixes += 1;
          if (runs === 0) strikerStats.dotBalls += 1;
        } else {
          strikerStats.isOut = true;
          strikerStats.wicketType = wicketType;
          innings.totalWickets += 1;
          innings.fallOfWickets.push({
            wicketNumber: innings.totalWickets,
            runs: innings.totalRuns,
            over: `${currentOver.overNumber}.${currentOver.legalBalls}`,
            batsmanId,
          });
        }
      }

      // Update bowler stats
      const bowlerStat = innings.bowlerStats[bowlerId];
      if (bowlerStat) {
        bowlerStat.runs += runs;
        if (outcome === BALL_OUTCOMES.WIDE) bowlerStat.wides += 1;
        else if (outcome === BALL_OUTCOMES.NO_BALL) bowlerStat.noBalls += 1;
        else bowlerStat.balls += 1;
        if (isWicket) bowlerStat.wickets += 1;
      }

      // Swap strike on odd runs (1,3) for non-extras
      if (!isExtra && !isWicket && (runs === 1 || runs === 3)) {
        const temp = innings.currentBatsmen.striker;
        innings.currentBatsmen.striker = innings.currentBatsmen.nonStriker;
        innings.currentBatsmen.nonStriker = temp;
      }

      // Last ball for replay
      state.lastBall = ball;
      state.replayUri = replayUri;
      state.replayAvailableUntilNextBall = !!replayUri;

      // Check if over is complete (6 legal balls)
      if (currentOver.legalBalls >= 6) {
        currentOver.isComplete = true;

        // Update bowler overs
        if (bowlerStat) {
          bowlerStat.overs += 1;
          bowlerStat.balls = 0;
          // Check for maiden
          if (currentOver.totalRuns === 0) bowlerStat.maidens += 1;
        }

        // Swap strike at end of over
        const temp = innings.currentBatsmen.striker;
        innings.currentBatsmen.striker = innings.currentBatsmen.nonStriker;
        innings.currentBatsmen.nonStriker = temp;

        // Archive current over
        innings.overs.push({ ...currentOver });

        // Check if innings complete
        const oversComplete = innings.overs.length >= state.totalOvers;
        const battingTeam = innings.battingTeamId === state.team1.id ? state.team1 : state.team2;
        const allOut = innings.totalWickets >= (battingTeam.players.length - 1);

        if (oversComplete || allOut) {
          innings.isComplete = true;
          if (state.currentInningsIndex === 0) {
            // Start second innings
            state.currentInningsIndex = 1;
            state.status = 'innings2';
            const newBatTeam = innings.bowlingTeamId;
            const newBowlTeam = innings.battingTeamId;
            state.innings.push({
              inningsNumber: 2,
              battingTeamId: newBatTeam,
              bowlingTeamId: newBowlTeam,
              totalRuns: 0,
              totalWickets: 0,
              extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
              overs: [],
              currentOver: {
                overNumber: 1,
                balls: [],
                legalBalls: 0,
                totalRuns: 0,
                bounces: 0,
                isComplete: false,
              },
              currentBatsmen: { striker: null, nonStriker: null },
              currentBowler: null,
              batsmanStats: {},
              bowlerStats: {},
              fallOfWickets: [],
              isComplete: false,
            });
          } else {
            // Match complete
            state.status = 'complete';
            const inn1 = state.innings[0];
            const inn2 = state.innings[1];
            if (inn2.totalRuns > inn1.totalRuns) {
              const team = inn2.battingTeamId === state.team1.id ? state.team1 : state.team2;
              const battingTeam2 = inn2.battingTeamId === state.team1.id ? state.team1 : state.team2;
              const wicketsLeft = (battingTeam2.players.length - 1) - inn2.totalWickets;
              state.result = `${team.name} won by ${wicketsLeft} wickets`;
            } else if (inn1.totalRuns > inn2.totalRuns) {
              const team = inn1.battingTeamId === state.team1.id ? state.team1 : state.team2;
              const diff = inn1.totalRuns - inn2.totalRuns;
              state.result = `${team.name} won by ${diff} runs`;
            } else {
              state.result = 'Match Tied!';
            }
          }
        } else {
          // Start new over
          innings.currentOver = {
            overNumber: currentOver.overNumber + 1,
            balls: [],
            legalBalls: 0,
            totalRuns: 0,
            bounces: 0,
            isComplete: false,
          };
          innings.currentBowler = null; // New bowler needed
        }
      }
    },

    // ── ALERTS ────────────────────────────────────────────────────────────
    addAlert: (state, action) => {
      state.pendingAlerts.push(action.payload);
    },
    clearAlerts: (state) => {
      state.pendingAlerts = [];
    },
    dismissAlert: (state, action) => {
      state.pendingAlerts = state.pendingAlerts.filter((a) => a.id !== action.payload);
    },

    // ── REPLAY ────────────────────────────────────────────────────────────
    markReplayViewed: (state) => {
      state.replayAvailableUntilNextBall = false;
      state.replayUri = null;
      if (state.lastBall) {
        state.lastBall.replayViewed = true;
      }
    },

    // ── RESET ────────────────────────────────────────────────────────────
    resetMatch: () => initialState,
  },
});

export const {
  setupMatch,
  setCurrentBatsmen,
  setCurrentBowler,
  recordBall,
  addAlert,
  clearAlerts,
  dismissAlert,
  markReplayViewed,
  resetMatch,
} = matchSlice.actions;

// ── SELECTORS ────────────────────────────────────────────────────────────────
export const selectCurrentInnings = (state) => state.match.innings[state.match.currentInningsIndex];
export const selectCurrentOver = (state) => selectCurrentInnings(state)?.currentOver;
export const selectTotalRuns = (state) => selectCurrentInnings(state)?.totalRuns || 0;
export const selectTotalWickets = (state) => selectCurrentInnings(state)?.totalWickets || 0;
export const selectOversCompleted = (state) => selectCurrentInnings(state)?.overs.length || 0;
export const selectLegalBallsInOver = (state) => selectCurrentOver(state)?.legalBalls || 0;
export const selectBouncesInOver = (state) => selectCurrentOver(state)?.bounces || 0;
export const selectLastBall = (state) => state.match.lastBall;
export const selectReplayAvailable = (state) => state.match.replayAvailableUntilNextBall;
export const selectReplayUri = (state) => state.match.replayUri;
export const selectMatch = (state) => state.match;
export const selectAlerts = (state) => state.match.pendingAlerts;
export const selectBatsmanStats = (state) => selectCurrentInnings(state)?.batsmanStats || {};
export const selectBowlerStats = (state) => selectCurrentInnings(state)?.bowlerStats || {};

export default matchSlice.reducer;
