import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

const { height } = Dimensions.get('window');

const ROLE_CONFIG = {
  striker: {
    title: 'Select Striker',
    icon: 'cricket',
    color: COLORS.primary,
    pool: 'batting',
  },
  nonStriker: {
    title: 'Select Non-Striker',
    icon: 'cricket',
    color: COLORS.primary,
    pool: 'batting',
  },
  bowler: {
    title: 'Select Bowler',
    icon: 'flash',
    color: COLORS.secondary,
    pool: 'bowling',
  },
  newBatsman: {
    title: 'New Batsman In',
    icon: 'cricket',
    color: COLORS.danger,
    pool: 'batting',
  },
};

export default function PlayerSelectModal({
  visible,
  role,
  teams,
  currentBatsmen,
  onSelect,
  onClose,
}) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.striker;
  const teamPool = config.pool === 'batting' ? teams?.batting : teams?.bowling;
  const players = teamPool?.players || [];

  // Exclude already-on-field batsmen
  const excludeIds = new Set();
  if (role === 'nonStriker' && currentBatsmen?.striker) {
    excludeIds.add(currentBatsmen.striker.id);
  }
  if (role === 'striker' && currentBatsmen?.nonStriker) {
    excludeIds.add(currentBatsmen.nonStriker.id);
  }

  const availablePlayers = players.filter((p) => !excludeIds.has(p.id));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: config.color }]}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name={config.icon} size={22} color={config.color} />
              <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.text_muted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.teamLabel}>{teamPool?.name}</Text>

          {availablePlayers.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No players available</Text>
              <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={availablePlayers}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.playerRow}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.playerNum, { backgroundColor: `${config.color}22` }]}>
                    <Text style={[styles.playerNumText, { color: config.color }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={styles.playerName}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.text_muted} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: COLORS.bg_card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.7,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: { padding: 4 },
  teamLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text_muted,
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  list: { paddingHorizontal: 16 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  playerNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNumText: {
    fontSize: 14,
    fontWeight: '800',
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  emptyWrap: {
    padding: 30,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.text_secondary,
  },
  skipBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.bg_elevated,
    borderRadius: 10,
  },
  skipBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});
