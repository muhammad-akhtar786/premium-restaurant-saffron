const CART_KEY = "saffronFlameCart";
const DELIVERY_FEE = 4;
const TAX_RATE = 0.05;
const WHATSAPP_NUMBER = "966557821940";
const BUTTON_FEEDBACK_DURATION = 900;

let toastTimerId = null;
let menuItemsUnsubscribe = null;

function setTextContent(elements, value) {
  [...new Set(elements.filter(Boolean))].forEach(element => {
    element.textContent = value;
  });
}

function normalizeCartItem(item) {
  const price = Number(item?.price) || 0;
  const quantity = Math.max(1, Number.parseInt(item?.quantity, 10) || 1);

  return {
    id: String(item?.id ?? ""),
    name: String(item?.name ?? "Untitled Item"),
    price,
    quantity,
    image: String(item?.image ?? "")
  };
}

function getCart() {
  try {
    const rawCart = JSON.parse(localStorage.getItem(CART_KEY));
    if (!Array.isArray(rawCart)) {
      return [];
    }

    return rawCart
      .map(normalizeCartItem)
      .filter(item => item.id && item.price >= 0);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  const normalizedCart = cart.map(normalizeCartItem);
  localStorage.setItem(CART_KEY, JSON.stringify(normalizedCart));
  refreshCartUI();
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  refreshCartUI();
}

function calculateCartTotals() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const delivery = subtotal > 0 ? DELIVERY_FEE : 0;
  const tax = subtotal > 0 ? subtotal * TAX_RATE : 0;
  const total = subtotal + delivery + tax;

  return {
    count,
    subtotal,
    delivery,
    tax,
    total
  };
}

function formatCurrency(value) {
  return `$${Number(value).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStore() {
  return window.SaffronStore || null;
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function addToCart(item, quantity = 1, trigger = null) {
  const safeQuantity = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const newItem = normalizeCartItem({ ...item, quantity: safeQuantity });
  const cart = getCart();
  const existingItem = cart.find(cartItem => cartItem.id === newItem.id);

  if (existingItem) {
    existingItem.quantity += safeQuantity;
  } else {
    cart.push(newItem);
  }

  saveCart(cart);
  const totals = calculateCartTotals();
  animateAddButton(trigger);
  pulseCartIcon();
  showToast(`${newItem.name} added to cart`, {
    actionHref: "cart.html",
    actionLabel: `View Cart (${totals.count})`
  });
}

function removeFromCart(itemId) {
  const safeId = String(itemId);
  const cart = getCart().filter(item => item.id !== safeId);
  saveCart(cart);
  showToast("Item removed from cart");
}

function updateCartItemQuantity(itemId, newQuantity) {
  const safeId = String(itemId);
  const safeQuantity = Number.parseInt(newQuantity, 10) || 0;

  if (safeQuantity <= 0) {
    removeFromCart(safeId);
    return;
  }

  const cart = getCart();
  const item = cart.find(cartItem => cartItem.id === safeId);

  if (!item) {
    return;
  }

  item.quantity = safeQuantity;
  saveCart(cart);
}

function updateCartCount() {
  const totals = calculateCartTotals();
  setTextContent([
    document.getElementById("cartCount"),
    ...document.querySelectorAll("[data-cart-count]")
  ], totals.count);
}

function pulseCartIcon() {
  document.querySelectorAll(".nav-cart-link, .mobile-checkout-fab").forEach(element => {
    element.classList.remove("cart-pulse");
    void element.offsetWidth;
    element.classList.add("cart-pulse");

    window.setTimeout(() => {
      element.classList.remove("cart-pulse");
    }, 680);
  });
}

function animateAddButton(button) {
  if (!button) {
    return;
  }

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.innerHTML;
  }

  button.classList.add("is-added");
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Added';

  window.setTimeout(() => {
    button.innerHTML = button.dataset.originalLabel;
    button.disabled = false;
    button.classList.remove("is-added");
  }, BUTTON_FEEDBACK_DURATION);
}

function updateMiniCartSummary() {
  const totals = calculateCartTotals();
  setTextContent([
    document.getElementById("miniCartCount"),
    ...document.querySelectorAll("[data-mini-cart-count]")
  ], totals.count);

  setTextContent([
    document.getElementById("miniCartSubtotal"),
    ...document.querySelectorAll("[data-mini-cart-subtotal]")
  ], formatCurrency(totals.subtotal));
}

function updateCartSummaryUI() {
  const totals = calculateCartTotals();
  setTextContent([
    document.getElementById("summaryItemCount"),
    ...document.querySelectorAll("[data-summary-item-count]")
  ], totals.count);

  setTextContent([
    document.getElementById("cartSubtotal"),
    ...document.querySelectorAll("[data-cart-subtotal]")
  ], formatCurrency(totals.subtotal));

  setTextContent([
    document.getElementById("deliveryFee"),
    ...document.querySelectorAll("[data-delivery-fee]")
  ], formatCurrency(totals.delivery));

  setTextContent([
    document.getElementById("taxAmount"),
    ...document.querySelectorAll("[data-tax-amount]")
  ], formatCurrency(totals.tax));

  setTextContent([
    document.getElementById("grandTotal"),
    ...document.querySelectorAll("[data-grand-total]")
  ], formatCurrency(totals.total));
}

function setCheckoutDisabled(isDisabled) {
  [
    document.getElementById("placeOrderBtn"),
    document.getElementById("whatsappOrderBtn"),
    ...document.querySelectorAll("[data-checkout-action]")
  ].filter(Boolean).forEach(button => {
    if (!button) {
      return;
    }

    button.disabled = isDisabled;
    button.style.opacity = isDisabled ? "0.6" : "1";
    button.style.pointerEvents = isDisabled ? "none" : "auto";
  });
}

function syncCheckoutLayout() {
  const hasItems = getCart().length > 0;
  const emptyCartState = document.getElementById("emptyCartState");
  const checkoutDetailsCard = document.getElementById("checkoutDetailsCard");
  const orderMethodCard = document.getElementById("orderMethodCard");
  const mobileOrderBar = document.getElementById("mobileOrderBar");

  document.body.classList.toggle("cart-page-empty", !hasItems);

  if (emptyCartState) {
    emptyCartState.hidden = hasItems;
  }

  if (checkoutDetailsCard) {
    checkoutDetailsCard.hidden = !hasItems;
  }

  if (orderMethodCard) {
    orderMethodCard.hidden = !hasItems;
  }

  if (mobileOrderBar) {
    mobileOrderBar.hidden = !hasItems;
  }

  setCheckoutDisabled(!hasItems);
}

function renderCartItems() {
  const container = document.getElementById("cartItemsContainer");
  if (!container) {
    return;
  }

  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = "";
    syncCheckoutLayout();
    return;
  }

  container.innerHTML = cart.map(item => `
    <article class="cart-item-row">
      <div class="cart-item-image">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
      </div>
      <div class="cart-item-details">
        <h5>${escapeHtml(item.name)}</h5>
        <p>${formatCurrency(item.price)} each</p>
      </div>
      <div class="cart-item-price">${formatCurrency(item.price * item.quantity)}</div>
      <div class="cart-item-qty">
        <button type="button" data-cart-action="decrease" data-item-id="${escapeHtml(item.id)}" aria-label="Decrease ${escapeHtml(item.name)} quantity">
          <i class="fa-solid fa-minus" aria-hidden="true"></i>
        </button>
        <span>${item.quantity}</span>
        <button type="button" data-cart-action="increase" data-item-id="${escapeHtml(item.id)}" aria-label="Increase ${escapeHtml(item.name)} quantity">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
        </button>
      </div>
      <button type="button" class="cart-item-remove" data-cart-action="remove" data-item-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">
        <i class="fa-solid fa-trash"></i>
      </button>
    </article>
  `).join("");

  syncCheckoutLayout();
}

function refreshCartUI() {
  updateCartCount();
  updateMiniCartSummary();
  updateCartSummaryUI();
  renderCartItems();
}

function handleCartContainerClick(event) {
  const actionButton = event.target.closest("[data-cart-action]");
  if (!actionButton) {
    return;
  }

  const itemId = String(actionButton.dataset.itemId || "");
  const cartItem = getCart().find(item => item.id === itemId);

  if (!cartItem) {
    return;
  }

  const action = actionButton.dataset.cartAction;

  if (action === "increase") {
    updateCartItemQuantity(itemId, cartItem.quantity + 1);
  }

  if (action === "decrease") {
    updateCartItemQuantity(itemId, cartItem.quantity - 1);
  }

  if (action === "remove") {
    removeFromCart(itemId);
  }
}

function initCartItemDelegation() {
  const container = document.getElementById("cartItemsContainer");
  if (!container || container.dataset.bound === "true") {
    return;
  }

  container.addEventListener("click", handleCartContainerClick);
  container.dataset.bound = "true";
}

function initMenuSearch() {
  const searchInput = document.getElementById("menuSearch");
  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", filterMenu);
}

function initMenuFilters() {
  const filterButtons = document.querySelectorAll(".filter-btn");

  if (!filterButtons.length) {
    return;
  }

  filterButtons.forEach(button => {
    button.addEventListener("click", () => {
      filterButtons.forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      filterMenu();
    });
  });
}

function renderPublicMenuItems(items = []) {
  const grid = document.getElementById("menuGrid");
  if (!grid) {
    return;
  }

  const availableItems = items.filter(item => item.available !== false);

  if (!availableItems.length) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="no-results-box">
          <i class="fa-solid fa-utensils"></i>
          <h4>No menu items available yet</h4>
          <p>The menu is being refreshed. Please check back soon or message us on WhatsApp.</p>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = availableItems.map(item => {
    const itemId = escapeHtml(item.id);
    const name = escapeHtml(item.name);
    const category = escapeHtml(item.category);
    const price = Number(item.price) || 0;
    const image = escapeHtml(item.image);
    const description = escapeHtml(item.description);
    const badge = escapeHtml(item.badge || "Signature");
    const rating = escapeHtml(item.rating || "4.8");
    const meta = escapeHtml(item.meta || item.badge || "Chef Selection");
    const icon = escapeHtml(item.icon || "fa-utensils");
    const halalBadge = item.halal === false ? "" : '<span class="halal-badge food-halal-badge">Halal</span>';

    return `
      <div class="col-xl-4 col-md-6 menu-item-col" data-category="${category}" data-name="${name}">
        <article class="premium-food-card menu-item-card reveal-up active" data-tilt>
          <div class="premium-food-media">
            <img src="${image}" alt="${name}" loading="lazy" />
            <span class="food-tag">${badge}</span>
            ${halalBadge}
          </div>
          <div class="premium-food-body">
            <div class="menu-item-top">
              <div>
                <h4>${name}</h4>
                <p>${description}</p>
              </div>
              <span class="dish-price">${formatCurrency(price).replace(".00", "")}</span>
            </div>
            <div class="menu-item-meta">
              <span><i class="fa-solid fa-star"></i>${rating} rating</span>
              <span><i class="fa-solid ${icon}"></i>${meta}</span>
            </div>
            <div class="menu-item-actions">
              <div class="qty-selector">
                <button type="button" class="qty-btn minus" aria-label="Decrease quantity">-</button>
                <input type="number" class="qty-input" value="1" min="1" />
                <button type="button" class="qty-btn plus" aria-label="Increase quantity">+</button>
              </div>
              <button class="card-action-btn add-to-cart-with-qty" data-id="${itemId}" data-name="${name}" data-price="${price}" data-image="${image}">
                Add to Cart
              </button>
            </div>
          </div>
        </article>
      </div>
    `;
  }).join("");

  initMenuQuantitySelectors();
  initAddToCartButtons();
  filterMenu();
}

function initDynamicMenu() {
  const grid = document.getElementById("menuGrid");
  if (!grid) {
    return;
  }

  const store = getStore();
  if (!store) {
    filterMenu();
    return;
  }

  if (typeof menuItemsUnsubscribe === "function") {
    menuItemsUnsubscribe();
  }

  grid.innerHTML = `
    <div class="col-12">
      <div class="no-results-box">
        <i class="fa-solid fa-utensils"></i>
        <h4>Loading the menu</h4>
        <p>Preparing today&apos;s dishes and availability.</p>
      </div>
    </div>
  `;

  menuItemsUnsubscribe = store.subscribeMenuItems(renderPublicMenuItems);
}

function filterMenu() {
  const searchInput = document.getElementById("menuSearch");
  if (!searchInput) {
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  const activeFilter = document.querySelector(".filter-btn.active")?.dataset.filter || "all";
  const menuItems = document.querySelectorAll(".menu-item-col");
  const noResults = document.getElementById("noMenuResults");

  let visibleCount = 0;

  menuItems.forEach(item => {
    const category = String(item.dataset.category || "").toLowerCase();
    const name = String(item.dataset.name || "").toLowerCase();
    const searchSource = `${name} ${category} ${item.textContent || ""}`.toLowerCase();
    const matchesFilter = activeFilter === "all" || category === activeFilter;
    const matchesSearch = !query || searchSource.includes(query);
    const isVisible = matchesFilter && matchesSearch;

    item.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
    }
  });

  if (noResults) {
    noResults.hidden = visibleCount !== 0;
  }
}

function sanitizeQuantityInput(input) {
  input.value = Math.max(1, Number.parseInt(input.value, 10) || 1);
}

function initMenuQuantitySelectors() {
  const menuCards = document.querySelectorAll(".menu-item-card");

  menuCards.forEach(card => {
    const input = card.querySelector(".qty-input");
    const minusButton = card.querySelector(".qty-btn.minus");
    const plusButton = card.querySelector(".qty-btn.plus");

    if (!input) {
      return;
    }

    input.addEventListener("change", () => sanitizeQuantityInput(input));
    input.addEventListener("input", () => sanitizeQuantityInput(input));

    if (minusButton) {
      minusButton.addEventListener("click", () => {
        input.value = Math.max(1, (Number.parseInt(input.value, 10) || 1) - 1);
      });
    }

    if (plusButton) {
      plusButton.addEventListener("click", () => {
        input.value = (Number.parseInt(input.value, 10) || 1) + 1;
      });
    }
  });
}

function getItemDataFromTrigger(trigger) {
  return {
    id: String(trigger.dataset.id || ""),
    name: String(trigger.dataset.name || ""),
    price: Number(trigger.dataset.price || 0),
    image: String(trigger.dataset.image || "")
  };
}

function initAddToCartButtons() {
  document.querySelectorAll(".add-to-cart-btn").forEach(button => {
    if (button.dataset.cartBound === "true") {
      return;
    }

    button.addEventListener("click", () => {
      addToCart(getItemDataFromTrigger(button), 1, button);
    });
    button.dataset.cartBound = "true";
  });

  document.querySelectorAll(".add-to-cart-with-qty").forEach(button => {
    if (button.dataset.cartBound === "true") {
      return;
    }

    button.addEventListener("click", () => {
      const card = button.closest(".menu-item-card");
      const quantityInput = card?.querySelector(".qty-input");
      const quantity = Math.max(1, Number.parseInt(quantityInput?.value || "1", 10) || 1);

      addToCart(getItemDataFromTrigger(button), quantity, button);

      if (quantityInput) {
        quantityInput.value = "1";
      }
    });
    button.dataset.cartBound = "true";
  });
}

function getCheckoutFieldValues() {
  return {
    customerName: document.getElementById("customerName")?.value.trim() || "",
    customerPhone: document.getElementById("customerPhone")?.value.trim() || "",
    customerAddress: document.getElementById("customerAddress")?.value.trim() || "",
    customerNote: document.getElementById("customerNote")?.value.trim() || ""
  };
}

function validateCheckoutDetails() {
  const checkoutForm = document.getElementById("checkoutForm");

  if (!checkoutForm || checkoutForm.hidden) {
    return true;
  }

  const { customerName, customerPhone, customerAddress } = getCheckoutFieldValues();

  if (!customerName || !customerPhone || !customerAddress) {
    showToast("Please fill in the delivery details");
    return false;
  }

  return true;
}

function buildOrderRecord(method = "cod") {
  const cart = getCart();
  const totals = calculateCartTotals();
  const { customerName, customerPhone, customerAddress, customerNote } = getCheckoutFieldValues();

  return {
    id: getStore()?.createId ? getStore().createId("ORD") : `ORD-${Date.now()}`,
    customerName,
    customerPhone,
    customerAddress,
    customerNote,
    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.price * item.quantity
    })),
    subtotal: totals.subtotal,
    delivery: totals.delivery,
    tax: totals.tax,
    total: totals.total,
    method,
    status: "New",
    createdAt: new Date().toISOString()
  };
}

async function saveCurrentOrder(method = "cod") {
  const store = getStore();
  const order = buildOrderRecord(method);

  if (!store) {
    return order;
  }

  return store.saveOrder(order);
}

function buildWhatsAppMessage(savedOrder = null) {
  const cart = getCart();
  const totals = calculateCartTotals();
  const { customerName, customerPhone, customerAddress, customerNote } = getCheckoutFieldValues();
  const lines = [
    "Hello Saffron Flame,",
    "I would like to place the following order.",
    "",
    "Customer Details:"
  ];

  if (savedOrder?.id) {
    lines.push(`Order ID: ${savedOrder.id}`);
  }

  if (customerName) {
    lines.push(`Name: ${customerName}`);
  }

  if (customerPhone) {
    lines.push(`Phone: ${customerPhone}`);
  }

  if (customerAddress) {
    lines.push(`Address: ${customerAddress}`);
  }

  lines.push("", "Items:");

  cart.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name} x${item.quantity} - ${formatCurrency(item.price * item.quantity)}`);
  });

  lines.push(
    "",
    `Subtotal: ${formatCurrency(totals.subtotal)}`,
    `Delivery: ${formatCurrency(totals.delivery)}`,
    `Tax: ${formatCurrency(totals.tax)}`,
    `Grand Total: ${formatCurrency(totals.total)}`
  );

  if (customerNote) {
    lines.push("", `Order Note: ${customerNote}`);
  }

  return encodeURIComponent(lines.join("\n"));
}

async function sendWhatsAppOrder() {
  const cart = getCart();

  if (!cart.length) {
    showToast("Your cart is empty");
    return;
  }

  if (!validateCheckoutDetails()) {
    return;
  }

  const savedOrder = await saveCurrentOrder("whatsapp");
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${buildWhatsAppMessage(savedOrder)}`;
  showToast("Opening WhatsApp...");
  window.open(url, "_blank", "noopener");
}

async function placeOrder() {
  const cart = getCart();

  if (!cart.length) {
    showToast("Your cart is empty");
    return;
  }

  if (!validateCheckoutDetails()) {
    return;
  }

  const selectedMethod = document.querySelector('input[name="orderMethod"]:checked')?.value || "cod";

  if (selectedMethod === "whatsapp") {
    sendWhatsAppOrder();
    return;
  }

  await saveCurrentOrder("cod");
  showToast("Order confirmed. Our team will contact you shortly.");

  window.setTimeout(() => {
    document.getElementById("checkoutForm")?.reset();
    clearCart();
    window.location.href = "index.html";
  }, 1400);
}

function showToast(message = "Action completed successfully", options = {}) {
  const toast = document.getElementById("cartToast");
  if (!toast) {
    return;
  }

  const iconClass = options.iconClass || "fa-solid fa-circle-check";
  const metaText = options.meta ? `<small>${escapeHtml(options.meta)}</small>` : "";
  const action = options.actionHref && options.actionLabel
    ? `<a class="toast-action" href="${escapeHtml(options.actionHref)}">${escapeHtml(options.actionLabel)}</a>`
    : "";

  toast.innerHTML = `
    <i class="${escapeHtml(iconClass)}" aria-hidden="true"></i>
    <div class="toast-copy">
      <span>${escapeHtml(message)}</span>
      ${metaText}
    </div>
    ${action}
  `;

  toast.style.display = "flex";

  window.requestAnimationFrame(() => {
    toast.classList.add("is-visible");
    toast.style.opacity = "1";
  });

  if (toastTimerId) {
    clearTimeout(toastTimerId);
  }

  toastTimerId = setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.style.opacity = "0";

    setTimeout(() => {
      toast.style.display = "none";
    }, 220);
  }, 2200);
}

function handleNavbarScroll() {
  const navbar = document.getElementById("mainNavbar");
  if (!navbar) {
    return;
  }

  const updateNavbarState = () => {
    navbar.classList.toggle("scrolled", window.scrollY > 18);
  };

  updateNavbarState();
  window.addEventListener("scroll", updateNavbarState, { passive: true });
}

function initRevealAnimation() {
  const revealItems = document.querySelectorAll(".reveal-up");
  if (!revealItems.length) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    revealItems.forEach(item => item.classList.add("active"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.16
  });

  revealItems.forEach(item => observer.observe(item));
}

function initTiltEffects() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) {
    return;
  }

  document.querySelectorAll("[data-tilt]").forEach(card => {
    let frameId = 0;

    const resetTransform = () => {
      cancelAnimationFrame(frameId);
      card.style.transform = "";
    };

    card.addEventListener("mousemove", event => {
      const bounds = card.getBoundingClientRect();
      const percentX = (event.clientX - bounds.left) / bounds.width;
      const percentY = (event.clientY - bounds.top) / bounds.height;
      const rotateY = (percentX - 0.5) * 8;
      const rotateX = (0.5 - percentY) * 8;

      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });
    });

    card.addEventListener("mouseleave", resetTransform);
    card.addEventListener("blur", resetTransform, true);
  });
}

function syncPaymentMethodCards() {
  document.querySelectorAll(".payment-method-card").forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    card.classList.toggle("active-method", Boolean(radio?.checked));
  });
}

function initPaymentMethodCards() {
  const cards = document.querySelectorAll(".payment-method-card");
  if (!cards.length) {
    return;
  }

  cards.forEach(card => {
    card.addEventListener("click", () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        syncPaymentMethodCards();
      }
    });
  });

  document.querySelectorAll('input[name="orderMethod"]').forEach(radio => {
    radio.addEventListener("change", syncPaymentMethodCards);
  });

  syncPaymentMethodCards();
}

function initCheckoutActions() {
  document.querySelectorAll('[data-checkout-action="place-order"]').forEach(button => {
    button.addEventListener("click", placeOrder);
  });

  document.querySelectorAll('[data-checkout-action="whatsapp"]').forEach(button => {
    button.addEventListener("click", sendWhatsAppOrder);
  });
}

function initMobileNavClose() {
  const collapse = document.getElementById("navbarNav");
  if (!collapse || !window.bootstrap?.Collapse) {
    return;
  }

  collapse.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      if (!collapse.classList.contains("show")) {
        return;
      }

      window.bootstrap.Collapse.getOrCreateInstance(collapse).hide();
    });
  });
}

function initApp() {
  initCartItemDelegation();
  initMenuSearch();
  initMenuFilters();
  initDynamicMenu();
  initMenuQuantitySelectors();
  initAddToCartButtons();
  initCheckoutActions();
  initPaymentMethodCards();
  handleNavbarScroll();
  initRevealAnimation();
  initTiltEffects();
  initMobileNavClose();
  refreshCartUI();
  filterMenu();
}

document.addEventListener("DOMContentLoaded", initApp);
window.addEventListener("storage", refreshCartUI);
window.addEventListener("saffron-store-ready", initDynamicMenu);
