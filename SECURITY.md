# Security

Crewbook stores sensitive notes about people, so security is a design constraint, not an add-on. This document describes the model the app is built around. Features that are not built yet are marked as planned.

## 1. Security model

- Crewbook is a static, client-only app. There is no backend, no account system and no telemetry.
- All data stays in the browser. The production Content Security Policy sets `connect-src 'none'`, so the app cannot send data to any origin, even if a dependency tries.
- Scripts load from the same origin only (`script-src 'self'`). Framing, plugins and form posts to other origins are blocked.
- Dependencies are kept small. Rendered Markdown is sanitized with DOMPurify before it reaches the DOM.

## 2. Encryption (planned, issue #2)

- Data at rest is encrypted with AES-256-GCM using the Web Crypto API.
- Keys are derived from the user's passphrase with PBKDF2 (SHA-256, 310,000 iterations, random salt per vault).
- A two-envelope design wraps a random data key with the passphrase-derived key, so changing the passphrase re-wraps one small envelope instead of re-encrypting all data.
- Every encryption uses a fresh random 96-bit IV. The passphrase and keys are never persisted.

## 3. Shared view security (planned)

Exports meant for a report to read contain only items explicitly marked shared. Private notes are filtered out before export, not hidden in the UI.

## 4. Threat model

| Threat                            | Mitigation                                                  |
| --------------------------------- | ----------------------------------------------------------- |
| Network interception              | No network calls are permitted by CSP                       |
| Cross-site scripting              | Strict CSP, no inline scripts, DOMPurify on Markdown        |
| Lost or stolen device (locked)    | AES-256-GCM encrypted storage (planned)                     |
| Weak passphrase                   | Strength guidance at setup (planned)                        |
| Malicious dependency              | Minimal dependencies, lockfile, SHA-pinned CI actions       |
| Unlocked device, shoulder surfing | Out of scope; use OS screen lock and the app lock (planned) |
| Compromised browser or extensions | Out of scope                                                |

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
