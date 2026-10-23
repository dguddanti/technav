import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const app = { name: '[DEFAULT]' };
  return {
    app,
    getApps: vi.fn(() => [] as { name: string }[]),
    initializeApp: vi.fn(() => app),
    isSupported: vi.fn(async () => true),
    getAnalytics: vi.fn(),
  };
});

vi.mock('firebase/app', () => ({ getApps: sdk.getApps, initializeApp: sdk.initializeApp }));
vi.mock('firebase/analytics', () => ({ isSupported: sdk.isSupported, getAnalytics: sdk.getAnalytics }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.getApps.mockReturnValue([]);
  sdk.isSupported.mockResolvedValue(true);
  vi.stubEnv('PROD', true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Firebase Analytics startup', () => {
  it('does not collect development traffic', async () => {
    vi.stubEnv('PROD', false);
    const { startAnalytics } = await import('./firebase');
    await startAnalytics();
    expect(sdk.isSupported).not.toHaveBeenCalled();
    expect(sdk.getAnalytics).not.toHaveBeenCalled();
  });

  it('initializes the configured production property only once', async () => {
    const { startAnalytics } = await import('./firebase');
    await Promise.all([startAnalytics(), startAnalytics()]);
    expect(sdk.initializeApp).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'technav-db7a8', measurementId: 'G-V35FLZGGQ8',
    }));
    expect(sdk.getAnalytics).toHaveBeenCalledExactlyOnceWith(sdk.app);
  });

  it('skips Analytics in unsupported browsers', async () => {
    sdk.isSupported.mockResolvedValue(false);
    const { startAnalytics } = await import('./firebase');
    await expect(startAnalytics()).resolves.toBeUndefined();
    expect(sdk.getAnalytics).not.toHaveBeenCalled();
  });

  it('contains SDK failures without an unhandled rejection', async () => {
    const error = new Error('Browser storage unavailable');
    sdk.isSupported.mockRejectedValue(error);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { startAnalytics } = await import('./firebase');
    await expect(startAnalytics()).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledExactlyOnceWith('Firebase Analytics could not be initialized.', error);
    expect(sdk.getAnalytics).not.toHaveBeenCalled();
  });

  it('reuses an existing default Firebase app', async () => {
    sdk.getApps.mockReturnValue([sdk.app]);
    const { startAnalytics } = await import('./firebase');
    await startAnalytics();
    expect(sdk.initializeApp).not.toHaveBeenCalled();
    expect(sdk.getAnalytics).toHaveBeenCalledExactlyOnceWith(sdk.app);
  });
});
