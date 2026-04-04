import { configureStore } from '@reduxjs/toolkit';
import matchReducer from './slices/matchSlice';
import detectionReducer from './slices/detectionSlice';
import replayReducer from './slices/replaySlice';

export const store = configureStore({
  reducer: {
    match: matchReducer,
    detection: detectionReducer,
    replay: replayReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
