import AsyncStorage from "@react-native-async-storage/async-storage";
import { gcm } from "@noble/ciphers/aes.js";
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils.js";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const VAULT_PREFIX = "TCHATCHA-VAULT-V1";
const WEB_STORAGE_PREFIX = "@tcha_account_data:";
const KEYCHAIN_PREFIX = "tcha_offline_vault_key_";
const FILE_PREFIX = "tcha-offline-vault-";
const KEYCHAIN_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

interface OfflineVault {
  version: 1;
  items: Record<string, string>;
}

let operationQueue: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function accountFile(userId: string): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error("Le dossier privé de l’application n’est pas disponible.");
  }
  const userDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return `${FileSystem.documentDirectory}${FILE_PREFIX}${userDigest}.enc`;
}

async function keychainKey(userId: string): Promise<string> {
  const userDigest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const normalizedDigest = userDigest.replace(/[^a-fA-F0-9]/g, "");
  if (normalizedDigest.length !== 64) {
    throw new Error("Impossible de générer un identifiant valide pour le coffre sécurisé.");
  }
  return `${KEYCHAIN_PREFIX}${normalizedDigest}`;
}

function webStorageKey(userId: string, itemKey: string): string {
  return `${WEB_STORAGE_PREFIX}${encodeURIComponent(userId)}:${itemKey}`;
}

async function exists(uri: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(uri)).exists;
}

async function getEncryptionKey(userId: string, fileUri: string): Promise<Uint8Array> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error("Le coffre sécurisé du système n’est pas disponible sur cet appareil.");
  }

  const storageKey = await keychainKey(userId);
  const storedKey = await SecureStore.getItemAsync(storageKey, KEYCHAIN_OPTIONS);
  if (storedKey) {
    const key = hexToBytes(storedKey);
    if (key.length !== 32) {
      throw new Error("La clé du coffre local est invalide. Les données n’ont pas été modifiées.");
    }
    return key;
  }

  if (await exists(fileUri)) {
    throw new Error("La clé sécurisée du coffre local est introuvable. Les données n’ont pas été modifiées.");
  }

  const key = await Crypto.getRandomBytesAsync(32);
  await SecureStore.setItemAsync(storageKey, bytesToHex(key), KEYCHAIN_OPTIONS);
  return key;
}

async function readVault(userId: string): Promise<{ fileUri: string; key: Uint8Array; vault: OfflineVault }> {
  const fileUri = await accountFile(userId);
  const backupUri = `${fileUri}.bak`;

  if (!(await exists(fileUri)) && await exists(backupUri)) {
    await FileSystem.moveAsync({ from: backupUri, to: fileUri });
  }

  const key = await getEncryptionKey(userId, fileUri);
  if (!(await exists(fileUri))) {
    return { fileUri, key, vault: { version: 1, items: {} } };
  }

  const payload = await FileSystem.readAsStringAsync(fileUri);
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== VAULT_PREFIX) {
    throw new Error("Le fichier sécurisé local est invalide. Les données n’ont pas été modifiées.");
  }

  try {
    const nonce = hexToBytes(parts[1]);
    const ciphertext = hexToBytes(parts[2]);
    const aad = utf8ToBytes(`${VAULT_PREFIX}:${userId}`);
    const plaintext = gcm(key, nonce, aad).decrypt(ciphertext);
    const vault = JSON.parse(bytesToUtf8(plaintext)) as OfflineVault;
    if (vault.version !== 1 || !vault.items || typeof vault.items !== "object") {
      throw new Error("Format de coffre inconnu.");
    }
    return { fileUri, key, vault };
  } catch (error) {
    console.error("[OfflineStore] Impossible de lire le coffre chiffré.", error);
    throw new Error("Impossible de déchiffrer le coffre local. Les données n’ont pas été modifiées.");
  }
}

async function writeVault(
  userId: string,
  fileUri: string,
  key: Uint8Array,
  vault: OfflineVault
): Promise<void> {
  const nonce = await Crypto.getRandomBytesAsync(12);
  const aad = utf8ToBytes(`${VAULT_PREFIX}:${userId}`);
  const ciphertext = gcm(key, nonce, aad).encrypt(utf8ToBytes(JSON.stringify(vault)));
  const payload = `${VAULT_PREFIX}:${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
  const temporaryUri = `${fileUri}.${bytesToHex(await Crypto.getRandomBytesAsync(8))}.tmp`;
  const backupUri = `${fileUri}.bak`;

  await FileSystem.writeAsStringAsync(temporaryUri, payload);
  try {
    if (await exists(fileUri)) {
      if (await exists(backupUri)) await FileSystem.deleteAsync(backupUri, { idempotent: true });
      await FileSystem.moveAsync({ from: fileUri, to: backupUri });
    }
    await FileSystem.moveAsync({ from: temporaryUri, to: fileUri });
    if (await exists(backupUri)) await FileSystem.deleteAsync(backupUri, { idempotent: true });
  } catch (error) {
    if (!(await exists(fileUri)) && await exists(backupUri)) {
      await FileSystem.moveAsync({ from: backupUri, to: fileUri });
    }
    if (await exists(temporaryUri)) await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
    throw error;
  }
}

export const offlineAccountStore = {
  getItem(userId: string, itemKey: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(webStorageKey(userId, itemKey));
    }

    return serialize(async () => {
      const { vault } = await readVault(userId);
      return vault.items[itemKey] ?? null;
    });
  },

  setItem(userId: string, itemKey: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      return AsyncStorage.setItem(webStorageKey(userId, itemKey), value);
    }

    return serialize(async () => {
      const { fileUri, key, vault } = await readVault(userId);
      vault.items[itemKey] = value;
      await writeVault(userId, fileUri, key, vault);
    });
  },

  updateItem(
    userId: string,
    itemKey: string,
    update: (currentValue: string | null) => string | null
  ): Promise<string | null> {
    return serialize(async () => {
      if (Platform.OS === "web") {
        const storageKey = webStorageKey(userId, itemKey);
        const nextValue = update(await AsyncStorage.getItem(storageKey));
        if (nextValue === null) {
          await AsyncStorage.removeItem(storageKey);
        } else {
          await AsyncStorage.setItem(storageKey, nextValue);
        }
        return nextValue;
      }

      const { fileUri, key, vault } = await readVault(userId);
      const nextValue = update(vault.items[itemKey] ?? null);
      if (nextValue === null) {
        delete vault.items[itemKey];
      } else {
        vault.items[itemKey] = nextValue;
      }
      await writeVault(userId, fileUri, key, vault);
      return nextValue;
    });
  },

  removeItem(userId: string, itemKey: string): Promise<void> {
    if (Platform.OS === "web") {
      return AsyncStorage.removeItem(webStorageKey(userId, itemKey));
    }

    return serialize(async () => {
      const { fileUri, key, vault } = await readVault(userId);
      delete vault.items[itemKey];
      await writeVault(userId, fileUri, key, vault);
    });
  },
};
