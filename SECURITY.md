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

## 3. Shared view security (planned)

Exports meant for a report to read contain only items explicitly marked shared. Private notes are filtered out before export, not hidden in the UI.

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

| Tier        | Examples                              | Handling                                 |
| ----------- | ------------------------------------- | ---------------------------------------- |
| Preferences | Theme                                 | Plain `localStorage`, no personal data   |
| Shared      | Shared notes, action items            | Encrypted at rest, includable in exports |
| Private     | Private notes, mood, performance data | Encrypted at rest, never exported shared |

## 6. Input validation

All user input is treated as untrusted. Imported data is validated against the expected shape before it is stored. Text is rendered through React, which escapes by default, and Markdown goes through DOMPurify.

## 7. Known limitations

- A forgotten passphrase cannot be recovered. This is intentional.
- Browser storage can be cleared by the browser or the user, so keep exported backups.
- JavaScript cannot reliably wipe memory, so keys live in memory while the app is unlocked.

## 8. Responsible disclosure

Please report vulnerabilities privately through GitHub security advisories on this repository. Do not open a public issue. Include steps to reproduce and the affected version. You can expect an acknowledgement within a few days.
