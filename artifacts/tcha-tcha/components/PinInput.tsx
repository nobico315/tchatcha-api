import React, { useRef } from "react";
import { StyleSheet, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
}

export function PinInput({ value, onChange, length = 6 }: PinInputProps) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);

  return (
    <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
      <View style={styles.container}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={[
                styles.circle,
                {
                  borderColor: filled ? colors.primary : colors.border,
                  backgroundColor: filled ? colors.primary : colors.surface,
                },
              ]}
            >
              {filled && <View style={[styles.dot, { backgroundColor: "#FFFFFF" }]} />}
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9]/g, "").slice(0, length))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={length}
          style={styles.hidden}
          caretHidden
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 12, justifyContent: "center" },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 16, height: 16, borderRadius: 8 },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
});
