import { Bell, BellOff, Briefcase, Check, CheckCircle, ChevronRight, Info, LogOut, Pencil, Shield, UserCheck, X, XCircle } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatDate } from "@/utils/format";

const NOTIF_KEY = "@tcha_notif_prefs";

interface NotifPrefs {
  rappelJournee: boolean;
  syncAlert: boolean;
  transactionConfirm: boolean;
}

const DEFAULT_NOTIF: NotifPrefs = {
  rappelJournee: true,
  syncAlert: true,
  transactionConfirm: false,
};

export default function Profile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser, refreshUser } = useAuth();

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Edit profile form
  const [editFirst, setEditFirst] = useState(user?.firstName ?? "");
  const [editLast, setEditLast] = useState(user?.lastName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF);

  useEffect(() => {
    refreshUser();
    AsyncStorage.getItem(NOTIF_KEY).then((v) => {
      if (v) setNotifPrefs(JSON.parse(v));
    });
  }, []);

  const saveNotifPrefs = async (prefs: NotifPrefs) => {
    setNotifPrefs(prefs);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
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

  const sections = [
    {
      icon: Pencil,
      label: "Modifier le profil",
      sublabel: `${user.firstName} ${user.lastName}`,
      onPress: () => { setEditFirst(user.firstName); setEditLast(user.lastName); setShowEditModal(true); },
    },
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
      <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
          <Text style={[styles.heading, { color: colors.primary }]}>Profil</Text>
        </View>

        <View style={styles.body}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => { setEditFirst(user.firstName); setEditLast(user.lastName); setShowEditModal(true); }}
              activeOpacity={0.85}
            >
              <Text style={styles.initials}>{initials}</Text>
              <View style={styles.editBadge}>
                <Pencil size={10} color="#191970" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.name, { color: colors.text }]}>{user.firstName} {user.lastName}</Text>
            <Text style={[styles.phone, { color: colors.muted }]}>{user.phone}</Text>
            <View style={[styles.roleBadge, { backgroundColor: "#eef0ff", flexDirection: "row", alignItems: "center", gap: 6 }]}>
              {user.role === "gerant" ? <Briefcase size={13} color={colors.primary} /> : <UserCheck size={13} color={colors.primary} />}
              <Text style={[styles.roleText, { color: colors.primary }]}>
                {user.role === "gerant" ? "Gérant" : "Agent"}
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

          <View style={[styles.subCard, { backgroundColor: isSubActive ? colors.successBg : colors.dangerBg, borderColor: isSubActive ? colors.successText : colors.dangerText }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {isSubActive ? <CheckCircle size={15} color={colors.successText} /> : <XCircle size={15} color={colors.dangerText} />}
                <Text style={[styles.subTitle, { color: isSubActive ? colors.successText : colors.dangerText }]}>
                  Abonnement {isSubActive ? "actif" : "expiré"}
                </Text>
              </View>
              <Text style={[styles.subDate, { color: isSubActive ? colors.successText : colors.dangerText }]}>
                {isSubActive ? `Expire dans ${daysLeft} jours` : `Expiré le ${formatDate(user.subscriptionExpiry)}`}
              </Text>
            </View>
            <TouchableOpacity style={[styles.renewBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/abonnement")}>
              <Text style={[styles.renewText, { color: colors.accent }]}>Renouveler</Text>
            </TouchableOpacity>
          </View>

          {/* Liste des sections */}
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
                <View style={[styles.iconWrap, { backgroundColor: "#eef0ff" }]}>
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
            style={[styles.logoutBtn, { borderColor: colors.dangerText }]}
            onPress={() => Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
              { text: "Annuler", style: "cancel" },
              { text: "Déconnexion", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
            ])}
          >
            <LogOut size={18} color={colors.dangerText} />
            <Text style={[styles.logoutText, { color: colors.dangerText }]}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Modal Modifier profil ── */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowEditModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
              <Check size={18} color="#FFD700" />
              <Text style={[styles.submitBtnText, { color: "#FFD700" }]}>
                {savingProfile ? "Sauvegarde..." : "Sauvegarder"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal Notifications ── */}
      <Modal visible={showNotifModal} transparent animationType="slide" onRequestClose={() => setShowNotifModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowNotifModal(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
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
                thumbColor={notifPrefs[item.key] ? "#FFD700" : "#fff"}
              />
            </View>
          ))}

          <Text style={[{ fontSize: 11, fontFamily: "Poppins_400Regular", color: colors.muted, textAlign: "center", marginTop: 8 }]}>
            Les notifications push nécessitent l'autorisation de votre appareil.
          </Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  body: { padding: 20, gap: 20 },
  avatarSection: { alignItems: "center", gap: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#191970", alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFD700", fontSize: 26, fontFamily: "Poppins_700Bold" },
  editBadge: { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  phone: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10 },
  roleText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  subCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 14, padding: 16 },
  subTitle: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  subDate: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  managerInfo: { marginTop: 12, borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  managerLabel: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  managerName: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  managerPhone: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  renewBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  renewText: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  rowSub: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderRadius: 12, height: 52 },
  logoutText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  formRow: { flexDirection: "row", gap: 14 },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: "Poppins_400Regular" },
  submitBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  submitBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  notifRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  notifLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  notifDesc: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
});