import { describe, expect, it } from 'vitest';

/*
 * A share link carries a person's 1:1 data out of the encrypted store, so the code that builds,
 * reads and shows it is held to a short list of things it may touch. Everything not on a list
 * below (private notes, flight risk, moods, growth, skills, peer connections, reminders, leave,
 * key dates, to-dos,
 * decisions, the other people on the team) is out of reach by construction. Adding an entry to an
 * allowlist must be a deliberate edit, in review, and the same module list lives in .eslintrc.cjs.
 */
const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx', '!/src/**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const files = Object.entries(sources).map(([path, code]) => ({
  path: path.replace(/^\//, ''),
  code,
}));

const SHARE_FILE = /(shar(e|ing)|ExpiredLink|ActiveTokensList|QRCode)/i;
const shareFiles = files.filter(({ path }) => SHARE_FILE.test(path));

// The only code that decides what leaves the device, and the link format itself.
const PAYLOAD_FILES = [
  'src/utils/serializeForSharing.ts',
  'src/utils/shareUrl.ts',
  'src/utils/validateSharePayload.ts',
];

const ALLOWED_DATA = new Set(['actionItems', 'agenda', 'errors', 'members', 'notes', 'settings']);
const ALLOWED_HOOKS = new Set([
  'useEncryptedStorage',
  'useToast',
  'useDarkMode',
  'useSharedView',
  'useSharedActionItems',
  'useNow',
]);
const ALLOWED_COMPONENTS = new Set([
  'Modal',
  'ConfirmDialog',
  'icons',
  'ShareLinkPopover',
  'ShareButton',
  'ActiveTokensList',
  'QRCode',
  'SharedActionItems',
  'SharedActionRow',
  'CollapsibleSection',
  // Only for the storage type the data modules are written against.
  'EncryptedStorageProvider',
]);

const PRIVATE_DOMAIN =
  /feedback|flight|mood|growth|skill|proficien|reminder|private|leaveEntr|keyDate|connection|peer|network|threeSixty|relationship/i;

const specifiers = (code: string) =>
  [...code.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);

const basename = (specifier: string) => specifier.split('/').pop() ?? specifier;

const baseNamesIn = (directory: string) =>
  new Set(
    files
      .filter(({ path }) => path.startsWith(`src/${directory}/`))
      .map(({ path }) => basename(path).replace(/\.tsx?$/, '')),
  );

describe('share isolation', () => {
  it('finds the share code it is meant to guard', () => {
    const paths = shareFiles.map(({ path }) => path);
    for (const expected of [
      ...PAYLOAD_FILES,
      'src/data/shareStore.ts',
      'src/hooks/useSharedView.ts',
      'src/pages/SharedOneOnOne.tsx',
      'src/pages/ExpiredLink.tsx',
      'src/components/ShareLinkPopover.tsx',
      'src/components/ActiveTokensList.tsx',
      'src/components/QRCode.tsx',
      'src/utils/shareExpiry.ts',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('only reads the data modules it needs', () => {
    const dataModules = baseNamesIn('data');
    const offenders = shareFiles.flatMap(({ path, code }) =>
      specifiers(code)
        .filter((specifier) => /^\.{1,2}\//.test(specifier))
        .filter((specifier) => dataModules.has(basename(specifier)))
        .filter(
          (specifier) =>
            !ALLOWED_DATA.has(basename(specifier)) && basename(specifier) !== 'shareStore',
        )
        .map((specifier) => `${path} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it('only uses the hooks it needs', () => {
    const hooks = baseNamesIn('hooks');
    const offenders = shareFiles.flatMap(({ path, code }) =>
      specifiers(code)
        .filter((specifier) => /^\.{1,2}\//.test(specifier))
        .filter(
          (specifier) => hooks.has(basename(specifier)) && !ALLOWED_HOOKS.has(basename(specifier)),
        )
        .map((specifier) => `${path} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it('only uses the components it needs, never a private-notes or flight-risk one', () => {
    const components = baseNamesIn('components');
    const offenders = shareFiles.flatMap(({ path, code }) =>
      specifiers(code)
        .filter((specifier) => /^\.{1,2}\//.test(specifier))
        .filter(
          (specifier) =>
            components.has(basename(specifier)) && !ALLOWED_COMPONENTS.has(basename(specifier)),
        )
        .map((specifier) => `${path} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it('never imports another page', () => {
    const pages = baseNamesIn('pages');
    const offenders = shareFiles.flatMap(({ path, code }) =>
      specifiers(code)
        .filter(
          (specifier) => pages.has(basename(specifier)) && basename(specifier) !== 'ExpiredLink',
        )
        .map((specifier) => `${path} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it('does not reach private storage keys by name', () => {
    const keys =
      /['"`](flightRisk|moods?|moodEntries|growth\w*|skills?|connections?|feedback\w*|reminders|leave|dateEvents|todos|decisions|followUps)['"`]/i;
    for (const { path, code } of shareFiles) {
      expect(code, path).not.toMatch(keys);
    }
  });

  it('keeps the payload builder, link format and validator to types and utilities', () => {
    for (const path of PAYLOAD_FILES) {
      const code = sources[`/${path}`];
      expect(code, path).toBeDefined();
      for (const specifier of specifiers(code)) {
        expect(specifier, `${path} imports ${specifier}`).toMatch(/^(\.\.\/types\/|\.\/)/);
        expect(specifier, `${path} imports ${specifier}`).not.toMatch(
          /\/(data|hooks|components|pages)\//,
        );
      }
    }
  });

  it('keeps the payload builder, link format and validator free of private-domain vocabulary', () => {
    for (const path of PAYLOAD_FILES) {
      expect(sources[`/${path}`], path).not.toMatch(PRIVATE_DOMAIN);
    }
  });

  it('never mentions the private domains in the shared types or the viewer', () => {
    for (const path of [
      'src/types/sharing.ts',
      'src/hooks/useSharedView.ts',
      'src/pages/SharedOneOnOne.tsx',
      'src/pages/ExpiredLink.tsx',
      'src/components/ActiveTokensList.tsx',
      'src/components/QRCode.tsx',
      'src/utils/shareExpiry.ts',
    ]) {
      expect(sources[`/${path}`], path).not.toMatch(PRIVATE_DOMAIN);
    }
  });
});
