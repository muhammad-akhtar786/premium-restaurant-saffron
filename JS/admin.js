(function () {
  const ADMIN_SESSION_KEY = "saffronAdminSession";
  const DEMO_USERNAME = "admin";
  const DEMO_PASSWORD = "admin123";
  const ORDER_STATUSES = ["New", "Confirmed", "Preparing", "Completed", "Cancelled"];
  const RESERVATION_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];

  let orders = [];
  let reservations = [];
  let menuItems = [];
  let unsubscribeOrders = null;
  let unsubscribeReservations = null;
  let unsubscribeMenu = null;

  const loginView = document.getElementById("adminLoginView");
  const dashboardView = document.getElementById("adminDashboardView");
  const loginForm = document.getElementById("adminLoginForm");
  const loginError = document.getElementById("adminLoginError");
  const logoutButton = document.getElementById("adminLogoutBtn");
  const modeLabel = document.getElementById("adminModeLabel");
  const statsGrid = document.getElementById("adminStatsGrid");
  const ordersTableBody = document.getElementById("ordersTableBody");
  const reservationsTableBody = document.getElementById("reservationsTableBody");
  const menuTableBody = document.getElementById("menuTableBody");
  const menuForm = document.getElementById("menuItemForm");
  const menuFormTitle = document.getElementById("menuFormTitle");
  const resetMenuFormButton = document.getElementById("resetMenuFormBtn");
  const orderSearch = document.getElementById("orderSearch");
  const orderStatusFilter = document.getElementById("orderStatusFilter");

  function isLoggedIn() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  }

  function setLoggedIn(value) {
    if (value) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  function formatCurrency(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getTodayKey() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
  }

  function renderModeLabel() {
    if (!modeLabel || !window.SaffronStore) {
      return;
    }

    modeLabel.textContent = window.SaffronStore.isDemoMode()
      ? "Demo mode: data is saved in this browser"
      : "Firebase Firestore connected";
  }

  function toggleViews() {
    const loggedIn = isLoggedIn();
    loginView.hidden = loggedIn;
    dashboardView.hidden = !loggedIn;

    if (loggedIn) {
      startSubscriptions();
    }
  }

  function renderStats() {
    if (!statsGrid) {
      return;
    }

    const today = getTodayKey();
    const totalRevenue = orders
      .filter(order => order.status !== "Cancelled")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingOrders = orders.filter(order => order.status === "New").length;
    const todayReservations = reservations.filter(reservation => reservation.date === today).length;

    const stats = [
      ["Total Orders", orders.length, "fa-bag-shopping"],
      ["Total Reservations", reservations.length, "fa-calendar-check"],
      ["Total Revenue", formatCurrency(totalRevenue), "fa-chart-line"],
      ["Total Menu Items", menuItems.length, "fa-utensils"],
      ["Pending Orders", pendingOrders, "fa-clock"],
      ["Today’s Reservations", todayReservations, "fa-users"]
    ];

    statsGrid.innerHTML = stats.map(([label, value, icon]) => `
      <article class="admin-stat-card">
        <i class="fa-solid ${icon}"></i>
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `).join("");
  }

  function statusOptions(statuses, selectedStatus) {
    return statuses.map(status => `
      <option value="${escapeHtml(status)}" ${status === selectedStatus ? "selected" : ""}>${escapeHtml(status)}</option>
    `).join("");
  }

  function renderOrders() {
    if (!ordersTableBody) {
      return;
    }

    const query = (orderSearch?.value || "").trim().toLowerCase();
    const status = orderStatusFilter?.value || "all";
    const filteredOrders = orders.filter(order => {
      const matchesStatus = status === "all" || order.status === status;
      const source = `${order.id} ${order.customerName} ${order.customerPhone} ${order.customerAddress} ${order.method}`.toLowerCase();
      return matchesStatus && (!query || source.includes(query));
    });

    if (!filteredOrders.length) {
      ordersTableBody.innerHTML = `<tr><td colspan="9" class="admin-empty-cell">No matching orders yet.</td></tr>`;
      return;
    }

    ordersTableBody.innerHTML = filteredOrders.map(order => {
      const items = (order.items || []).map(item => `${item.name} x${item.quantity}`).join(", ");

      return `
        <tr>
          <td><strong>${escapeHtml(order.id)}</strong><small>${formatDateTime(order.createdAt)}</small></td>
          <td>${escapeHtml(order.customerName)}<small>${escapeHtml(order.customerPhone)}</small></td>
          <td>${escapeHtml(order.customerAddress)}</td>
          <td>${escapeHtml(items)}</td>
          <td>${formatCurrency(order.subtotal)}<small>Delivery ${formatCurrency(order.delivery)} · Tax ${formatCurrency(order.tax)}</small></td>
          <td><strong>${formatCurrency(order.total)}</strong><small>${escapeHtml(order.method)}</small></td>
          <td>${escapeHtml(order.customerNote || "—")}</td>
          <td>
            <select class="admin-select" data-order-status="${escapeHtml(order.id)}">
              ${statusOptions(ORDER_STATUSES, order.status)}
            </select>
          </td>
          <td><button type="button" class="admin-icon-btn danger" data-delete-order="${escapeHtml(order.id)}" aria-label="Delete order"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `;
    }).join("");
  }

  function renderReservations() {
    if (!reservationsTableBody) {
      return;
    }

    if (!reservations.length) {
      reservationsTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty-cell">No reservations yet.</td></tr>`;
      return;
    }

    reservationsTableBody.innerHTML = reservations.map(reservation => `
      <tr>
        <td><strong>${escapeHtml(reservation.id)}</strong><small>${formatDateTime(reservation.createdAt)}</small></td>
        <td>${escapeHtml(reservation.customerName)}<small>${escapeHtml(reservation.phone)}</small></td>
        <td>${escapeHtml(reservation.email || "—")}</td>
        <td>${escapeHtml(reservation.date)}<small>${escapeHtml(reservation.time)}</small></td>
        <td>${escapeHtml(reservation.guests)}</td>
        <td>${escapeHtml(reservation.note || "—")}</td>
        <td>
          <select class="admin-select" data-reservation-status="${escapeHtml(reservation.id)}">
            ${statusOptions(RESERVATION_STATUSES, reservation.status)}
          </select>
        </td>
        <td><button type="button" class="admin-icon-btn danger" data-delete-reservation="${escapeHtml(reservation.id)}" aria-label="Delete reservation"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join("");
  }

  function renderMenuTable() {
    if (!menuTableBody) {
      return;
    }

    if (!menuItems.length) {
      menuTableBody.innerHTML = `<tr><td colspan="8" class="admin-empty-cell">No menu items yet.</td></tr>`;
      return;
    }

    menuTableBody.innerHTML = menuItems.map(item => `
      <tr>
        <td><img class="admin-menu-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" /></td>
        <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></td>
        <td>${escapeHtml(item.category)}</td>
        <td>${formatCurrency(item.price)}</td>
        <td>${escapeHtml(item.badge || "—")}</td>
        <td>${item.halal ? "Halal" : "No badge"}</td>
        <td>
          <button type="button" class="admin-status-pill ${item.available ? "success" : "muted"}" data-toggle-availability="${escapeHtml(item.id)}">
            ${item.available ? "Available" : "Unavailable"}
          </button>
        </td>
        <td>
          <div class="admin-table-actions">
            <button type="button" class="admin-icon-btn" data-edit-menu="${escapeHtml(item.id)}" aria-label="Edit menu item"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="admin-icon-btn danger" data-delete-menu="${escapeHtml(item.id)}" aria-label="Delete menu item"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderAll() {
    renderStats();
    renderOrders();
    renderReservations();
    renderMenuTable();
    renderModeLabel();
  }

  function startSubscriptions() {
    if (!window.SaffronStore) {
      return;
    }

    if (!unsubscribeOrders) {
      unsubscribeOrders = window.SaffronStore.subscribeOrders(data => {
        orders = data;
        renderAll();
      });
    }

    if (!unsubscribeReservations) {
      unsubscribeReservations = window.SaffronStore.subscribeReservations(data => {
        reservations = data;
        renderAll();
      });
    }

    if (!unsubscribeMenu) {
      unsubscribeMenu = window.SaffronStore.subscribeMenuItems(data => {
        menuItems = data;
        renderAll();
      });
    }
  }

  function resetMenuForm() {
    menuForm.reset();
    menuForm.elements.itemId.value = "";
    menuForm.elements.halal.checked = true;
    menuForm.elements.available.checked = true;
    menuFormTitle.textContent = "Add Menu Item";
  }

  function fillMenuForm(item) {
    menuForm.elements.itemId.value = item.id;
    menuForm.elements.name.value = item.name || "";
    menuForm.elements.category.value = item.category || "burgers";
    menuForm.elements.price.value = item.price || "";
    menuForm.elements.image.value = item.image || "";
    menuForm.elements.description.value = item.description || "";
    menuForm.elements.rating.value = item.rating || "";
    menuForm.elements.badge.value = item.badge || "";
    menuForm.elements.halal.checked = item.halal !== false;
    menuForm.elements.available.checked = item.available !== false;
    menuFormTitle.textContent = "Edit Menu Item";
    menuForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleMenuSubmit(event) {
    event.preventDefault();

    const formData = new FormData(menuForm);
    const item = {
      id: formData.get("itemId") || undefined,
      name: formData.get("name"),
      category: formData.get("category"),
      price: formData.get("price"),
      image: formData.get("image"),
      description: formData.get("description"),
      rating: formData.get("rating"),
      badge: formData.get("badge"),
      halal: formData.get("halal") === "on",
      available: formData.get("available") === "on"
    };

    await window.SaffronStore.saveMenuItem(item);
    resetMenuForm();
  }

  function bindEvents() {
    loginForm?.addEventListener("submit", event => {
      event.preventDefault();
      const username = loginForm.elements.username.value.trim();
      const password = loginForm.elements.password.value.trim();

      if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
        setLoggedIn(true);
        loginError.hidden = true;
        toggleViews();
      } else {
        loginError.hidden = false;
      }
    });

    logoutButton?.addEventListener("click", () => {
      setLoggedIn(false);
      window.location.reload();
    });

    orderSearch?.addEventListener("input", renderOrders);
    orderStatusFilter?.addEventListener("change", renderOrders);
    menuForm?.addEventListener("submit", handleMenuSubmit);
    resetMenuFormButton?.addEventListener("click", resetMenuForm);

    document.addEventListener("change", async event => {
      const orderId = event.target.dataset.orderStatus;
      const reservationId = event.target.dataset.reservationStatus;

      if (orderId) {
        await window.SaffronStore.updateOrderStatus(orderId, event.target.value);
      }

      if (reservationId) {
        await window.SaffronStore.updateReservationStatus(reservationId, event.target.value);
      }
    });

    document.addEventListener("click", async event => {
      const deleteOrderId = event.target.closest("[data-delete-order]")?.dataset.deleteOrder;
      const deleteReservationId = event.target.closest("[data-delete-reservation]")?.dataset.deleteReservation;
      const deleteMenuId = event.target.closest("[data-delete-menu]")?.dataset.deleteMenu;
      const editMenuId = event.target.closest("[data-edit-menu]")?.dataset.editMenu;
      const toggleAvailabilityId = event.target.closest("[data-toggle-availability]")?.dataset.toggleAvailability;

      if (deleteOrderId && confirm("Delete this order?")) {
        await window.SaffronStore.deleteOrder(deleteOrderId);
      }

      if (deleteReservationId && confirm("Delete this reservation?")) {
        await window.SaffronStore.deleteReservation(deleteReservationId);
      }

      if (deleteMenuId && confirm("Delete this menu item?")) {
        await window.SaffronStore.deleteMenuItem(deleteMenuId);
      }

      if (editMenuId) {
        const item = menuItems.find(menuItem => String(menuItem.id) === String(editMenuId));
        if (item) {
          fillMenuForm(item);
        }
      }

      if (toggleAvailabilityId) {
        const item = menuItems.find(menuItem => String(menuItem.id) === String(toggleAvailabilityId));
        if (item) {
          await window.SaffronStore.saveMenuItem({ ...item, available: !item.available });
        }
      }
    });
  }

  bindEvents();
  toggleViews();
  resetMenuForm();
  window.addEventListener("saffron-store-ready", () => {
    if (typeof unsubscribeOrders === "function") {
      unsubscribeOrders();
    }

    if (typeof unsubscribeReservations === "function") {
      unsubscribeReservations();
    }

    if (typeof unsubscribeMenu === "function") {
      unsubscribeMenu();
    }

    unsubscribeOrders = null;
    unsubscribeReservations = null;
    unsubscribeMenu = null;
    startSubscriptions();
    renderModeLabel();
  });
})();
