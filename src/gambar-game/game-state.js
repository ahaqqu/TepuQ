let state = {
  currentMode: null,
  currentObjectId: null,
  lastInteractionTime: 0,
  burstActive: false,
  burstObjectId: null,
  burstTimer: null,
  autoSmashTimer: null,
  targetTransitionTimer: null,
  shufflePool: [],
};

export function getState() {
  return state;
}

export function setState(patch) {
  state = { ...state, ...patch };
}

export function resetGameState() {
  state = {
    currentMode: null,
    currentObjectId: null,
    lastInteractionTime: 0,
    burstActive: false,
    burstObjectId: null,
    burstTimer: null,
    autoSmashTimer: null,
    targetTransitionTimer: null,
    shufflePool: [],
  };
}
