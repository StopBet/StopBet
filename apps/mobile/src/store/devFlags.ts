let _simulateOffline = false;
let _overrideDays: number | null = null;

export const devFlags = {
  get simulateOffline() { return _simulateOffline; },
  setSimulateOffline(v: boolean) { _simulateOffline = v; },

  get overrideDays() { return _overrideDays; },
  setOverrideDays(v: number | null) { _overrideDays = v; },
};
