/**
 * BarcodeScannerModal.tsx — expo-camera ~17.0.10 (Expo SDK 54)
 * Hooks appelés TOUJOURS dans le même ordre (règle React).
 */
import React, { useRef } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

export interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  colors: any;
  title?: string;
}

export default function BarcodeScannerModal({
  visible, onClose, onScanned, colors, title = "Scanner le code-barres",
}: BarcodeScannerModalProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  const handleClose = () => { scannedRef.current = false; onClose(); };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScanned(data);
    handleClose();
  };

  const isGranted = permission?.granted === true;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={s.overlay} onPress={handleClose} />
      <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 24 }]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={[s.title, { color: colors.primary }]}>{title}</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={12}><X size={22} color={colors.muted} /></TouchableOpacity>
        </View>

        {Platform.OS === "web" ? (
          <View style={[s.placeholderBox, { borderColor: colors.border }]}>
            <Text style={[s.infoText, { color: colors.text }]}>Le scanner n'est pas disponible dans le navigateur.{"\n"}Saisissez le code-barres manuellement.</Text>
          </View>
        ) : !isGranted ? (
          <View style={[s.placeholderBox, { borderColor: colors.border }]}>
            <Text style={[s.infoText, { color: colors.text }]}>L'accès à la caméra est nécessaire pour scanner les codes-barres.</Text>
            <TouchableOpacity style={[s.permBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
              <Text style={[s.permBtnText, { color: "#FFD700" }]}>Autoriser la caméra</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.cameraBox, { borderColor: colors.border }]}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr","ean13","ean8","upc_a","upc_e","code128","code39","code93","itf14","datamatrix","pdf417","aztec"] }}
            />
            <View style={s.viewfinder} pointerEvents="none">
              <View style={[s.corner, s.cornerTL]} /><View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} /><View style={[s.corner, s.cornerBR]} />
            </View>
            <View style={s.hintRow} pointerEvents="none">
              <Text style={s.hintText}>Placez le code-barres dans le cadre</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const C = 24; const BW = 3; const GOLD = "#FFD700";
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16, position: "absolute", left: 0, right: 0, bottom: 0 },
  handle: { width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  cameraBox: { borderRadius: 20, overflow: "hidden", height: 300, borderWidth: 1, backgroundColor: "#000" },
  placeholderBox: { borderRadius: 20, borderWidth: 1, minHeight: 180, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  infoText: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center", lineHeight: 22 },
  hintRow: { position: "absolute", bottom: 16, left: 0, right: 0, alignItems: "center" },
  hintText: { color: "#fff", fontSize: 13, fontFamily: "Poppins_600SemiBold", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  viewfinder: { position: "absolute", top: "18%", left: "12%", right: "12%", bottom: "18%" },
  corner: { position: "absolute", width: C, height: C, borderColor: GOLD, borderWidth: BW },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  permBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14 },
  permBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});
