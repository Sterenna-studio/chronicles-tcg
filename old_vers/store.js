// store.js - central state management
const store = {
  state: {
    user: null,
    username: '',
    totalGold: 0,
    totalPacks: 0,
    collection: [],
    packTypes: []
  },
  listeners: new Set(),
  get(key) {
    return this.state[key];
  },
  set(changes) {
    Object.assign(this.state, changes);
    this.notify();
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  notify() {
    for (const fn of this.listeners) {
      try { fn(this.state); } catch (e) { console.error(e); }
    }
  }
};
export default store;
