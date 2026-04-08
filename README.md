# Gully Cricket

A React Native mobile app for scoring gully cricket matches with AI-powered ball detection, bounce tracking, LBW analysis, and DRS review system.

## Features

- 🏏 Real-time cricket scoring with auto-detection
- 📹 Camera-based ball tracking with trajectory analysis
- 🎯 Automatic wide and no-ball detection
- 🏀 Bounce detection with height analysis (chest/head level)
- ⚖️ LBW (Leg Before Wicket) detection with ball tracking
- 🔍 DRS Review system (IPL rules - 2 reviews per team)
- 📊 Detailed scorecards and statistics
- 🎬 Video replay functionality
- 📱 Works with Expo Go (SDK 55)
- 🧭 Device motion sensors for adaptive zone calibration

## Ball Detection Features

### Auto-Detection System
The app uses an adaptive zone detection system that automatically calibrates based on:
- Device orientation (tilt/angle) via accelerometer
- Frame dimensions and aspect ratio
- No manual calibration required

### Detection Capabilities

1. **Wide Detection**
   - Tracks ball position relative to stump lines
   - Detects off-side and leg-side wides
   - Confidence scoring based on distance from stumps

2. **No-Ball Detection**
   - Height-based: Ball above batsman shoulder height
   - Bounce-based: More than 1 short-pitch delivery per over
   - Real-time alerts with vibration feedback

3. **Bounce Detection**
   - Identifies ball pitch point in trajectory
   - Classifies bounce height: low, chest, head
   - Tracks bounce count per over (max 1 allowed)

4. **LBW Analysis**
   - Pitch line detection (must not pitch outside leg)
   - Impact point analysis (in line with stumps)
   - Ball tracking projection to stumps
   - Umpire's call detection (40-60% confidence range)

5. **DRS Review System**
   - 2 reviews per team per innings (IPL rules)
   - Animated review process with ball tracking visualization
   - Review retained on Umpire's Call for LBW
   - Review lost on successful/failed challenges

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo Go app on your phone

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd GullyCricketFixed
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Supabase credentials
# EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. Start the development server:
```bash
npm start
```

5. Scan the QR code with Expo Go app on your phone

## Environment Variables

This project uses environment variables for configuration. **Never commit your `.env` file to Git!**

- `.env` - Your local environment variables (ignored by Git)
- `.env.example` - Template file showing required variables (committed to Git)

Required variables:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Project Structure

```
GullyCricketFixed/
├── app/                    # Expo Router screens
│   ├── index.jsx          # Home screen
│   ├── setup.jsx          # Match setup
│   ├── toss.jsx           # Toss screen
│   ├── calibrate.jsx      # Camera calibration (legacy)
│   ├── scoring.jsx        # Main scoring screen with ball tracking
│   ├── scorecard.jsx      # Scorecard view
│   ├── result.jsx         # Match result
│   ├── replay.jsx         # Replay viewer
│   └── history.jsx        # Match history
├── src/
│   ├── components/        # Reusable components
│   │   └── game/         # Game-specific components
│   │       ├── AlertBanner.jsx      # Detection alerts
│   │       ├── BallHistory.jsx      # Ball-by-ball display
│   │       ├── ReviewBar.jsx        # DRS review interface
│   │       ├── ReviewModal.jsx      # DRS review animation
│   │       ├── PlayerSelectModal.jsx
│   │       └── ScoreDisplay.jsx
│   ├── constants/         # App constants and cricket rules
│   │   └── index.js      # CRICKET constants, colors, outcomes
│   ├── store/            # Redux store and slices
│   │   ├── index.js      # Store configuration
│   │   └── slices/
│   │       ├── matchSlice.js       # Match state, scoring, reviews
│   │       ├── detectionSlice.js   # Ball detection state
│   │       └── replaySlice.js      # Replay management
│   └── utils/            # Utility functions
│       ├── autoDetection.js  # Auto ball detection engine
│       ├── ballDetection.js  # Legacy detection (manual calibration)
│       ├── database.js       # Local storage
│       └── supabase.js       # Supabase client
├── assets/               # Images and static files
├── .env                  # Environment variables (NOT in Git)
├── .env.example          # Environment template (in Git)
└── .gitignore           # Git ignore rules
```

## How Ball Detection Works

### 1. Adaptive Zone Computation
```javascript
// Automatically calculates detection zones based on device orientation
const zones = computeAdaptiveZones(frameWidth, frameHeight, deviceTilt);
// Returns: pitchCenterX, leftStumpX, rightStumpX, shoulderY, chestY, etc.
```

### 2. Real-Time Trajectory Tracking
- Ball position tracked at ~20fps during recording
- Trajectory points stored with timestamp: `{x, y, t}`
- Minimum 5 points required for analysis

### 3. Analysis Pipeline
```javascript
const result = analyzeBallDeliveryAuto(trajectory, detectionState, deviceTilt, width, height);
// Returns: wide, noBall, bounce, lbw detection results with confidence scores
```

### 4. Decision Alerts
- Visual alerts for detected events
- Vibration feedback for critical calls
- Confidence scores displayed (60-95%)

## Cricket Rules Implemented

### IPL Rules
- 6 balls per over
- Maximum 1 short-pitch delivery (bounce) per over
- 2 DRS reviews per team per innings
- Review retained on Umpire's Call (LBW only)
- Wide threshold: 35% of stump width outside stump line

### LBW Rules
1. Ball must pitch in line or outside off (not outside leg)
2. Impact must be in line with stumps
3. Ball tracking must show hitting stumps
4. Umpire's Call: 40-60% confidence range

## Technologies

- React Native 0.83.4
- Expo SDK 55
- Expo Router (file-based routing)
- Redux Toolkit (state management)
- Expo Camera (video recording & ball tracking)
- Expo Sensors (accelerometer for device orientation)
- Supabase (backend & match history)
- React Native Reanimated (DRS animations)

## Scripts

- `npm start` - Start Expo development server
- `npm run android` - Start on Android device/emulator
- `npm run ios` - Start on iOS device/simulator
- `npm run web` - Start web version

## Troubleshooting

### Camera Not Working
- Ensure camera and microphone permissions are granted
- Check that you're running on a physical device (camera doesn't work in simulator)
- Restart the Expo Go app if camera feed is frozen

### Ball Detection Not Accurate
- Hold phone steady at ~45° angle pointing at batsman
- Ensure good lighting conditions
- Ball should be visible in frame throughout delivery
- Red/white/yellow balls work best for color detection

### Sensors Not Working
- Device motion sensors require physical device (not simulator)
- Some older devices may not have accelerometer
- App will use default orientation (45° tilt) as fallback

## Known Limitations

1. **Frame Processing**: Expo Camera API doesn't provide direct frame buffer access, so ball tracking uses trajectory simulation based on recording time. For production, consider using a native module for real-time frame analysis.

2. **Color Detection**: Ball detection relies on color thresholds (red/white/yellow). May need adjustment for different lighting conditions.

3. **Trajectory Accuracy**: Requires steady camera and clear ball visibility. Works best in outdoor daylight conditions.

## Future Enhancements

- [ ] ML-based ball detection using TensorFlow Lite
- [ ] Real-time frame processing with native modules
- [ ] Hawkeye-style 3D ball tracking visualization
- [ ] Wagon wheel and pitch map analytics
- [ ] Multi-camera support for better accuracy
- [ ] Cloud sync for match data

## License

Private project
