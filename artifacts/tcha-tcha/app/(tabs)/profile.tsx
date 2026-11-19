import { Bell, BellOff, Briefcase, Check, CheckCircle, ChevronRight, Info, Link2, LogOut, Pencil, Shield, Smartphone, UserCheck, Users, X, XCircle } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
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

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showSimsModal, setShowSimsModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Join by code form
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningTeam, setJoiningTeam] = useState(false);

  // Edit profile form
  const [editFirst, setEditFirst] = useState(user?.firstName ?? "");
  const [editLast, setEditLast] = useState(user?.lastName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF);

  // SIMs marchandes
  const [sims, setSims] = useState<SimsMarchandes>(DEFAULT_SIMS);
  const [editSims, setEditSims] = useState<SimsMarchandes>(DEFAULT_SIMS);
  const [savingSims, setSavingSims] = useState(false);

  useEffect(() => {
    refreshUser();
    AsyncStorage.getItem(NOTIF_KEY).then((v) => {
      if (v) setNotifPrefs(JSON.parse(v));
    });
    AsyncStorage.getItem(SIMS_KEY).then((v) => {
      if (v) setSims(JSON.parse(v));
    });
  }, []);

  const saveNotifPrefs = async (prefs: NotifPrefs) => {
    setNotifPrefs(prefs);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  };

  const handleSaveSims = async () => {
    setSavingSims(true);
    const cleaned: SimsMarchandes = {
      mtn: editSims.mtn.replace(/\s/g, ""),
      moov: editSims.moov.replace(/\s/g, ""),
      celtis: editSims.celtis.replace(/\s/g, ""),
    };
    setSims(cleaned);
    await AsyncStorage.setItem(SIMS_KEY, JSON.stringify(cleaned));
    setSavingSims(false);
    setShowSimsModal(false);
  };

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const subExpiry = new Date(user.subscriptionExpiry);
  const isSubActive = subExpiry > new Date();
  const daysLeft = Math.ceil((subExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSaveProfile = async () => {
    if (!editFirst.trim()) { Alert.alert("Erreur", "Le prénom ne peut pas être vide."); return; }
    if (!editLast.trim()) { Alert.alert("Erreur", "Le nom ne peut pas être vide."); return; }
    setSavingProfile(true);
    await updateUser({ firstName: editFirst.trim(), lastName: editLast.trim() });
    setSavingProfile(false);
    setShowEditModal(false);
    Alert.alert("Profil mis à jour", "Vos informations ont été modifiées.");
  };

  const configuredSimsCount = [sims.mtn, sims.moov, sims.celtis].filter(Boolean).length;
  const simsSublabel = configuredSimsCount === 0
    ? "Aucune carte configurée"
    : `${configuredSimsCount} opérateur${configuredSimsCount > 1 ? "s" : ""} configuré${configuredSimsCount > 1 ? "s" : ""}`;

  const sections = [
    {
      icon: Pencil,
      label: "Modifier le profil",
      sublabel: `${user.firstName} ${user.lastName}`,
      onPress: () => { setEditFirst(user.firstName); setEditLast(user.lastName); setShowEditModal(true); },
    },
    {
      icon: Smartphone,
      label: "Mes SIMs Marchandes",
      sublabel: simsSublabel,
      onPress: () => {
        setEditSims({ ...sims });
        setShowSimsModal(true);
      },
    },
    ...(user.role === "agent" ? [{
      icon: Link2,
      label: "Rejoindre un gérant",
      sublabel: user.manager ? `Rattaché à ${user.manager.firstName} ${user.manager.lastName}` : "Saisir un code d'invitation",
      onPress: () => {
        setJoinCodeInput("");
        setShowJoinModal(true);
      },
    }] : []),
    {
      icon: Shield,
      label: "Changer le code PIN",
      sublabel: "Sécurité du compte",
      onPress: () => router.push("/(auth)/forgot-pin"),
    },
    {
      icon: notifPrefs.rappelJournee || notifPrefs.syncAlert ? Bell : BellOff,
      label: "Notifications",
      sublabel: "Préférences d'alertes",
      onPress: () => setShowNotifModal(true),
    },
    {
      icon: Info,
      label: "À propos de Tcha-Tcha",
      sublabel: "Version 1.0",
      onPress: () => Alert.alert("Tcha-Tcha v1.0", "Une solution MIDEESSI pour les agents Mobile Money.\n\nDéveloppé avec passion au Bénin."),
    },
  ];

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: "#FFFFFF" }} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header White */}
        <View style={[styles.whiteHeader, { paddingTop: topPad + 12 }]}>
          <Text style={styles.headerTitle}>Mon Profil</Text>
          <Text style={styles.headerSub}>Compte & Paramètres de sécurité</Text>
        </View>

        <View style={styles.body}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={() => { setEditFirst(user.firstName); setEditLast(user.lastName); setShowEditModal(true); }}
              activeOpacity={0.85}
              style={{ position: "relative" }}
            >
              <LinearGradient colors={["#191970", "#0d0d5c"]} style={styles.avatar}>
                <Text style={styles.initials}>{initials}</Text>
              </LinearGradient>
              <View style={styles.editBadge}>
                <Pencil size={11} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <Text style={[styles.name, { color: colors.text }]}>{user.firstName} {user.lastName}</Text>
            <Text style={[styles.phone, { color: colors.muted }]}>{user.phone}</Text>

            <View style={[styles.roleBadge, { backgroundColor: "rgba(25,25,112,0.08)", flexDirection: "row", alignItems: "center", gap: 6 }]}>
              {user.role === "gerant" ? <Briefcase size={13} color={colors.primary} /> : <UserCheck size={13} color={colors.primary} />}
              <Text style={[styles.roleText, { color: colors.primary }]}>
                {user.role === "gerant" ? "Gérant de réseau" : "Agent titulaire"}
              </Text>
            </View>

            {user.role === "agent" && user.manager && (
              <View style={[styles.managerInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.managerLabel, { color: colors.muted }]}>Gérant rattaché</Text>
                <Text style={[styles.managerName, { color: colors.text }]}>
                  {user.manager.firstName} {user.manager.lastName}
                </Text>
                <Text style={[styles.managerPhone, { color: colors.primary }]}>{user.manager.phone}</Text>
              </View>
            )}
          </View>

          {/* Subscription Card */}
          <View
            style={[
              styles.subCard,
              {
                backgroundColor: isSubActive ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
                borderColor: isSubActive ? "#16a34a" : "#dc2626",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {isSubActive ? <CheckCircle size={16} color="#16a34a" /> : <XCircle size={16} color="#dc2626" />}
                <Text style={[styles.subTitle, { color: isSubActive ? "#16a34a" : "#dc2626" }]}>
                  Abonnement {isSubActive ? "actif" : "expiré"}
                </Text>
              </View>
              <Text style={[styles.subDate, { color: colors.muted }]}>
                {isSubActive ? `Expire dans ${daysLeft} jours` : `Expiré le ${formatDate(user.subscriptionExpiry)}`}
              </Text>
              {!isSubActive && (
                <Text style={[styles.subDate, { color: colors.muted }]}>
                  L’application reste utilisable localement ; la synchronisation en ligne est désactivée.
                </Text>
              )}
            </View>
            <TouchableOpacity style={[styles.renewBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/abonnement")}>
              <Text style={[styles.renewText, { color: "#FFFFFF" }]}>Renouveler</Text>
            </TouchableOpacity>
          </View>

          {/* Settings List Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {sections.map((s, i) => (
              <TouchableOpacity
                key={s.label}
                style={[
                  styles.row,
                  i < sections.length - 1 && { borderBottomWidth: 1, borderColor: colors.border },
                ]}
                onPress={s.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: "rgba(25,25,112,0.08)" }]}>
                  <s.icon size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{s.label}</Text>
                  <Text style={[styles.rowSub, { color: colors.muted }]}>{s.sublabel}</Text>
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.05)" }]}
            onPress={() => Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
              { text: "Annuler", style: "cancel" },
              { text: "Déconnexion", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
            ])}
          >
            <LogOut size={18} color="#ef4444" />
            <Text style={[styles.logoutText, { color: "#ef4444" }]}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Modal Modifier profil ── */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowEditModal(false)} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.primary }]}>Modifier le profil</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <X size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Avatar preview */}
              <View style={[styles.avatar, { alignSelf: "center", marginBottom: 8 }]}>
                <Text style={styles.initials}>
                  {`${editFirst[0] ?? "?"}${editLast[0] ?? "?"}`.toUpperCase()}
                </Text>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.muted }]}>PRÉNOM</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                    value={editFirst}
                    onChangeText={setEditFirst}
                    placeholder="Prénom"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.muted }]}>NOM</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                    value={editLast}
                    onChangeText={setEditLast}
                    placeholder="Nom"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>

              <Text style={[{ fontSize: 12, fontFamily: "Poppins_400Regular", color: colors.muted, textAlign: "center" }]}>
                Numéro de téléphone · {user.phone} (non modifiable)
              </Text>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.7 : 1 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                <Check size={18} color="#FFFFFF" />
                <Text style={[styles.submitBtnText, { color: "#FFFFFF" }]}>
                  {savingProfile ? "Sauvegarde..." : "Sauvegarder"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal Notifications ── */}
      <Modal visible={showNotifModal} transparent animationType="slide" onRequestClose={() => setShowNotifModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowNotifModal(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20, width: "100%" }]}>
            <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.primary }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                <X size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {[
              {
                key: "rappelJournee" as const,
                label: "Rappel d'ouverture de journée",
                desc: "Recevoir un rappel le matin pour ouvrir la journée",
              },
              {
                key: "syncAlert" as const,
                label: "Alertes de synchronisation",
                desc: "Être notifié quand des transactions sont en attente de sync",
              },
              {
                key: "transactionConfirm" as const,
                label: "Confirmation de transaction",
                desc: "Vibration après chaque transaction enregistrée",
              },
            ].map((item, i, arr) => (
              <View
                key={item.key}
                style={[
                  styles.notifRow,
                  { borderColor: colors.border },
                  i < arr.length - 1 && { borderBottomWidth: 1 },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.notifLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.notifDesc, { color: colors.muted }]}>{item.desc}</Text>
                </View>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={(val) => saveNotifPrefs({ ...notifPrefs, [item.key]: val })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={notifPrefs[item.key] ? "#FFFFFF" : "#F4F3F4"}
                />
              </View>
            ))}

            <Text style={[{ fontSize: 11, fontFamily: "Poppins_400Regular", color: colors.muted, textAlign: "center", marginTop: 8 }]}>
              Les notifications push nécessitent l'autorisation de votre appareil.
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Modal SIMs Marchandes ── */}
      <Modal visible={showSimsModal} transparent animationType="slide" onRequestClose={() => setShowSimsModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSimsModal(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={[styles.sheetTitle, { color: colors.primary }]}>SIMs Marchandes</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Poppins_400Regular", color: colors.muted, marginTop: 2 }}>
                    Vos numéros professionnels par opérateur
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowSimsModal(false)}>
                  <X size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 14, marginTop: 4 }}>
                {/* MTN SIM */}
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <View style={[styles.operatorDot, { backgroundColor: "#FFC700" }]} />
                    <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>SIM MTN MOMO</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                    value={editSims.mtn}
                    onChangeText={(t) => setEditSims({ ...editSims, mtn: t })}
                    placeholder="Ex: 01 97 00 00 00"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* MOOV SIM */}
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <View style={[styles.operatorDot, { backgroundColor: "#00C3FF" }]} />
                    <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>SIM MOOV MONEY</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                    value={editSims.moov}
                    onChangeText={(t) => setEditSims({ ...editSims, moov: t })}
                    placeholder="Ex: 01 95 00 00 00"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* CELTIIS SIM */}
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <View style={[styles.operatorDot, { backgroundColor: "#00A86B" }]} />
                    <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>SIM CELTIIS CASH</Text>
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                    value={editSims.celtis}
                    onChangeText={(t) => setEditSims({ ...editSims, celtis: t })}
                    placeholder="Ex: 01 40 00 00 00"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savingSims ? 0.7 : 1, marginTop: 6 }]}
                onPress={handleSaveSims}
                disabled={savingSims}
              >
                <Check size={18} color="#FFFFFF" />
                <Text style={[styles.submitBtnText, { color: "#FFFFFF" }]}>
                  {savingSims ? "Enregistrement..." : "Enregistrer les SIMs"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal Rejoindre un gérant (Code d'invitation) ── */}
      <Modal visible={showJoinModal} transparent animationType="slide" onRequestClose={() => setShowJoinModal(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowJoinModal(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={[styles.sheetTitle, { color: colors.primary }]}>Rejoindre un Gérant</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Poppins_400Regular", color: colors.muted, marginTop: 2 }}>
                    Entrez le code d'invitation partagé par votre gérant
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                  <X size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 10, gap: 10 }}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>CODE D'INVITATION (EX: KOFF-1234)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text, fontFamily: "Poppins_700Bold", letterSpacing: 1.5, textTransform: "uppercase" }]}
                  value={joinCodeInput}
                  onChangeText={(t) => setJoinCodeInput(t.toUpperCase().trim())}
                  placeholder="EX: KOFF-1234"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  maxLength={12}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: joiningTeam ? 0.7 : 1, marginTop: 12 }]}
                disabled={joiningTeam || !joinCodeInput.trim()}
                onPress={async () => {
                  if (!joinCodeInput.trim()) return;
                  setJoiningTeam(true);
                  const res = await joinTeamByCode(joinCodeInput.trim());
                  setJoiningTeam(false);
                  if (res.success) {
                    setShowJoinModal(false);
                    Alert.alert("Félicitations ! 🎉", res.message || "Vous avez rejoint le réseau du gérant.");
                  } else {
                    Alert.alert("Erreur", res.error || "Code invalide.");
                  }
                }}
              >
                <Check size={18} color="#FFFFFF" />
                <Text style={[styles.submitBtnText, { color: "#FFFFFF" }]}>
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
  whiteHeader: {
    paddingHorizontal: 24,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#000000", letterSpacing: -0.3 },
  headerSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#8E9AB4", marginTop: 2 },

  body: { padding: 20, gap: 18 },
  avatarSection: { alignItems: "center", gap: 8, marginTop: 4 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFFFFF", fontSize: 28, fontFamily: "Poppins_700Bold" },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#191970",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  name: { fontSize: 20, fontFamily: "Poppins_700Bold", letterSpacing: -0.2 },
  phone: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },

  subCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  subTitle: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  subDate: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 3 },
  managerInfo: { marginTop: 10, borderWidth: 1, borderRadius: 16, padding: 14, gap: 4, width: "100%", alignItems: "center" },
  managerLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  managerName: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  managerPhone: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },

  renewBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12 },
  renewText: { fontSize: 13, fontFamily: "Poppins_700Bold" },

  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 1 },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderRadius: 16, height: 54, marginTop: 4 },
  logoutText: { fontSize: 15, fontFamily: "Poppins_700Bold" },

  // Modals
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  keyboardView: { width: "100%" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  formRow: { flexDirection: "row", gap: 14 },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, opacity: 0.6 },
  input: { height: 54, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 15, fontFamily: "Poppins_400Regular" },
  submitBtn: { height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  submitBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold", letterSpacing: 0.2 },
  notifRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  notifLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  notifDesc: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
  operatorDot: { width: 10, height: 10, borderRadius: 5 },
});