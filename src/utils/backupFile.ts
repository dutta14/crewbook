import {
  PBKDF2_ITERATIONS,
  base64ToBytes,
  bytesToBase64,
  decryptString,
  deriveKey,
  encryptString,
  generateSalt,
  type EncryptedEnvelope,
} from './crypto';
import {
  BackupValidationError,
  FieldIssue,
  int,
  literal,
  record,
  required,
  str,
} from './schemaCheck';

/**
 * The backup file is JSON that carries one AES-256-GCM envelope. The key comes from the backup
 * passphrase and a random salt stored in the file, so every file gets a fresh salt and IV and a
 * changed or damaged file fails the authentication tag instead of decrypting to something odd.
 */
export const BACKUP_FORMAT = 'crewbook-backup';
export const BACKUP_EXTENSION = '.json.enc';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MAX_ITERATIONS = 1_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export const NOT_A_BACKUP_MESSAGE = 'This file is not a valid Crewbook backup.';

/** The passphrase did not open the file, or the file was changed or damaged after it was saved. */
export class BackupDecryptError extends Error {
  constructor() {
    super('That passphrase did not open this backup, or the file is damaged');
    this.name = 'BackupDecryptError';
  }
}

export class BackupTooLargeError extends Error {
  constructor() {
    super('That file is larger than 10 MB, so it cannot be a Crewbook backup');
    this.name = 'BackupTooLargeError';
  }
}

export interface BackupContainer {
  salt: Uint8Array<ArrayBuffer>;
  envelope: EncryptedEnvelope;
}

interface ContainerJson {
  format: typeof BACKUP_FORMAT;
  v: number;
  salt: string;
  iv: string;
  ct: string;
  iterations: number;
}

const base64 = (max: number) => str({ min: 4, max, pattern: BASE64_PATTERN });

const containerCheck = record<ContainerJson>({
  format: required(literal(BACKUP_FORMAT)),
  v: required(int(1, 1_000)),
  salt: required(base64(64)),
  iv: required(base64(64)),
  ct: required(base64(MAX_BACKUP_BYTES * 2)),
  iterations: required(int(PBKDF2_ITERATIONS, MAX_ITERATIONS)),
});

function decodeFixed(value: string, length: number): Uint8Array<ArrayBuffer> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64ToBytes(value);
  } catch {
    throw new BackupValidationError(NOT_A_BACKUP_MESSAGE);
  }
  if (bytes.length !== length) throw new BackupValidationError(NOT_A_BACKUP_MESSAGE);
  return bytes;
}

/** Checks the outer file only. Nothing is decrypted, and anything unexpected is refused. */
export function readContainer(text: string): BackupContainer {
  if (text.length > MAX_BACKUP_BYTES * 2) throw new BackupTooLargeError();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupValidationError(NOT_A_BACKUP_MESSAGE);
  }
  let parsed: ContainerJson;
  try {
    parsed = containerCheck(raw);
  } catch (error) {
    if (error instanceof FieldIssue) throw new BackupValidationError(NOT_A_BACKUP_MESSAGE);
    throw error;
  }
  if (parsed.v !== 1) {
    throw new BackupValidationError(
      'This backup was made by a newer version of Crewbook. Update Crewbook, then try again.',
    );
  }
  decodeFixed(parsed.iv, IV_BYTES);
  return {
    salt: decodeFixed(parsed.salt, SALT_BYTES),
    envelope: { v: 1, iv: parsed.iv, ct: parsed.ct, iterations: parsed.iterations },
  };
}

/** Encrypts backup text under a key from `passphrase`; returns the text of the file to save. */
export async function sealBackup(plaintext: string, passphrase: string): Promise<string> {
  const salt = generateSalt();
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const envelope = await encryptString(plaintext, key, PBKDF2_ITERATIONS);
  const file: ContainerJson = {
    format: BACKUP_FORMAT,
    v: 1,
    salt: bytesToBase64(salt),
    iv: envelope.iv,
    ct: envelope.ct,
    iterations: envelope.iterations,
  };
  return JSON.stringify(file);
}

/** Decrypts and authenticates. Throws BackupDecryptError for a wrong passphrase or a changed file. */
export async function openBackup(container: BackupContainer, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, container.salt, container.envelope.iterations);
  try {
    return await decryptString(container.envelope, key);
  } catch {
    throw new BackupDecryptError();
  }
}

const pad = (value: number) => String(value).padStart(2, '0');

export function backupFileName(date: Date = new Date()): string {
  return `crewbook-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}${BACKUP_EXTENSION}`;
}

export function hasBackupExtension(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(BACKUP_EXTENSION);
}
