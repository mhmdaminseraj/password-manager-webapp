export type ItemType = 'login' | 'card' | 'note';

export interface BaseVaultItem {
  id: string;
  type: ItemType;
  title: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  folderId?: string;
}

export interface LoginItem extends BaseVaultItem {
  type: 'login';
  username?: string;
  password?: string;
  url?: string;
  totpSecret?: string; // Base32 encoded TOTP key
}

export interface CardItem extends BaseVaultItem {
  type: 'card';
  cardholder?: string;
  number?: string;
  expiry?: string; // MM/YY
  cvv?: string;
  pin?: string;
  brand?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'generic';
}

export interface NoteItem extends BaseVaultItem {
  type: 'note';
  content?: string;
  color?: string; // Accent color for the card
}

export type VaultItem = LoginItem | CardItem | NoteItem;

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  lockTimeoutMinutes: number; // For auto-locking (e.g. 15 mins)
  googleClientId?: string; // Optional client-provided OAuth ID for GDrive sync
}

export interface VaultState {
  items: VaultItem[];
  folders: Folder[];
  version: number; // incremented on changes
  lastSyncedAt?: string;
}

export interface EncryptedVaultPayload {
  salt: string;       // PBKDF2 salt (hex)
  iv: string;         // AES-GCM IV (hex)
  ciphertext: string; // encrypted JSON string of VaultState (hex)
  iterations: number; // PBKDF2 iterations
}
