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
  targetStreak: 0, // successful target taps; every 5th celebrates (see logic.js)
  targetCelebration: false, // true during the 5th-tap milestone pause
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
    targetStreak: 0,
    targetCelebration: false,
  };
}
