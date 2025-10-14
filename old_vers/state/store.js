const LS_KEY = 'tcg_ui_state';

const initial = {
  cart: { items: {} },
  stats: { boosters_opened: 0, cards_obtained: 0, gold_spent: 0 }
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(initial));
    const obj = JSON.parse(raw);
    obj.cart ||= { items: {} };
    obj.stats ||= { boosters_opened:0, cards_obtained:0, gold_spent:0 };
    obj.cart.items ||= {};
    return obj;
  } catch {
    return JSON.parse(JSON.stringify(initial));
  }
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

const state = load();
const subs = new Set();

export function get(key) { return state[key]; }
export function set(key, value) {
  state[key] = value;
  save();
  subs.forEach(fn => fn(key, value));
}
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

// Cart API
export function cartAdd(pt, qty=1) {
  const id = pt.id;
  const cur = state.cart.items[id]?.qty || 0;
  state.cart.items[id] = { pt, qty: cur + qty };
  save(); subs.forEach(fn => fn('cart', state.cart));
}
export function cartSetQty(ptId, qty) {
  if (qty <= 0) delete state.cart.items[ptId];
  else state.cart.items[ptId] = { pt: state.cart.items[ptId]?.pt, qty };
  save(); subs.forEach(fn => fn('cart', state.cart));
}
export function cartRemove(ptId) { delete state.cart.items[ptId]; save(); subs.forEach(fn => fn('cart', state.cart)); }
export function cartClear() { state.cart.items = {}; save(); subs.forEach(fn => fn('cart', state.cart)); }
export function cartTotal() { let total=0; for (const { pt, qty } of Object.values(state.cart.items)) total += (pt?.price||0)*qty; return total; }
export function cartCount() { let count=0; for (const { qty } of Object.values(state.cart.items)) count += qty; return count; }

// Stats API
export function statsIncBoostersOpened(n=1){ state.stats.boosters_opened += n; save(); subs.forEach(fn=>fn('stats', state.stats)); }
export function statsIncCardsObtained(n=1){ state.stats.cards_obtained += n; save(); subs.forEach(fn=>fn('stats', state.stats)); }
export function statsIncGoldSpent(n=0){ state.stats.gold_spent += n; save(); subs.forEach(fn=>fn('stats', state.stats)); }
export function getStats(){ return state.stats; }
