import React from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { X, CheckCircle, AlertCircle } from "lucide-react-native";

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
  currentStep,
  errorMessage,
  onCancel,
  onRetry,
  backgroundColor = "#ffffff",
  primaryColor = "#000000",
  textColor = "#000000",
  mutedColor = "#999999",
  accentColor = "#ffffff",
}: ProgressModalProps) {
  const isError = steps.some((s) => s.status === "error");
  const isComplete = steps.every((s) => s.status === "success");

  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case "success":
        return <CheckCircle size={20} color={primaryColor} />;
      case "error":
        return <AlertCircle size={20} color="#ef4444" />;
      case "loading":
        return <ActivityIndicator size="small" color={primaryColor} />;
      case "pending":
        return (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: mutedColor,
            }}
          />
        );
    }
  };

  const getStepColor = (step: ProgressStep) => {
    switch (step.status) {
      case "success":
        return primaryColor;
      case "error":
        return "#ef4444";
      case "loading":
        return primaryColor;
      case "pending":
        return mutedColor;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.modal, { backgroundColor }]}>
          {/* Header avec titre et bouton fermer */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            {isError && onCancel && (
              <TouchableOpacity onPress={onCancel}>
                <X size={24} color={textColor} />
              </TouchableOpacity>
            )}
          </View>

          {/* Liste des étapes */}
          <View style={styles.stepsContainer}>
            {steps.map((step, index) => (
              <View key={step.id}>
                <View style={styles.step}>
                  <View style={styles.stepIcon}>{getStepIcon(step)}</View>
                  <Text
                    style={[
                      styles.stepLabel,
                      { color: getStepColor(step) },
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepConnector,
                      {
                        backgroundColor:
                          step.status === "success" ? primaryColor : mutedColor,
                      },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Message d'erreur */}
          {isError && errorMessage && (
            <View style={[styles.errorBox, { backgroundColor: "#fee2e2" }]}>
              <Text style={[styles.errorText, { color: "#991b1b" }]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Boutons d'action */}
          <View style={styles.actions}>
            {isError && onRetry && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: primaryColor }]}
                onPress={onRetry}
              >
                <Text style={[styles.buttonText, { color: accentColor }]}>
                  Réessayer
                </Text>
              </TouchableOpacity>
            )}
            {isError && onCancel && (
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: "transparent", borderWidth: 1, borderColor: primaryColor },
                ]}
                onPress={onCancel}
              >
                <Text style={[styles.buttonText, { color: primaryColor }]}>
                  Annuler
                </Text>
              </TouchableOpacity>
            )}
            {isComplete && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: primaryColor }]}
                onPress={onCancel}
              >
                <Text style={[styles.buttonText, { color: accentColor }]}>
                  Fermer
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Spinner central si en cours */}
          {!isError && !isComplete && (
            <View style={styles.spinner}>
              <ActivityIndicator size="large" color={primaryColor} />
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
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
  },
  stepsContainer: {
    marginVertical: 16,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  stepIcon: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  stepLabel: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  stepConnector: {
    width: 2,
    height: 16,
    marginLeft: 11,
    alignSelf: "flex-start",
  },
  errorBox: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  errorText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  spinner: {
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
});
