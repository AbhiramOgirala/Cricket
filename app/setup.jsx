import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, SafeAreaView, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { setupMatch } from '../src/store/slices/matchSlice';
import { COLORS } from '../src/constants';
import uuid from 'react-native-uuid';

const { width } = Dimensions.get('window');
const OVER_OPTIONS = [2, 4, 5, 6, 8, 10, 12, 15, 20];

function PlayerInput({ player, index, onChange, onRemove }) {
  return (
    <View style={styles.playerRow}>
      <View style={styles.playerIndexCircle}>
        <Text style={styles.playerIndex}>{index + 1}</Text>
      </View>
      <TextInput
        style={styles.playerInput}
        value={player.name}
        onChangeText={(t) => onChange(index, 'name', t)}
        placeholder={`Player ${index + 1} name`}
        placeholderTextColor={COLORS.text_muted}
      />
      {index >= 2 && (
        <TouchableOpacity onPress={() => onRemove(index)} style={styles.removeBtn}>
          <Ionicons name="close-circle" size={22} color={COLORS.danger} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function TeamSection({ teamNum, teamName, setTeamName, players, setPlayers, color }) {
  const addPlayer = () => {
    if (players.length >= 11) {
      Alert.alert('Max 11 players per team');
      return;
    }
    setPlayers([...players, { id: uuid.v4(), name: '' }]);
  };

  const updatePlayer = (index, field, value) => {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setPlayers(updated);
  };

  const removePlayer = (index) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.teamSection}>
      <View style={[styles.teamHeader, { borderLeftColor: color }]}>
        <MaterialCommunityIcons name="shield" size={20} color={color} />
        <Text style={[styles.teamHeaderText, { color }]}>TEAM {teamNum}</Text>
      </View>
      <TextInput
        style={styles.teamNameInput}
        value={teamName}
        onChangeText={setTeamName}
        placeholder={`Team ${teamNum} name`}
        placeholderTextColor={COLORS.text_muted}
      />
      <Text style={styles.playersLabel}>Players ({players.length})</Text>
      {players.map((player, index) => (
        <PlayerInput
          key={player.id}
          player={player}
          index={index}
          onChange={updatePlayer}
          onRemove={removePlayer}
        />
      ))}
      <TouchableOpacity style={styles.addPlayerBtn} onPress={addPlayer}>
        <Ionicons name="add-circle-outline" size={18} color={color} />
        <Text style={[styles.addPlayerText, { color }]}>Add Player</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SetupScreen() {
  const dispatch = useDispatch();

  const [matchName, setMatchName] = useState('');
  const [team1Name, setTeam1Name] = useState('Team 1');
  const [team2Name, setTeam2Name] = useState('Team 2');
  const [selectedOvers, setSelectedOvers] = useState(6);

  const defaultPlayers = (prefix) =>
    Array.from({ length: 6 }, (_, i) => ({ id: uuid.v4(), name: `${prefix} ${i + 1}` }));

  const [team1Players, setTeam1Players] = useState(defaultPlayers('Player'));
  const [team2Players, setTeam2Players] = useState(defaultPlayers('Player'));

  const handleContinue = () => {
    const validT1 = team1Players.filter((p) => p.name.trim());
    const validT2 = team2Players.filter((p) => p.name.trim());

    if (validT1.length < 2 || validT2.length < 2) {
      Alert.alert('Error', 'Each team needs at least 2 players.');
      return;
    }

    if (!team1Name.trim() || !team2Name.trim()) {
      Alert.alert('Error', 'Please enter names for both teams.');
      return;
    }

    const team1 = { id: 'team1', name: team1Name.trim(), players: validT1 };
    const team2 = { id: 'team2', name: team2Name.trim(), players: validT2 };

    router.push({
      pathname: '/toss',
      params: {
        team1: JSON.stringify(team1),
        team2: JSON.stringify(team2),
        totalOvers: selectedOvers,
        matchName: matchName || `${team1Name} vs ${team2Name}`,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[COLORS.bg_deep, COLORS.bg_dark]} style={styles.container}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Match Setup</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Match Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MATCH NAME (Optional)</Text>
            <TextInput
              style={styles.matchNameInput}
              value={matchName}
              onChangeText={setMatchName}
              placeholder="e.g. Sunday Gully Cup"
              placeholderTextColor={COLORS.text_muted}
            />
          </View>

          {/* Overs Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OVERS PER SIDE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.oversRow}>
                {OVER_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o}
                    style={[styles.overChip, selectedOvers === o && styles.overChipActive]}
                    onPress={() => setSelectedOvers(o)}
                  >
                    <Text style={[styles.overChipText, selectedOvers === o && styles.overChipTextActive]}>
                      {o}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Teams */}
          <TeamSection
            teamNum={1}
            teamName={team1Name}
            setTeamName={setTeam1Name}
            players={team1Players}
            setPlayers={setTeam1Players}
            color={COLORS.primary}
          />
          <TeamSection
            teamNum={2}
            teamName={team2Name}
            setTeamName={setTeam2Name}
            players={team2Players}
            setPlayers={setTeam2Players}
            color={COLORS.secondary}
          />

          {/* Continue */}
          <TouchableOpacity onPress={handleContinue} activeOpacity={0.85} style={styles.continueWrap}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primary_dim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue to Toss</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.text_inverse} />
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg_deep },
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  screenTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text_primary },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text_muted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  matchNameInput: {
    backgroundColor: COLORS.bg_card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text_primary,
    fontSize: 16,
  },
  oversRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  overChip: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.bg_card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overChipActive: {
    backgroundColor: COLORS.primary_glow,
    borderColor: COLORS.primary,
  },
  overChipText: { fontSize: 16, fontWeight: '600', color: COLORS.text_secondary },
  overChipTextActive: { color: COLORS.primary, fontWeight: '800' },
  teamSection: {
    backgroundColor: COLORS.bg_card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 12,
  },
  teamHeaderText: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  teamNameInput: {
    backgroundColor: COLORS.bg_elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text_primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
  },
  playersLabel: {
    fontSize: 11,
    color: COLORS.text_muted,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  playerIndexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.bg_elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerIndex: { fontSize: 12, fontWeight: '700', color: COLORS.text_muted },
  playerInput: {
    flex: 1,
    backgroundColor: COLORS.bg_elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text_primary,
    fontSize: 14,
  },
  removeBtn: { padding: 4 },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addPlayerText: { fontSize: 13, fontWeight: '600' },
  continueWrap: { marginTop: 16 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text_inverse,
    letterSpacing: 0.5,
  },
});
