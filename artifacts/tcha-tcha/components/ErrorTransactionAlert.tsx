import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from "react-native";
import { AlertCircle, Trash2, X } from "lucide-react-native";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";

interface ErrorTransactionAlertProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ErrorTransactionAlert({ visible, onDismiss }: ErrorTransactionAlertProps) {
  const colors = useColors();
  const { getErrorTransactions, clearErrorTransaction } = useTransactions();
  
  const errorTxs = getErrorTransactions();
  
  if (errorTxs.length === 0) {
    return null;
  }

  const handleDelete = async (id: string, clientName: string) => {
    Alert.alert(
      "Supprimer transaction",
      `Supprimer la transaction de ${clientName} ? Cette action ne peut pas être annulée.`,
      [
        { text: "Annuler", onPress: () => {} },
        {
          text: "Supprimer",
          onPress: async () => {
            await clearErrorTransaction(id);
          },
          style: "destructive",
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <AlertCircle size={24} color="#ef4444" />
              <Text style={[styles.title, { color: colors.text }]}>
                {errorTxs.length} Transaction{errorTxs.length > 1 ? "s" : ""} en erreur
              </Text>
            </View>
            <TouchableOpacity onPress={onDismiss}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: colors.muted }]}>
            Ces transactions n'ont pas pu être enregistrées. Supprimez-les ou vérifiez votre journée.
          </Text>

          {/* List of error transactions */}
          <ScrollView style={styles.list}>
            {errorTxs.map((tx) => (
              <View
                key={tx.id}
                style={[styles.txItem, { backgroundColor: colors.background, borderColor: "#fee2e2" }]}
              >
                <View style={styles.txInfo}>
                  <Text style={[styles.txClient, { color: colors.text }]}>
                    {tx.clientName}
                  </Text>
                  <Text style={[styles.txDetails, { color: colors.muted }]}>
                    {tx.type} • {formatAmount(tx.amount)} FCFA • {tx.operator}
                  </Text>
                  <Text style={[styles.txTime, { color: "#ef4444" }]}>
                    Erreur de synchronisation
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: "#fee2e2" }]}
                  onPress={() => handleDelete(tx.id, tx.clientName)}
                >
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={onDismiss}
            >
              <Text style={[styles.buttonText, { color: colors.accent }]}>
                Fermer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
  },
  description: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    marginBottom: 16,
    lineHeight: 18,
  },
  list: {
    maxHeight: 300,
    marginBottom: 16,
  },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  txInfo: {
    flex: 1,
  },
  txClient: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    marginBottom: 4,
  },
  txDetails: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    marginBottom: 4,
  },
  txTime: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actions: {
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
});
