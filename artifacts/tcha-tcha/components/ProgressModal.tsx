import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { X, CheckCircle2, AlertCircle } from "lucide-react-native";

export type ProgressStatus = "pending" | "loading" | "success" | "error";

export interface ProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
}

interface ProgressModalProps {
  visible: boolean;
  title: string;
  steps: ProgressStep[];
  currentStep?: string;
  errorMessage?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  backgroundColor?: string;
  primaryColor?: string;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
}

export function ProgressModal({
  visible,
  title,
  steps,
  errorMessage,
  onCancel,
  onRetry,
  backgroundColor = "#FFFFFF",
  primaryColor = "#191970",
  textColor = "#0F172A",
  mutedColor = "#94A3B8",
}: ProgressModalProps) {
  const isError = steps.some((s) => s.status === "error");
  const isComplete = steps.every((s) => s.status === "success");

  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case "success":
        return <CheckCircle2 size={20} color="#16A34A" />;
      case "error":
        return <AlertCircle size={20} color="#DC2626" />;
      case "loading":
        return <ActivityIndicator size="small" color={primaryColor} />;
      case "pending":
        return <View style={[styles.pendingDot, { borderColor: "#CBD5E1" }]} />;
    }
  };

  const getStepColor = (step: ProgressStep) => {
    switch (step.status) {
      case "success":
        return "#15803D";
      case "error":
        return "#DC2626";
      case "loading":
        return textColor;
      case "pending":
        return mutedColor;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            {isError && onCancel && (
              <TouchableOpacity
                onPress={onCancel}
                style={styles.closeIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            {steps.map((step) => {
              const isActive = step.status === "loading";
              return (
                <View
                  key={step.id}
                  style={[
                    styles.stepRow,
                    isActive && { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
                    step.status === "error" && { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
                  ]}
                >
                  <View style={styles.stepIcon}>{getStepIcon(step)}</View>
                  <Text style={[styles.stepLabel, { color: getStepColor(step) }]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Error box */}
          {isError && errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Actions */}
          {(isError || isComplete) && (
            <View style={styles.actions}>
              {isError && onCancel && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>Annuler</Text>
                </TouchableOpacity>
              )}
              {isError && onRetry && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: primaryColor }]}
                  onPress={onRetry}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              )}
              {isComplete && onCancel && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: primaryColor }]}
                  onPress={onCancel}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Continuer</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    borderRadius: 24,
    padding: 22,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepsContainer: {
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  stepIcon: {
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  stepLabel: {
    flex: 1,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  errorText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "#F1F5F9",
  },
  secondaryButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#334155",
  },
});
