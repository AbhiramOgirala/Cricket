import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isPlaying: false,
  currentReplayUri: null,
  replayBallInfo: null,
};

const replaySlice = createSlice({
  name: 'replay',
  initialState,
  reducers: {
    setReplay: (state, action) => {
      state.currentReplayUri = action.payload.uri;
      state.replayBallInfo = action.payload.ballInfo;
      state.isPlaying = false;
    },
    clearReplay: (state) => {
      state.isPlaying = false;
      state.currentReplayUri = null;
      state.replayBallInfo = null;
    },
    setIsPlaying: (state, action) => {
      state.isPlaying = action.payload;
    },
  },
});

export const { setReplay, clearReplay, setIsPlaying } = replaySlice.actions;
export const selectReplay = (state) => state.replay;
export default replaySlice.reducer;
