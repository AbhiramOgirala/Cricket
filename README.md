# Gully Cricket

A React Native mobile app for scoring gully cricket matches with AI-powered ball detection.

## Features

- 🏏 Real-time cricket scoring
- 📹 Camera-based ball detection for wides and no-balls
- 📊 Detailed scorecards and statistics
- 🎬 Replay functionality
- 📱 Works with Expo Go (SDK 55)

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
│   ├── calibrate.jsx      # Camera calibration
│   ├── scoring.jsx        # Main scoring screen
│   ├── scorecard.jsx      # Scorecard view
│   ├── result.jsx         # Match result
│   └── replay.jsx         # Replay viewer
├── src/
│   ├── components/        # Reusable components
│   ├── constants/         # App constants
│   ├── store/            # Redux store and slices
│   └── utils/            # Utility functions
├── assets/               # Images and static files
├── .env                  # Environment variables (NOT in Git)
├── .env.example          # Environment template (in Git)
└── .gitignore           # Git ignore rules

```

## Git Ignore

The `.gitignore` file is configured to exclude:

- ✅ `node_modules/` - Dependencies
- ✅ `.env` - Environment variables with secrets
- ✅ `.expo/` - Expo build cache
- ✅ `package-lock.json` - Lock file (can cause conflicts)
- ✅ IDE files (`.vscode/`, `.idea/`)
- ✅ OS files (`.DS_Store`)
- ✅ Build artifacts

The `.env.example` file IS committed to show required variables.

## Technologies

- React Native 0.83.4
- Expo SDK 55
- Expo Router (file-based routing)
- Redux Toolkit (state management)
- Expo Camera (ball detection)
- Supabase (backend)

## Scripts

- `npm start` - Start Expo development server
- `npm run android` - Start on Android device/emulator
- `npm run ios` - Start on iOS device/simulator
- `npm run web` - Start web version

## License

Private project
