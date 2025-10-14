// store.js - central state management

const store = {
  // État global
  state: {
    user: null,
    username: '',
    totalGold: 0,
    playerPacks: [],   // [{ pack_type_id, name, set_id, image_name, quantity }]
    collection: [],     // [{ card_id, quantity }]
    packTypes: []       // [{ id, name, set_id, image_name, card_count, require_* }]
  },

  // Ensemble de callbacks abonnés
  listeners: new Set(),

  /**
   * Récupère une valeur du state.
   */
  get(key) {
    return this.state[key];
  },

  /**
   * Met à jour le state avec les propriétés de `changes`,
   * puis notifie tous les abonnés.
   */
  set(changes) {
    Object.assign(this.state, changes);
    this.notify();
  },

  /**
   * Abonne un callback qui sera appelé à chaque mise à jour de state.
   * Le callback est appelé **immédiatement** avec l'état courant.
   * Renvoie une fonction pour se désabonner.
   */
  subscribe(fn) {
    // Appel immédiat avec l'état actuel
    fn(this.state);
    this.listeners.add(fn);
    // Retourne l'unsubscribe
    return () => this.listeners.delete(fn);
  },

  /**
   * Notifie tous les abonnés avec l'état courant.
   */
  notify() {
    for (const fn of this.listeners) {
      try {
        fn(this.state);
      } catch (e) {
        console.error('Store listener error', e);
      }
    }
  }
};

export default store;
