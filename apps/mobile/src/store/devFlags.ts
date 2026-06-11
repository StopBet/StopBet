let _simulateOffline = false;

export const devFlags = {
  get simulateOffline() { return _simulateOffline; },
  setSimulateOffline(v: boolean) { _simulateOffline = v; },
};
