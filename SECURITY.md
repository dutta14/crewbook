# Security

Crewbook stores sensitive notes about people, so security is a design constraint, not an add-on. This document describes the model the app is built around. Features that are not built yet are marked as planned.

## 1. Security model

- Crewbook is a static, client-only app. There is no backend, no account system and no telemetry.
- All data stays in the browser. The production Content Security Policy sets `connect-src 'none'`, so the app cannot send data to any origin, even if a dependency tries.
- Scripts load from the same origin only (`script-src 'self'`). Framing, plugins and form posts to other origins are blocked.
- Dependencies are kept small. Rendered Markdown is sanitized with DOMPurify before it reaches the DOM.

## 2. Encryption

- Data at rest is encrypted with AES-256-GCM using the Web Crypto API. All reads and writes go through `useEncryptedStorage`; application code does not touch `localStorage` directly (enforced by ESLint).
- Keys are derived from the user's passphrase with PBKDF2 (SHA-256, 310,000 iterations) and are non-extractable.
- There are two independent envelopes, `crewbook_data` (shared data) and `crewbook_private` (private notes and sensitive data). Each has its own random 16-byte salt and its own key, derived from the same passphrase.
- Every write uses a fresh random 96-bit IV. Each envelope records its iteration count so the work factor can be raised later.
- A small encrypted sentinel (`crewbook_check`) tells a wrong passphrase apart from damaged data. Both show one generic message on the lock screen.
- The passphrase and keys live in memory only. Locking, or closing the tab, discards them.
- There is no passphrase recovery. A forgotten passphrase means the data cannot be read; the only option is to erase it and start over.
- Writes are debounced (500ms) and flushed when the app locks or the page is about to unload. The unload flush is best effort because encryption is asynchronous.

## 3. Shared view security

A manager can create a link to a read-only 1:1 page for one engineer. There is no backend, so the link itself carries the data: `#/shared/<token>`, where the token is the compressed payload plus an HMAC-SHA256 signature. Nothing is uploaded; the fragment is never sent to a server.

- **Allowlist, not filter.** `serializeForSharing` copies named fields into a new object. It never spreads a record, so a field added to a model later is not shared by accident. Only notes marked `visibility: 'shared'` (absent means private), action items owned by the manager or that engineer, and agenda items marked `includeInShare` are included. Moods, flight risk, growth, feedback, reminders, leave, key dates, private notes, email, role and avatar images never leave the device.
- **Isolation is enforced.** Sharing code reads data only through `shareStore`, and `shareIsolation.test.ts` plus an ESLint rule fail the build if share files import private stores or name private storage keys. The feedback equivalent is `feedbackIsolation.test.ts`.
- **Strict validation.** The viewer rejects unknown fields, wrong types, oversized payloads (64 KB, also when decompressed, so a small link cannot expand into a large one) and malformed values. Text renders as plain text.
- **Expiry.** A link is valid for 24 hours from creation (checked on the viewer's clock) and shows a plain expired page afterwards.
- **Signature.** The signing key is derived from the manager's passphrase and exists only while unlocked. The recipient has no key, so the signature is verified only in the manager's own unlocked session; a recipient's browser relies on the validation above.
- **Known limitations.** Anyone holding the link can read it until it expires, and it cannot be revoked early. It is a snapshot: later changes are not reflected. Expiry is enforced by the viewer's clock, so it is a courtesy, not access control. The link stays in browser history and chat logs. Very large histories can produce a link too long for some chat apps; the dialog warns when that happens. Browsers without `CompressionStream` cannot create or open links.

## 4. Threat model

| Threat                            | Mitigation                                            |
| --------------------------------- | ----------------------------------------------------- |
| Network interception              | No network calls are permitted by CSP                 |
| Cross-site scripting              | Strict CSP, no inline scripts, DOMPurify on Markdown  |
| Lost or stolen device (locked)    | AES-256-GCM encrypted storage                         |
| Weak passphrase                   | Strength guidance at setup (planned)                  |
| Malicious dependency              | Minimal dependencies, lockfile, SHA-pinned CI actions |
| Unlocked device, shoulder surfing | Out of scope; use OS screen lock and the app lock     |
| Compromised browser or extensions | Out of scope                                          |

## 5. Data classification

| Tier        | Examples                              | Handling                                      |
| ----------- | ------------------------------------- | --------------------------------------------- |
| Preferences | Theme                                 | Plain `localStorage`, no personal data        |
| Shared      | Shared notes, action items            | Encrypted at rest, includable in shared links |
| Private     | Private notes, mood, performance data | Encrypted at rest, never exported shared      |

## 6. Input validation

All user input is treated as untrusted. Imported data is validated against the expected shape before it is stored. Text is rendered through React, which escapes by default, and Markdown goes through DOMPurify.

## 7. Known limitations

- A forgotten passphrase cannot be recovered. This is intentional.
- Browser storage can be cleared by the browser or the user, so keep exported backups.
- JavaScript cannot reliably wipe memory, so keys live in memory while the app is unlocked.

## 8. Responsible disclosure

Please report vulnerabilities privately through GitHub security advisories on this repository. Do not open a public issue. Include steps to reproduce and the affected version. You can expect an acknowledgement within a few days.
