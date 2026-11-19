import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { Transaction } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { Badge } from "./Badge";
import { formatAmount, formatTime } from "@/utils/format";
import { useTransactions } from "@/context/TransactionContext";
import { calculateCommission, CommissionSettings, DEFAULT_COMMISSION_SETTINGS } from "@/utils/commission";
import * as Haptics from "expo-haptics";

interface TransactionItemProps {
  item: Transaction;
  onPress?: () => void;
  commissionSettings?: CommissionSettings;
}

export function TransactionItem({ item, onPress, commissionSettings = DEFAULT_COMMISSION_SETTINGS }: TransactionItemProps) {
  const colors = useColors();
  const { updateTransaction, deleteTransaction } = useTransactions();
  const [marking, setMarking] = useState(false);
  const commission = calculateCommission(item.type, item.amount, item.operator, commissionSettings);
  const typeBadge = {
    depot: { label: "D", backgroundColor: "rgba(76, 175, 80, 0.1)", color: "#4CAF50" },
    retrait: { label: "R", backgroundColor: "rgba(244, 67, 54, 0.1)", color: "#F44336" },
    vente: { label: "V", backgroundColor: "rgba(25, 25, 112, 0.1)", color: "#191970" },
    recharge: { label: "RC", backgroundColor: "rgba(0, 150, 136, 0.1)", color: "#00897B" },
  }[item.type];

  const handleLongPress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Supprimer la transaction",
      "Voulez-vous vraiment supprimer cette transaction ? Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(item.id);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.75}
    >
      <View style={styles.info}>
        <View style={[styles.typeBadge, { backgroundColor: typeBadge.backgroundColor }]}>
          <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>{typeBadge.label}</Text>
        </View>
        <View style={styles.details}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.clientName || "Client inconnu"}
            </Text>
            {item.paid === false ? (
              <Badge custom={{ bg: "#fdecea", text: "#b00000", label: "Non payé" }} />
            ) : (
              <Badge custom={{ bg: "#eafaf0", text: "#1a7a4a", label: "Payé" }} />
            )}
          </View>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {formatTime(item.createdAt)} · {item.operator}
          </Text>
          {!item.paid && (
            <TouchableOpacity
              onPress={async () => {
                if (marking) return;
                setMarking(true);
                try {
                  await updateTransaction(item.id, { paid: true });
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}
                setMarking(false);
              }}
              style={[styles.payBtn, { borderColor: colors.primary, backgroundColor: "rgba(25,25,112,0.06)" }]}
            >
              <Text style={[styles.payBtnText, { color: colors.primary }]}>{marking ? "..." : "Marquer payé"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.text }]}>{formatAmount(item.amount)} FCFA</Text>
        <Text style={[styles.commission, { color: colors.successText }]}>+ {formatAmount(commission)} FCFA</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  info: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  typeBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  typeBadgeText: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  details: { marginLeft: 10, flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  sub: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
  right: { alignItems: "flex-end", flexShrink: 0 },
  amount: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  commission: { fontSize: 12, fontFamily: "Poppins_600SemiBold", marginTop: 2 },
  payBtn: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  payBtnText: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
});
