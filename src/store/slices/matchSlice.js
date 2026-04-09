import { createSlice } from '@reduxjs/toolkit';
import { BALL_OUTCOMES, OUTCOME_RUNS, EXTRA_BALL_OUTCOMES, CRICKET, REVIEW_OUTCOMES } from '../../constants';

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
  lbwData: null,
  heightData: null,
  detectionFlags: {
    wideDetected: false,
    noBallHeightDetected: false,
    noBallBounceDetected: false,
    lbwPossible: false,
  },
};

/**
 * Create fresh reviews state for an innings.
 * IPL: 2 reviews per team per innings.
 */
function createReviewsState(team1Id, team2Id) {
  return {
    [team1Id]: { remaining: CRICKET.REVIEWS_PER_TEAM, used: 0, history: [] },
    [team2Id]: { remaining: CRICKET.REVIEWS_PER_TEAM, used: 0, history: [] },
  };
}

const initialState = {
  matchId: null,
  matchName: '',
  status: 'setup',

  team1: { id: 'team1', name: 'Team 1', players: [] },
  team2: { id: 'team2', name: 'Team 2', players: [] },

  battingTeamId: null,
  bowlingTeamId: null,
  totalOvers: 6,

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
      batsmanStats: {},
      bowlerStats: {},
      fallOfWickets: [],
      reviews: {},
      isComplete: false,
    },
  ],
  currentInningsIndex: 0,

  lastBall: null,
  replayUri: null,
  replayAvailableUntilNextBall: false,

  pendingReview: null,
  pendingAlerts: [],
  result: null,
};

function isWicketOutcome(outcome) {
  return outcome === BALL_OUTCOMES.WICKET || outcome === BALL_OUTCOMES.LBW;
}

const matchSlice = createSlice({
  name: 'match',
  initialState,
  reducers: {
    // ── SETUP ──────────────────────────────────────────────────────────────
    setupMatch: (state, action) => {
      const { matchId, matchName, team1, team2, totalOvers, tossWinner, battingFirst } = action.payload;
      state.matchId    = matchId;
      state.matchName  = matchName;
      state.team1      = team1;
      state.team2      = team2;
      state.totalOvers = totalOvers;
      state.status     = 'innings1';

      const battingTeamId = battingFirst;
      const bowlingTeamId = battingFirst === team1.id ? team2.id : team1.id;
      state.battingTeamId = battingTeamId;
      state.bowlingTeamId = bowlingTeamId;

      state.innings[0].battingTeamId = battingTeamId;
      state.innings[0].bowlingTeamId = bowlingTeamId;
      state.innings[0].reviews = createReviewsState(team1.id, team2.id);
    },

    setCurrentBatsmen: (state, action) => {
      const { striker, nonStriker } = action.payload;
      const innings = state.innings[state.currentInningsIndex];
      innings.currentBatsmen = { striker, nonStriker };

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
        wicketType     = null,
        replayUri      = null,
        detectionFlags = {},
        batsmanId,
        bowlerId,
        lbwData        = null,
        heightData     = null,
      } = action.payload;

      const innings     = state.innings[state.currentInningsIndex];
      const currentOver = innings.currentOver;
      const isExtra     = EXTRA_BALL_OUTCOMES.includes(outcome);
      const isWicket    = isWicketOutcome(outcome);
      const runs        = OUTCOME_RUNS[outcome] || 0;

      state.replayAvailableUntilNextBall = false;
      state.replayUri    = null;
      state.pendingReview = null;

      const ball = {
        ...initialBall,
        id: `${innings.inningsNumber}-${currentOver.overNumber}-${currentOver.balls.length + 1}`,
        overNumber: currentOver.overNumber,
        ballNumber: currentOver.balls.length + 1,
        outcome,
        runs,
        isExtra,
        extraType:  isExtra ? outcome : null,
        isWicket,
        wicketType: isWicket
          ? (outcome === BALL_OUTCOMES.LBW ? 'LBW' : wicketType)
          : null,
        batsmanId,
        bowlerId,
        timestamp:       new Date().toISOString(),
        replayUri,
        replayAvailable: !!replayUri,
        isBounce:        detectionFlags.isBounce || false,
        lbwData,
        heightData,
        detectionFlags,
      };

      currentOver.balls.push(ball);
      currentOver.totalRuns += runs;
      if (ball.isBounce) currentOver.bounces += 1;
      if (!isExtra)      currentOver.legalBalls += 1;

      innings.totalRuns += runs;

      // ── Second innings win check ──
      if (state.currentInningsIndex === 1) {
        const target = state.innings[0].totalRuns + 1;
        if (innings.totalRuns >= target) {
          innings.isComplete = true;
          state.status = 'complete';
          const team = innings.battingTeamId === state.team1.id ? state.team1 : state.team2;
          const wicketsLeft = (team.players.length - 1) - innings.totalWickets;
          state.result = `${team.name} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`;
          state.lastBall = { ...ball };
          state.replayUri = replayUri;
          state.replayAvailableUntilNextBall = !!replayUri;
          return;
        }
      }

      // ── Extras ──
      if (outcome === BALL_OUTCOMES.WIDE)    innings.extras.wides   += 1;
      if (outcome === BALL_OUTCOMES.NO_BALL) innings.extras.noBalls += 1;
      if (outcome === BALL_OUTCOMES.BYE)     innings.extras.byes    += 1;
      if (outcome === BALL_OUTCOMES.LEG_BYE) innings.extras.legByes += 1;

      // ── Batsman stats ──
      const strikerStats = innings.batsmanStats[batsmanId];
      if (strikerStats && !isExtra) {
        strikerStats.balls += 1;
        if (!isWicket) {
          strikerStats.runs += runs;
          if (outcome === BALL_OUTCOMES.FOUR) strikerStats.fours += 1;
          if (outcome === BALL_OUTCOMES.SIX)  strikerStats.sixes += 1;
          if (runs === 0) strikerStats.dotBalls += 1;
        } else {
          strikerStats.isOut      = true;
          strikerStats.wicketType = outcome === BALL_OUTCOMES.LBW ? 'LBW' : wicketType;
          innings.totalWickets   += 1;
          innings.fallOfWickets.push({
            wicketNumber: innings.totalWickets,
            runs:         innings.totalRuns,
            over:         `${currentOver.overNumber}.${currentOver.legalBalls}`,
            batsmanId,
          });
        }
      }

      // ── Bowler stats ──
      const bowlerStat = innings.bowlerStats[bowlerId];
      if (bowlerStat) {
        bowlerStat.runs += runs;
        if (outcome === BALL_OUTCOMES.WIDE)         bowlerStat.wides   += 1;
        else if (outcome === BALL_OUTCOMES.NO_BALL) bowlerStat.noBalls += 1;
        else                                        bowlerStat.balls   += 1;
        if (isWicket) bowlerStat.wickets += 1;
      }

      // ── Strike rotation ──
      if (!isExtra && !isWicket && (runs === 1 || runs === 3)) {
        const temp = innings.currentBatsmen.striker;
        innings.currentBatsmen.striker    = innings.currentBatsmen.nonStriker;
        innings.currentBatsmen.nonStriker = temp;
      }

      state.lastBall = ball;
      state.replayUri = replayUri;
      state.replayAvailableUntilNextBall = !!replayUri;

      // ── Over complete ──
      if (currentOver.legalBalls >= 6) {
        currentOver.isComplete = true;

        if (bowlerStat) {
          bowlerStat.overs += 1;
          bowlerStat.balls  = 0;
          if (currentOver.totalRuns === 0) bowlerStat.maidens += 1;
        }

        const temp = innings.currentBatsmen.striker;
        innings.currentBatsmen.striker    = innings.currentBatsmen.nonStriker;
        innings.currentBatsmen.nonStriker = temp;

        innings.overs.push({ ...currentOver });

        const oversComplete = innings.overs.length >= state.totalOvers;
        const battingTeam   = innings.battingTeamId === state.team1.id ? state.team1 : state.team2;
        const allOut        = innings.totalWickets >= (battingTeam.players.length - 1);

        if (oversComplete || allOut) {
          innings.isComplete = true;

          if (state.currentInningsIndex === 0) {
            // Start innings 2
            state.currentInningsIndex = 1;
            state.status = 'innings2';

            const innings2Reviews = createReviewsState(state.team1.id, state.team2.id);

            state.innings.push({
              inningsNumber: 2,
              battingTeamId: innings.bowlingTeamId,
              bowlingTeamId: innings.battingTeamId,
              totalRuns: 0, totalWickets: 0,
              extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
              overs: [],
              currentOver: { overNumber: 1, balls: [], legalBalls: 0, totalRuns: 0, bounces: 0, isComplete: false },
              currentBatsmen: { striker: null, nonStriker: null },
              currentBowler: null,
              batsmanStats: {}, bowlerStats: {},
              fallOfWickets: [],
              reviews: innings2Reviews,
              isComplete: false,
            });
          } else {
            // Match complete
            state.status = 'complete';
            const inn1 = state.innings[0];
            const inn2 = state.innings[1];
            if (inn2.totalRuns > inn1.totalRuns) {
              const team = inn2.battingTeamId === state.team1.id ? state.team1 : state.team2;
              const wl   = (team.players.length - 1) - inn2.totalWickets;
              state.result = `${team.name} won by ${wl} wicket${wl !== 1 ? 's' : ''}`;
            } else if (inn1.totalRuns > inn2.totalRuns) {
              const team = inn1.battingTeamId === state.team1.id ? state.team1 : state.team2;
              state.result = `${team.name} won by ${inn1.totalRuns - inn2.totalRuns} runs`;
            } else {
              state.result = 'Match Tied!';
            }
          }
        } else {
          innings.currentOver = { overNumber: currentOver.overNumber + 1, balls: [], legalBalls: 0, totalRuns: 0, bounces: 0, isComplete: false };
          innings.currentBowler = null;
        }
      }
    },

    // ── REVIEWS ────────────────────────────────────────────────────────────

    initiateReview: (state, action) => {
      const { reviewingTeamId, reviewingTeamName, reviewType, lastBall } = action.payload;
      const innings     = state.innings[state.currentInningsIndex];
      const teamReviews = innings.reviews[reviewingTeamId];

      if (!teamReviews || teamReviews.remaining <= 0) return;

      state.pendingReview = {
        teamId:          reviewingTeamId,
        teamName:        reviewingTeamName,
        reviewType,
        ballId:          lastBall?.id,
        lbwData:         lastBall?.lbwData || null,
        heightData:      lastBall?.heightData || null,
        originalOutcome: lastBall?.outcome,
      };
    },

    /**
     * Resolve a pending review.
     *
     * IPL rules:
     *  - Review LOST on OVERTURNED (success) — not given back
     *  - Review LOST on FAILED
     *  - Review RETAINED on Umpire's Call (LBW only)
     *  - If umpireOverride = true, the umpire ignores DRS and sticks with original (review still used)
     */
    resolveReview: (state, action) => {
      const { outcome, reviewingTeamId, umpireOverride = false } = action.payload;
      const innings = state.innings[state.currentInningsIndex];
      const review  = state.pendingReview;
      if (!review) return;

      const teamReviews = innings.reviews[reviewingTeamId];
      if (!teamReviews) return;

      teamReviews.history.push({
        outcome,
        umpireOverride,
        reviewType: review.reviewType,
        ballId:     review.ballId,
        timestamp:  new Date().toISOString(),
      });

      // IPL: review retained ONLY on Umpire's Call for LBW
      const isUmpireCallLBW =
        outcome === REVIEW_OUTCOMES.UMPIRES_CALL && review.reviewType === 'lbw';

      if (!isUmpireCallLBW) {
        teamReviews.remaining = Math.max(0, teamReviews.remaining - 1);
        teamReviews.used     += 1;
      }

      // Apply result to match state (unless umpire overrode DRS)
      if (!umpireOverride && outcome === REVIEW_OUTCOMES.OVERTURNED) {
        if (review.reviewType === 'wicket' || review.reviewType === 'lbw') {
          if (innings.totalWickets > 0) {
            innings.totalWickets -= 1;
            innings.fallOfWickets.pop();
            const reviewedBall = innings.currentOver.balls.find((b) => b.id === review.ballId);
            if (reviewedBall?.batsmanId && innings.batsmanStats[reviewedBall.batsmanId]) {
              innings.batsmanStats[reviewedBall.batsmanId].isOut      = false;
              innings.batsmanStats[reviewedBall.batsmanId].wicketType = null;
            }
          }
        } else if (review.reviewType === 'wide') {
          if (innings.totalRuns > 0)    innings.totalRuns    -= 1;
          if (innings.extras.wides > 0) innings.extras.wides -= 1;
        }
      }

      state.pendingReview = null;
    },

    cancelReview: (state) => { state.pendingReview = null; },

    // ── ALERTS ────────────────────────────────────────────────────────────
    addAlert:     (state, action) => { state.pendingAlerts.push(action.payload); },
    clearAlerts:  (state)         => { state.pendingAlerts = []; },
    dismissAlert: (state, action) => {
      state.pendingAlerts = state.pendingAlerts.filter((a) => a.id !== action.payload);
    },

    // ── REPLAY ────────────────────────────────────────────────────────────
    markReplayViewed: (state) => {
      state.replayAvailableUntilNextBall = false;
      state.replayUri = null;
      if (state.lastBall) state.lastBall.replayViewed = true;
    },

    resetMatch: () => initialState,
  },
});

export const {
  setupMatch,
  setCurrentBatsmen,
  setCurrentBowler,
  recordBall,
  initiateReview,
  resolveReview,
  cancelReview,
  addAlert,
  clearAlerts,
  dismissAlert,
  markReplayViewed,
  resetMatch,
} = matchSlice.actions;

// ── SELECTORS ────────────────────────────────────────────────────────────────
export const selectCurrentInnings   = (state) => state.match.innings[state.match.currentInningsIndex];
export const selectCurrentOver      = (state) => selectCurrentInnings(state)?.currentOver;
export const selectTotalRuns        = (state) => selectCurrentInnings(state)?.totalRuns     || 0;
export const selectTotalWickets     = (state) => selectCurrentInnings(state)?.totalWickets  || 0;
export const selectOversCompleted   = (state) => selectCurrentInnings(state)?.overs.length  || 0;
export const selectLegalBallsInOver = (state) => selectCurrentOver(state)?.legalBalls       || 0;
export const selectBouncesInOver    = (state) => selectCurrentOver(state)?.bounces           || 0;
export const selectLastBall         = (state) => state.match.lastBall;
export const selectReplayAvailable  = (state) => state.match.replayAvailableUntilNextBall;
export const selectReplayUri        = (state) => state.match.replayUri;
export const selectMatch            = (state) => state.match;
export const selectAlerts           = (state) => state.match.pendingAlerts;
export const selectBatsmanStats     = (state) => selectCurrentInnings(state)?.batsmanStats  || {};
export const selectBowlerStats      = (state) => selectCurrentInnings(state)?.bowlerStats   || {};
export const selectReviews          = (state) => selectCurrentInnings(state)?.reviews        || {};
export const selectPendingReview    = (state) => state.match.pendingReview;

export default matchSlice.reducer;
