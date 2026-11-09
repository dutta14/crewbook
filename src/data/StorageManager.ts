import type { DataSnapshot } from '../utils/backupSchema';
import {
  decryptString,
  deriveKey,
  deriveSigningKey,
  encryptString,
  generateSalt,
  isCryptoAvailable,
  PBKDF2_ITERATIONS,
} from '../utils/crypto';
import {
  CHECK_SENTINEL,
  clearAllStorage,
  clearPreImportBackup,
  CorruptedDataError,
  CryptoUnavailableError,
  getStorageStatus,
  purgeExpiredPreImportBackup,
  readEnvelope,
  readSalt,
  STORAGE_CHECK_KEY,
  STORAGE_DATA_KEY,
  STORAGE_PRIVATE_KEY,
  STORAGE_PRIVATE_SALT_KEY,
  STORAGE_SALT_KEY,
  StorageWriteError,
  WrongPassphraseError,
  writeEnvelope,
  writePreImportBackup,
  writeSalt,
} from '../utils/encryptedStorage';

export const WRITE_DEBOUNCE_MS = 500;

type DataObject = Record<string, unknown>;
type WriteErrorListener = (error: StorageWriteError) => void;

interface Slot {
  storageKey: string;
  isPrivate: boolean;
  key: CryptoKey | null;
  iterations: number;
  cache: DataObject | null;
  isDirty: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  // Writes for one envelope run strictly in order so an older snapshot never lands last.
  queue: Promise<void>;
}

function createSlot(storageKey: string, isPrivate: boolean): Slot {
  return {
    storageKey,
    isPrivate,
    key: null,
    iterations: PBKDF2_ITERATIONS,
    cache: null,
    isDirty: false,
    timer: null,
    queue: Promise.resolve(),
  };
}

function assertSafeKey(key: string): void {
  if (key === '__proto__') throw new RangeError('Invalid storage key');
}

/** A deep copy through JSON, so a snapshot never shares objects with the live caches. */
function cloneData(data: DataObject): DataObject {
  return JSON.parse(JSON.stringify(data)) as DataObject;
}

function parseDataObject(plaintext: string): DataObject | null {
  try {
    const parsed: unknown = JSON.parse(plaintext);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as DataObject;
    }
  } catch {
    // Falls through to the corruption path below.
  }
  return null;
}

/**
 * Two AES-256-GCM envelopes behind one API. The main envelope holds shared app data; the private
 * envelope (flight risk, private notes) has its own salt and key and is decrypted only on demand.
 * Writes update memory synchronously and are debounced to localStorage.
 */
export class StorageManager {
  private readonly main = createSlot(STORAGE_DATA_KEY, false);
  private readonly priv = createSlot(STORAGE_PRIVATE_KEY, true);
  private readonly listeners = new Set<WriteErrorListener>();
  private unlocked = false;
  private lockPromise: Promise<void> | null = null;
  private recoveredFromCorruption = false;
  private signingKey: CryptoKey | null = null;

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** The HMAC key for share links, derived from the passphrase. Null while locked. */
  get shareSigningKey(): CryptoKey | null {
    return this.unlocked ? this.signingKey : null;
  }

  get isPrivateUnlocked(): boolean {
    return this.unlocked && this.priv.cache !== null;
  }

  /** True when the last unlock found decrypted data that was not valid JSON and started empty. */
  get didRecoverFromCorruption(): boolean {
    return this.recoveredFromCorruption;
  }

  /** Subscribes to failed writes (quota exceeded, storage unavailable). Returns an unsubscribe. */
  onWriteError(listener: WriteErrorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async setup(passphrase: string): Promise<void> {
    if (!isCryptoAvailable()) throw new CryptoUnavailableError();
    if (passphrase.length === 0) throw new RangeError('Passphrase must not be empty');
    if (getStorageStatus() !== 'first-launch') {
      throw new Error('Crewbook storage is already initialised');
    }
    await this.lockPromise;

    const mainSalt = generateSalt();
    const privateSalt = generateSalt();
    const [mainKey, privateKey, signingKey] = await Promise.all([
      deriveKey(passphrase, mainSalt),
      deriveKey(passphrase, privateSalt),
      deriveSigningKey(passphrase, mainSalt),
    ]);
    const [check, mainEnvelope, privateEnvelope] = await Promise.all([
      encryptString(CHECK_SENTINEL, mainKey),
      encryptString('{}', mainKey),
      encryptString('{}', privateKey),
    ]);

    try {
      writeEnvelope(STORAGE_DATA_KEY, mainEnvelope);
      writeEnvelope(STORAGE_PRIVATE_KEY, privateEnvelope, true);
      writeEnvelope(STORAGE_CHECK_KEY, check);
      writeSalt(STORAGE_SALT_KEY, mainSalt);
      writeSalt(STORAGE_PRIVATE_SALT_KEY, privateSalt, true);
    } catch (error) {
      clearAllStorage();
      throw error;
    }

    this.activate(mainKey, PBKDF2_ITERATIONS, {}, privateKey, PBKDF2_ITERATIONS, signingKey);
    this.recoveredFromCorruption = false;
  }

  /** Throws WrongPassphraseError or CorruptedDataError; resolves once the main data is in memory. */
  async unlock(passphrase: string): Promise<void> {
    if (!isCryptoAvailable()) throw new CryptoUnavailableError();
    await this.lockPromise;
    if (this.unlocked) return;

    const mainSalt = readSalt(STORAGE_SALT_KEY);
    const privateSalt = readSalt(STORAGE_PRIVATE_SALT_KEY);
    const check = readEnvelope(STORAGE_CHECK_KEY);
    if (!mainSalt || !privateSalt || !check) throw new CorruptedDataError();
    const dataEnvelope = readEnvelope(STORAGE_DATA_KEY);
    const privateEnvelope = readEnvelope(STORAGE_PRIVATE_KEY);
    const privateIterations = privateEnvelope?.iterations ?? PBKDF2_ITERATIONS;

    const [mainKey, privateKey, signingKey] = await Promise.all([
      deriveKey(passphrase, mainSalt, check.iterations),
      deriveKey(passphrase, privateSalt, privateIterations),
      deriveSigningKey(passphrase, mainSalt, check.iterations),
    ]);

    let sentinel: string;
    try {
      sentinel = await decryptString(check, mainKey);
    } catch {
      throw new WrongPassphraseError();
    }
    if (sentinel !== CHECK_SENTINEL) throw new WrongPassphraseError();

    let data: DataObject = {};
    let recovered = false;
    if (dataEnvelope) {
      let plaintext: string;
      try {
        plaintext = await decryptString(dataEnvelope, mainKey);
      } catch {
        throw new CorruptedDataError();
      }
      const parsed = parseDataObject(plaintext);
      if (parsed) {
        data = parsed;
      } else {
        recovered = true;
      }
    }

    this.activate(mainKey, check.iterations, data, privateKey, privateIterations, signingKey);
    this.recoveredFromCorruption = recovered;
    purgeExpiredPreImportBackup(Date.now());
  }

  /** Decrypts the private envelope. Call before getPrivateData/setPrivateData; safe to repeat. */
  async loadPrivate(): Promise<void> {
    this.assertUnlocked();
    const slot = this.priv;
    if (slot.cache !== null || !slot.key) return;
    const key = slot.key;

    const envelope = readEnvelope(STORAGE_PRIVATE_KEY);
    if (!envelope) {
      slot.cache = {};
      return;
    }
    let plaintext: string;
    try {
      plaintext = await decryptString(envelope, key);
    } catch {
      throw new CorruptedDataError();
    }
    const parsed = parseDataObject(plaintext);
    if (!parsed) throw new CorruptedDataError();
    // The app may have been locked while the decrypt was in flight.
    if (slot.key === key) slot.cache = parsed;
  }

  getData<T>(key: string): T | null {
    return this.read<T>(this.main, key);
  }

  setData<T>(key: string, value: T): void {
    this.write(this.main, key, value);
  }

  /** Throws if the private envelope has not been loaded; a blind write would clobber it. */
  getPrivateData<T>(key: string): T | null {
    return this.read<T>(this.priv, key);
  }

  setPrivateData<T>(key: string, value: T): void {
    this.write(this.priv, key, value);
  }

  /**
   * Writes any pending debounced changes now. Never rejects: a failure is also sent to onWriteError
   * and returned here so a caller that needs to roll back can tell. Resolves null when saved.
   */
  async flush(): Promise<StorageWriteError | null> {
    const results = await Promise.all([this.persist(this.main), this.persist(this.priv)]);
    return results.find((failure) => failure !== null) ?? null;
  }

  /** Flushes pending writes, then drops both keys and both decrypted caches. */
  lock(): Promise<void> {
    if (!this.unlocked) return this.lockPromise ?? Promise.resolve();
    this.unlocked = false;
    this.signingKey = null;
    this.lockPromise = this.flush()
      .then(() => {
        for (const slot of [this.main, this.priv]) {
          slot.key = null;
          slot.cache = null;
          slot.isDirty = false;
        }
      })
      .finally(() => {
        this.lockPromise = null;
      });
    return this.lockPromise;
  }

  /**
   * A copy of everything in memory, for building a backup. The private half is null when that
   * envelope cannot be opened, so a damaged private envelope never blocks a backup of the rest.
   */
  async exportSnapshot(): Promise<DataSnapshot> {
    this.assertUnlocked();
    let privateData: DataObject | null = null;
    try {
      await this.loadPrivate();
      privateData = this.priv.cache ? cloneData(this.priv.cache) : null;
    } catch (error) {
      if (!(error instanceof CorruptedDataError)) throw error;
    }
    this.assertUnlocked();
    return { main: cloneData(this.main.cache ?? {}), private: privateData };
  }

  /** True when `passphrase` opens this browser's storage. The check value never leaves this class. */
  async verifyPassphrase(passphrase: string): Promise<boolean> {
    this.assertUnlocked();
    const salt = readSalt(STORAGE_SALT_KEY);
    const check = readEnvelope(STORAGE_CHECK_KEY);
    if (!salt || !check) throw new CorruptedDataError();
    try {
      const key = await deriveKey(passphrase, salt, check.iterations);
      return (await decryptString(check, key)) === CHECK_SENTINEL;
    } catch {
      return false;
    }
  }

  /**
   * Replaces every record in both envelopes with `next`. The current data is first sealed into a
   * 24-hour safety copy; if that or either write fails, the old data is put back and the error is
   * thrown, so a restore either lands completely or not at all.
   */
  async replaceAll(next: DataSnapshot, onProgress?: (fraction: number) => void): Promise<void> {
    this.assertUnlocked();
    const nextPrivate = next.private ?? {};
    try {
      await this.loadPrivate();
    } catch (error) {
      // A damaged private envelope is the case a restore is for; its contents are not recoverable.
      if (!(error instanceof CorruptedDataError)) throw error;
    }
    const { main, priv } = this;
    if (!main.key || !main.cache) throw new Error('Crewbook storage is locked');
    const previous = { main: main.cache, private: priv.cache };

    const safety = await encryptString(
      JSON.stringify({ main: previous.main, private: previous.private }),
      main.key,
      main.iterations,
    );
    onProgress?.(0.25);
    writePreImportBackup(safety, Date.now());

    main.cache = cloneData(next.main);
    priv.cache = cloneData(nextPrivate);
    main.isDirty = true;
    priv.isDirty = true;
    try {
      const mainFailure = await this.persist(main, false);
      if (mainFailure) throw mainFailure;
      onProgress?.(0.6);
      const privateFailure = await this.persist(priv, false);
      if (privateFailure) throw privateFailure;
      if (!this.unlocked) throw new Error('Crewbook storage was locked during the import');
      onProgress?.(1);
    } catch (error) {
      main.cache = previous.main;
      priv.cache = previous.private;
      main.isDirty = true;
      priv.isDirty = previous.private !== null;
      const restored = await Promise.all([this.persist(main, false), this.persist(priv, false)]);
      if (restored.every((failure) => failure === null)) clearPreImportBackup();
      throw error;
    }
  }

  private activate(
    mainKey: CryptoKey,
    mainIterations: number,
    data: DataObject,
    privateKey: CryptoKey,
    privateIterations: number,
    signingKey: CryptoKey,
  ): void {
    this.signingKey = signingKey;
    this.main.key = mainKey;
    this.main.iterations = mainIterations;
    this.main.cache = data;
    this.priv.key = privateKey;
    this.priv.iterations = privateIterations;
    this.priv.cache = null;
    this.unlocked = true;
  }

  private assertUnlocked(): void {
    if (!this.unlocked) throw new Error('Crewbook storage is locked');
  }

  private read<T>(slot: Slot, key: string): T | null {
    this.assertUnlocked();
    if (!slot.cache) throw new Error('Private data is not loaded; call loadPrivate() first');
    return Object.hasOwn(slot.cache, key) ? (slot.cache[key] as T) : null;
  }

  private write<T>(slot: Slot, key: string, value: T): void {
    this.assertUnlocked();
    assertSafeKey(key);
    if (!slot.cache) throw new Error('Private data is not loaded; call loadPrivate() first');
    slot.cache[key] = value;
    slot.isDirty = true;
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = setTimeout(() => void this.persist(slot), WRITE_DEBOUNCE_MS);
  }

  private persist(slot: Slot, notify = true): Promise<StorageWriteError | null> {
    if (slot.timer) {
      clearTimeout(slot.timer);
      slot.timer = null;
    }
    let outcome: StorageWriteError | null = null;
    const run = async () => {
      if (!slot.isDirty || !slot.key || !slot.cache) return;
      slot.isDirty = false;
      // A private write is retried once so one transient failure does not surface to the user.
      const attempts = slot.isPrivate ? 2 : 1;
      let failure: StorageWriteError | null = null;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const envelope = await encryptString(
            JSON.stringify(slot.cache),
            slot.key,
            slot.iterations,
          );
          writeEnvelope(slot.storageKey, envelope, slot.isPrivate);
          return;
        } catch (error) {
          failure =
            error instanceof StorageWriteError
              ? error
              : new StorageWriteError(false, slot.isPrivate);
        }
      }
      slot.isDirty = true;
      outcome = failure;
      if (failure && notify) this.listeners.forEach((listener) => listener(failure));
    };
    slot.queue = slot.queue.then(run);
    return slot.queue.then(() => outcome);
  }
}
