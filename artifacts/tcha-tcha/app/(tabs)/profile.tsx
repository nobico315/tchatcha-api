import {
  Bell,
  BellOff,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  Link2,
  LogOut,
  Pencil,
  Shield,
  Smartphone,
  UserCheck,
  X,
  XCircle,
} from "lucide-react-native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatDate } from "@/utils/format";

const NOTIF_KEY = "@tcha_notif_prefs";
const SIMS_KEY = "@tcha_sims_marchandes";

interface NotifPrefs {
  rappelJournee: boolean;
  syncAlert: boolean;
  transactionConfirm: boolean;
}

interface SimsMarchandes {
  mtn: string;
  moov: string;
  celtis: string;
}

const DEFAULT_NOTIF: NotifPrefs = {
  rappelJournee: true,
  syncAlert: true,
  transactionConfirm: false,
};

const DEFAULT_SIMS: SimsMarchandes = { mtn: "", moov: "", celtis: "" };

export default function Profile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser, refreshUser, joinTeamByCode } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showSimsModal, setShowSimsModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningTeam, setJoiningTeam] = useState(false);

  const [editFirst, setEditFirst] = useState(user?.firstName ?? "");
  const [editLast, setEditLast] = useState(user?.lastName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [sims, setSims] = useState<SimsMarchandes>(DEFAULT_SIMS);
  const [editSims, setEditSims] = useState<SimsMarchandes>(DEFAULT_SIMS);
  const [savingSims, setSavingSims] = useState(false);

  useEffect(() => {
    void refreshUser();
    AsyncStorage.getItem(NOTIF_KEY).then((v) => {
      if (v) setNotifPrefs({ ...DEFAULT_NOTIF, ...JSON.parse(v) });
    });
    AsyncStorage.getItem(SIMS_KEY).then((v) => {
      if (v) setSims({ ...DEFAULT_SIMS, ...JSON.parse(v) });
    });
  }, [refreshUser]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  const saveNotifPrefs = async (prefs: NotifPrefs) => {
    setNotifPrefs(prefs);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  };

  const handleSaveSims = async () => {
    setSavingSims(true);
    try {
      const cleaned: SimsMarchandes = {
        mtn: editSims.mtn.replace(/\s/g, ""),
        moov: editSims.moov.replace(/\s/g, ""),
        celtis: editSims.celtis.replace(/\s/g, ""),
      };
      setSims(cleaned);
      await AsyncStorage.setItem(SIMS_KEY, JSON.stringify(cleaned));
      setShowSimsModal(false);
    } finally {
      setSavingSims(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editFirst.trim()) {
      Alert.alert("Erreur", "Le prénom ne peut pas être vide.");
      return;
    }
    if (!editLast.trim()) {
      Alert.alert("Erreur", "Le nom ne peut pas être vide.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateUser({ firstName: editFirst.trim(), lastName: editLast.trim() });
      setShowEditModal(false);
      Alert.alert("Profil mis à jour", "Vos informations ont bien été enregistrées.");
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible de mettre à jour le profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) return null;

  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "TT";
  const subExpiry = new Date(user.subscriptionExpiry);
  const isSubActive = subExpiry > new Date();
  const daysLeft = Math.max(0, Math.ceil((subExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const topPad = Platform.OS === "web" ? 24 : insets.top;

  const configuredSimsCount = [sims.mtn, sims.moov, sims.celtis].filter(Boolean).length;
  const simsSublabel =
    configuredSimsCount === 0
      ? "Aucune SIM configurée"
      : `${configuredSimsCount} opérateur${configuredSimsCount > 1 ? "s" : ""} configuré${configuredSimsCount > 1 ? "s" : ""}`;

  const accountSections = [
    {
      icon: Pencil,
      label: "Informations personnelles",
      sublabel: `${user.firstName} ${user.lastName}`,
      onPress: () => {
        setEditFirst(user.firstName);
        setEditLast(user.lastName);
        setShowEditModal(true);
      },
    },
    {
      icon: Smartphone,
      label: "SIMs Marchandes",
      sublabel: simsSublabel,
      onPress: () => {
        setEditSims({ ...sims });
        setShowSimsModal(true);
      },
    },
    ...(user.role === "agent"
      ? [
          {
            icon: Link2,
            label: "Réseau & Gérant",
            sublabel: user.manager
              ? `Rattaché à ${user.manager.firstName} ${user.manager.lastName}`
              : "Saisir un code d'invitation",
            onPress: () => {
              setJoinCodeInput("");
              setShowJoinModal(true);
            },
          },
        ]
      : []),
  ];

  const securitySections = [
    {
      icon: Shield,
      label: "Code PIN",
      sublabel: "Modifier ou réinitialiser votre accès",
      onPress: () => router.push("/(auth)/forgot-pin"),
    },
    {
      icon: notifPrefs.rappelJournee || notifPrefs.syncAlert ? Bell : BellOff,
      label: "Préférences d'alertes",
      sublabel: "Rappels de journée, soldes & synchro",
      onPress: () => setShowNotifModal(true),
    },
    {
      icon: Info,
      label: "À propos de Tcha-Tcha",
      sublabel: "Version 1.0 · MIDEESSI Bénin",
      onPress: () =>
        Alert.alert(
          "Tcha-Tcha v1.0",
          "Solution de gestion Mobile Money développée par MIDEESSI au Bénin."
        ),
    },
  ];

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 14 }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profil</Text>
          <Text style={styles.headerSub}>Compte, SIMs & sécurité</Text>
        </View>

        <View style={styles.body}>
          {/* Identity Card */}
          <View style={styles.identityCard}>
            <TouchableOpacity
              onPress={() => {
                setEditFirst(user.firstName);
                setEditLast(user.lastName);
                setShowEditModal(true);
              }}
              activeOpacity={0.85}
              style={styles.avatarWrap}
            >
              <LinearGradient colors={["#191970", "#0F172A"]} style={styles.avatar}>
                <Text style={styles.initials}>{initials}</Text>
              </LinearGradient>
              <View style={styles.editBadge}>
                <Pencil size={10} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.identityInfo}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={styles.phone}>{user.phone}</Text>
              <View style={styles.roleRow}>
                {user.role === "gerant" ? (
                  <Briefcase size={13} color={colors.primary} />
                ) : (
                  <UserCheck size={13} color={colors.primary} />
                )}
                <Text style={[styles.roleText, { color: colors.primary }]}>
                  {user.role === "gerant" ? "Gérant de réseau" : "Agent Mobile Money"}
                </Text>
              </View>
            </View>
          </View>

          {/* Manager Card if attached */}
          {user.role === "agent" && user.manager && (
            <View style={styles.managerCard}>
              <Text style={styles.managerLabel}>Gérant rattaché</Text>
              <View style={styles.managerRow}>
                <Text style={styles.managerName}>
                  {user.manager.firstName} {user.manager.lastName}
                </Text>
                <Text style={[styles.managerPhone, { color: colors.primary }]}>
                  {user.manager.phone}
                </Text>
              </View>
            </View>
          )}

          {/* Subscription / Free Access Card */}
          <View
            style={[
              styles.subCard,
              {
                backgroundColor: isSubActive ? "#F0FDF4" : "#FEF2F2",
                borderColor: isSubActive ? "#BBF7D0" : "#FECACA",
              },
            ]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.subTitleRow}>
                {isSubActive ? (
                  <CheckCircle2 size={16} color="#15803D" />
                ) : (
                  <XCircle size={16} color="#DC2626" />
                )}
                <Text style={[styles.subTitle, { color: isSubActive ? "#15803D" : "#DC2626" }]}>
                  {isSubActive ? "Accès actif" : "Accès expiré"}
                </Text>
              </View>
              <Text style={styles.subDate}>
                {isSubActive
                  ? `${daysLeft} jour(s) restant(s) · jusqu'au ${formatDate(user.subscriptionExpiry)}`
                  : `Expiré le ${formatDate(user.subscriptionExpiry)} · synchro en pause`}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.renewBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/abonnement")}
              activeOpacity={0.85}
            >
              <Text style={styles.renewText}>Gérer</Text>
            </TouchableOpacity>
          </View>

          {/* Group 1: Compte */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>COMPTE & RÉSEAU</Text>
            <View style={styles.card}>
              {accountSections.map((s, i) => (
                <TouchableOpacity
                  key={s.label}
                  style={[styles.row, i < accountSections.length - 1 && styles.rowDivider]}
                  onPress={s.onPress}
                  activeOpacity={0.75}
                >
                  <View style={styles.iconWrap}>
                    <s.icon size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{s.label}</Text>
                    <Text style={styles.rowSub}>{s.sublabel}</Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Group 2: Sécurité & Préférences */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>SÉCURITÉ & PRÉFÉRENCES</Text>
            <View style={styles.card}>
              {securitySections.map((s, i) => (
                <TouchableOpacity
                  key={s.label}
                  style={[styles.row, i < securitySections.length - 1 && styles.rowDivider]}
                  onPress={s.onPress}
                  activeOpacity={0.75}
                >
                  <View style={styles.iconWrap}>
                    <s.icon size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{s.label}</Text>
                    <Text style={styles.rowSub}>{s.sublabel}</Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.8}
            onPress={() =>
              Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Déconnexion",
                  style: "destructive",
                  onPress: async () => {
                    await logout();
                    router.replace("/(auth)/login");
                  },
                },
              ])
            }
          >
            <LogOut size={18} color="#DC2626" />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Modal Modifier profil ── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowEditModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View
              style={[
                styles.sheet,
                { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Modifier le profil</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.closeBtn}>
                  <X size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>PRÉNOM</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={editFirst}
                    onChangeText={setEditFirst}
                    placeholder="Prénom"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>NOM</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={editLast}
                    onChangeText={setEditLast}
                    placeholder="Nom"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.hintText}>Téléphone : {user.phone} (non modifiable)</Text>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.75 : 1 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={18} color="#FFFFFF" />
                )}
                <Text style={styles.submitBtnText}>
                  {savingProfile ? "Sauvegarde..." : "Sauvegarder"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal Notifications ── */}
      <Modal
        visible={showNotifModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowNotifModal(false)}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20, width: "100%" },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Préférences d'alertes</Text>
              <TouchableOpacity onPress={() => setShowNotifModal(false)} style={styles.closeBtn}>
                <X size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            {[
              {
                key: "rappelJournee" as const,
                label: "Rappels d'ouverture & clôture",
                desc: "Alerter si la journée n'est pas ouverte ou clôturée le soir",
              },
              {
                key: "syncAlert" as const,
                label: "Alertes de synchronisation",
                desc: "Prévenir quand des opérations s'accumulent hors ligne",
              },
              {
                key: "transactionConfirm" as const,
                label: "Retour haptique transaction",
                desc: "Vibration légère après chaque opération enregistrée",
              },
            ].map((item, i, arr) => (
              <View
                key={item.key}
                style={[styles.notifRow, i < arr.length - 1 && styles.rowDivider]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.notifLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={styles.notifDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={(val) => saveNotifPrefs({ ...notifPrefs, [item.key]: val })}
                  trackColor={{ false: "#CBD5E1", true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Modal SIMs Marchandes ── */}
      <Modal
        visible={showSimsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSimsModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowSimsModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View
              style={[
                styles.sheet,
                { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>SIMs Marchandes</Text>
                  <Text style={styles.sheetSubtitle}>Vos numéros professionnels par réseau</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSimsModal(false)} style={styles.closeBtn}>
                  <X size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 12 }}>
                {[
                  { key: "mtn" as const, label: "SIM MTN MOMO", dot: "#EAB308", placeholder: "01 97 00 00 00" },
                  { key: "moov" as const, label: "SIM MOOV MONEY", dot: "#0EA5E9", placeholder: "01 95 00 00 00" },
                  { key: "celtis" as const, label: "SIM CELTIIS CASH", dot: "#10B981", placeholder: "01 40 00 00 00" },
                ].map((sim) => (
                  <View key={sim.key}>
                    <View style={styles.simLabelRow}>
                      <View style={[styles.operatorDot, { backgroundColor: sim.dot }]} />
                      <Text style={styles.labelInline}>{sim.label}</Text>
                    </View>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={editSims[sim.key]}
                      onChangeText={(t) => setEditSims({ ...editSims, [sim.key]: t })}
                      placeholder={sim.placeholder}
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                    />
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savingSims ? 0.75 : 1 }]}
                onPress={handleSaveSims}
                disabled={savingSims}
              >
                {savingSims ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={18} color="#FFFFFF" />
                )}
                <Text style={styles.submitBtnText}>
                  {savingSims ? "Enregistrement..." : "Enregistrer les SIMs"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal Rejoindre un gérant ── */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setShowJoinModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View
              style={[
                styles.sheet,
                { paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 },
              ]}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Rejoindre un gérant</Text>
                  <Text style={styles.sheetSubtitle}>Saisissez le code partagé par votre gérant</Text>
                </View>
                <TouchableOpacity onPress={() => setShowJoinModal(false)} style={styles.closeBtn}>
                  <X size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              <View>
                <Text style={styles.label}>CODE D'INVITATION</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      fontFamily: "Poppins_700Bold",
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    },
                  ]}
                  value={joinCodeInput}
                  onChangeText={(t) => setJoinCodeInput(t.toUpperCase().trim())}
                  placeholder="EX: KOFF-1234"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  maxLength={12}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: joiningTeam || !joinCodeInput.trim() ? 0.65 : 1,
                  },
                ]}
                disabled={joiningTeam || !joinCodeInput.trim()}
                onPress={async () => {
                  if (!joinCodeInput.trim()) return;
                  setJoiningTeam(true);
                  const res = await joinTeamByCode(joinCodeInput.trim());
                  setJoiningTeam(false);
                  if (res.success) {
                    setShowJoinModal(false);
                    Alert.alert("Rattachement réussi", res.message || "Vous avez rejoint l'équipe du gérant.");
                  } else {
                    Alert.alert("Erreur", res.error || "Code invalide.");
                  }
                }}
              >
                {joiningTeam ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={18} color="#FFFFFF" />
                )}
                <Text style={styles.submitBtnText}>
                  {joiningTeam ? "Vérification..." : "Valider et rejoindre"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: { fontSize: 22, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748B", marginTop: 1 },

  body: { padding: 18, gap: 16 },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 62, height: 62, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFFFFF", fontSize: 22, fontFamily: "Poppins_700Bold" },
  editBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#191970",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  identityInfo: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontFamily: "Poppins_700Bold" },
  phone: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#64748B" },
  roleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  roleText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },

  managerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  managerLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#64748B", textTransform: "uppercase" },
  managerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  managerName: { fontSize: 14, fontFamily: "Poppins_700Bold", color: "#0F172A" },
  managerPhone: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },

  subCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  subTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  subTitle: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  subDate: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#475569", marginTop: 2 },
  renewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  renewText: { fontSize: 12, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },

  sectionBlock: { gap: 8 },
  sectionHeading: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#64748B",
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748B", marginTop: 1 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    height: 52,
    marginTop: 4,
  },
  logoutText: { fontSize: 14, fontFamily: "Poppins_700Bold", color: "#DC2626" },

  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(15, 23, 42, 0.55)" },
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  keyboardView: { width: "100%" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    gap: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  sheetSubtitle: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748B", marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  formRow: { flexDirection: "row", gap: 12 },
  label: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  labelInline: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#334155", letterSpacing: 0.5 },
  simLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
  },
  hintText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748B", textAlign: "center" },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
  notifRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  notifLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  notifDesc: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#64748B", marginTop: 2 },
  operatorDot: { width: 9, height: 9, borderRadius: 5 },
});
