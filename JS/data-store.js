(function () {
  const STORAGE_KEYS = {
    menu: "saffronMenuItems",
    orders: "saffronOrders",
    reservations: "saffronReservations"
  };

  const changeEvents = {
    menu: "saffron-menu-change",
    orders: "saffron-orders-change",
    reservations: "saffron-reservations-change"
  };

  let activeAdapter = null;

  function createId(prefix) {
    const randomPart = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().split("-")[0].toUpperCase()
      : Math.random().toString(16).slice(2, 10).toUpperCase();

    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomPart}`;
  }

  function readCollection(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCollection(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  function emitChange(type) {
    window.dispatchEvent(new CustomEvent(changeEvents[type]));
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeMenuItem(item) {
    return {
      id: String(item?.id || createId("MENU")),
      name: String(item?.name || "Untitled Item").trim(),
      category: String(item?.category || "burgers").trim().toLowerCase(),
      price: toNumber(item?.price),
      image: String(item?.image || "").trim(),
      description: String(item?.description || "").trim(),
      rating: String(item?.rating || "").trim(),
      badge: String(item?.badge || "").trim(),
      meta: String(item?.meta || item?.badge || "Chef Selection").trim(),
      icon: String(item?.icon || "fa-utensils").trim(),
      halal: item?.halal !== false,
      available: item?.available !== false,
      createdAt: item?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeOrder(order) {
    return {
      id: String(order?.id || createId("ORD")),
      customerName: String(order?.customerName || "").trim(),
      customerPhone: String(order?.customerPhone || "").trim(),
      customerAddress: String(order?.customerAddress || "").trim(),
      customerNote: String(order?.customerNote || "").trim(),
      items: Array.isArray(order?.items) ? order.items : [],
      subtotal: toNumber(order?.subtotal),
      delivery: toNumber(order?.delivery),
      tax: toNumber(order?.tax),
      total: toNumber(order?.total),
      method: String(order?.method || "cod"),
      status: String(order?.status || "New"),
      createdAt: order?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeReservation(reservation) {
    return {
      id: String(reservation?.id || createId("RES")),
      customerName: String(reservation?.customerName || "").trim(),
      phone: String(reservation?.phone || "").trim(),
      email: String(reservation?.email || "").trim(),
      date: String(reservation?.date || "").trim(),
      time: String(reservation?.time || "").trim(),
      guests: Math.max(1, Number.parseInt(reservation?.guests, 10) || 1),
      note: String(reservation?.note || "").trim(),
      status: String(reservation?.status || "Pending"),
      createdAt: reservation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function sortNewest(items) {
    return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function sortMenu(items) {
    return [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  function seedMenuIfNeeded() {
    const current = readCollection(STORAGE_KEYS.menu);
    if (current.length) {
      return current;
    }

    const defaults = (window.SAFFRON_DEFAULT_MENU_ITEMS || []).map(normalizeMenuItem);
    writeCollection(STORAGE_KEYS.menu, defaults);
    return defaults;
  }

  function subscribeLocal(type, callback, loader) {
    let isActive = true;

    const run = async () => {
      if (!isActive) {
        return;
      }

      callback(await loader());
    };

    const onStorage = event => {
      if (!event.key || Object.values(STORAGE_KEYS).includes(event.key)) {
        run();
      }
    };

    window.addEventListener(changeEvents[type], run);
    window.addEventListener("storage", onStorage);
    run();

    return () => {
      isActive = false;
      window.removeEventListener(changeEvents[type], run);
      window.removeEventListener("storage", onStorage);
    };
  }

  const localAdapter = {
    mode: "localStorage demo",

    async getMenuItems() {
      return sortMenu(seedMenuIfNeeded().map(normalizeMenuItem));
    },

    async saveMenuItem(item) {
      const normalized = normalizeMenuItem(item);
      const items = seedMenuIfNeeded();
      const existingIndex = items.findIndex(menuItem => String(menuItem.id) === normalized.id);

      if (existingIndex >= 0) {
        items[existingIndex] = { ...items[existingIndex], ...normalized };
      } else {
        items.push(normalized);
      }

      writeCollection(STORAGE_KEYS.menu, items);
      emitChange("menu");
      return normalized;
    },

    async deleteMenuItem(id) {
      writeCollection(STORAGE_KEYS.menu, seedMenuIfNeeded().filter(item => String(item.id) !== String(id)));
      emitChange("menu");
    },

    subscribeMenuItems(callback) {
      return subscribeLocal("menu", callback, this.getMenuItems.bind(this));
    },

    async getOrders() {
      return sortNewest(readCollection(STORAGE_KEYS.orders).map(normalizeOrder));
    },

    async saveOrder(order) {
      const normalized = normalizeOrder(order);
      const orders = readCollection(STORAGE_KEYS.orders);
      const existingIndex = orders.findIndex(item => String(item.id) === normalized.id);

      if (existingIndex >= 0) {
        orders[existingIndex] = { ...orders[existingIndex], ...normalized };
      } else {
        orders.push(normalized);
      }

      writeCollection(STORAGE_KEYS.orders, orders);
      emitChange("orders");
      return normalized;
    },

    async updateOrderStatus(id, status) {
      const orders = readCollection(STORAGE_KEYS.orders);
      const order = orders.find(item => String(item.id) === String(id));
      if (order) {
        order.status = status;
        order.updatedAt = new Date().toISOString();
        writeCollection(STORAGE_KEYS.orders, orders);
        emitChange("orders");
      }
    },

    async deleteOrder(id) {
      writeCollection(STORAGE_KEYS.orders, readCollection(STORAGE_KEYS.orders).filter(order => String(order.id) !== String(id)));
      emitChange("orders");
    },

    subscribeOrders(callback) {
      return subscribeLocal("orders", callback, this.getOrders.bind(this));
    },

    async getReservations() {
      return sortNewest(readCollection(STORAGE_KEYS.reservations).map(normalizeReservation));
    },

    async saveReservation(reservation) {
      const normalized = normalizeReservation(reservation);
      const reservations = readCollection(STORAGE_KEYS.reservations);
      const existingIndex = reservations.findIndex(item => String(item.id) === normalized.id);

      if (existingIndex >= 0) {
        reservations[existingIndex] = { ...reservations[existingIndex], ...normalized };
      } else {
        reservations.push(normalized);
      }

      writeCollection(STORAGE_KEYS.reservations, reservations);
      emitChange("reservations");
      return normalized;
    },

    async updateReservationStatus(id, status) {
      const reservations = readCollection(STORAGE_KEYS.reservations);
      const reservation = reservations.find(item => String(item.id) === String(id));
      if (reservation) {
        reservation.status = status;
        reservation.updatedAt = new Date().toISOString();
        writeCollection(STORAGE_KEYS.reservations, reservations);
        emitChange("reservations");
      }
    },

    async deleteReservation(id) {
      writeCollection(STORAGE_KEYS.reservations, readCollection(STORAGE_KEYS.reservations).filter(reservation => String(reservation.id) !== String(id)));
      emitChange("reservations");
    },

    subscribeReservations(callback) {
      return subscribeLocal("reservations", callback, this.getReservations.bind(this));
    }
  };

  activeAdapter = localAdapter;

  async function callStore(method, fallback, ...args) {
    try {
      return await activeAdapter[method](...args);
    } catch (error) {
      console.warn(`SaffronStore ${method} failed. Falling back to local demo mode.`, error);
      return typeof fallback === "function" ? fallback(...args) : fallback;
    }
  }

  function subscribe(method, localMethod, callback) {
    try {
      if (activeAdapter[method]) {
        return activeAdapter[method](callback);
      }
    } catch (error) {
      console.warn(`SaffronStore ${method} failed. Using local demo listener.`, error);
    }

    return localAdapter[localMethod](callback);
  }

  window.SaffronStore = {
    createId,
    normalizeMenuItem,
    normalizeOrder,
    normalizeReservation,

    isDemoMode() {
      return activeAdapter === localAdapter;
    },

    getModeLabel() {
      return activeAdapter.mode || "Firebase Firestore";
    },

    useRemoteAdapter(adapter) {
      activeAdapter = adapter || localAdapter;
      window.dispatchEvent(new CustomEvent("saffron-store-ready"));
    },

    getMenuItems() {
      return callStore("getMenuItems", localAdapter.getMenuItems.bind(localAdapter));
    },

    saveMenuItem(item) {
      return callStore("saveMenuItem", localAdapter.saveMenuItem.bind(localAdapter), item);
    },

    deleteMenuItem(id) {
      return callStore("deleteMenuItem", localAdapter.deleteMenuItem.bind(localAdapter), id);
    },

    subscribeMenuItems(callback) {
      return subscribe("subscribeMenuItems", "subscribeMenuItems", callback);
    },

    getOrders() {
      return callStore("getOrders", localAdapter.getOrders.bind(localAdapter));
    },

    saveOrder(order) {
      return callStore("saveOrder", localAdapter.saveOrder.bind(localAdapter), order);
    },

    updateOrderStatus(id, status) {
      return callStore("updateOrderStatus", localAdapter.updateOrderStatus.bind(localAdapter), id, status);
    },

    deleteOrder(id) {
      return callStore("deleteOrder", localAdapter.deleteOrder.bind(localAdapter), id);
    },

    subscribeOrders(callback) {
      return subscribe("subscribeOrders", "subscribeOrders", callback);
    },

    getReservations() {
      return callStore("getReservations", localAdapter.getReservations.bind(localAdapter));
    },

    saveReservation(reservation) {
      return callStore("saveReservation", localAdapter.saveReservation.bind(localAdapter), reservation);
    },

    updateReservationStatus(id, status) {
      return callStore("updateReservationStatus", localAdapter.updateReservationStatus.bind(localAdapter), id, status);
    },

    deleteReservation(id) {
      return callStore("deleteReservation", localAdapter.deleteReservation.bind(localAdapter), id);
    },

    subscribeReservations(callback) {
      return subscribe("subscribeReservations", "subscribeReservations", callback);
    }
  };
})();
