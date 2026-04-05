import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import store from '../src/store';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true });

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <StatusBar style="light" backgroundColor="#070c1b" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#070c1b' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="toss" />
          {/* calibrate screen removed - auto detection replaces manual calibration */}
          <Stack.Screen name="scoring" />
          <Stack.Screen name="replay" />
          <Stack.Screen name="scorecard" />
          <Stack.Screen name="result" />
          <Stack.Screen name="history" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
