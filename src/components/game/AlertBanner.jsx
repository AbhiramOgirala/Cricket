import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

const SEVERITY_CONFIG = {
  warning: {
    bg: COLORS.warning_glow,
    border: COLORS.warning,
    icon: 'warning',
    iconColor: COLORS.warning,
  },
  danger: {
    bg: COLORS.danger_glow,
    border: COLORS.danger,
    icon: 'alert-circle',
    iconColor: COLORS.danger,
  },
  info: {
    bg: COLORS.info_glow,
    border: COLORS.info,
    icon: 'information-circle',
    iconColor: COLORS.info,
  },
};

export default function AlertBanner({ alert, onDismiss }) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss?.(alert.id));
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Ionicons name={config.icon} size={20} color={config.iconColor} />
      <Text style={[styles.message, { color: config.iconColor }]}>{alert.message}</Text>
      <TouchableOpacity onPress={() => onDismiss?.(alert.id)} style={styles.closeBtn}>
        <Ionicons name="close" size={16} color={config.iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  message: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  closeBtn: { padding: 4 },
});
