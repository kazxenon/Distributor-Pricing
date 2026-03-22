const STORAGE_KEY = "schlegel-distributors-v1";
const CART_STORAGE_KEY = "schlegel-cart-v1";
const PRICE_DATA_STORAGE_KEY = "schlegel-private-products-v1";
const AUTH_STORAGE_KEY = "schlegel-auth-v1";
const MANAGE_AUTH_STORAGE_KEY = "schlegel-manage-auth-v1";
const APP_PASSWORD = "hweeli87";
const MAX_SEARCH_RESULTS = 15;

const defaultDistributors = [
  { id: "singapore", name: "Singapore Distributor", country: "Singapore", discount: 0 },
  { id: "malaysia", name: "Malaysia Distributor", country: "Malaysia", discount: 0 },
  { id: "thailand", name: "Thailand Distributor", country: "Thailand", discount: 0 },
];

const state = {
  products: loadPrivateProducts(),
  distributors: loadDistributors(),
  selectedDistributorId: "",
  cart: loadCart(),
  cartDistributorId: "",
  authenticated: sessionStorage.getItem(AUTH_STORAGE_KEY) === "ok",
  managementUnlocked: sessionStorage.getItem(MANAGE_AUTH_STORAGE_KEY) === "ok",
};

const elements = {
  authShell: document.querySelector("#authShell"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  authDistributorSelect: document.querySelector("#authDistributorSelect"),
  passwordInput: document.querySelector("#passwordInput"),
  loginMessage: document.querySelector("#loginMessage"),
  priceFileInput: document.querySelector("#priceFileInput"),
  loadPriceFileButton: document.querySelector("#loadPriceFileButton"),
  clearPriceFileButton: document.querySelector("#clearPriceFileButton"),
  priceFileMessage: document.querySelector("#priceFileMessage"),
  distributorSelect: document.querySelector("#distributorSelect"),
  distributorSummary: document.querySelector("#distributorSummary"),
  distributorLockMessage: document.querySelector("#distributorLockMessage"),
  manageLock: document.querySelector("#manageLock"),
  manageBox: document.querySelector("#manageBox"),
  manageUnlockForm: document.querySelector("#manageUnlockForm"),
  managePasswordInput: document.querySelector("#managePasswordInput"),
  manageUnlockMessage: document.querySelector("#manageUnlockMessage"),
  distributorForm: document.querySelector("#distributorForm"),
  editingDistributorId: document.querySelector("#editingDistributorId"),
  distName: document.querySelector("#distName"),
  distCountry: document.querySelector("#distCountry"),
  distDiscount: document.querySelector("#distDiscount"),
  saveDistributorButton: document.querySelector("#saveDistributorButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  distributorList: document.querySelector("#distributorList"),
  searchInput: document.querySelector("#searchInput"),
  quantityInput: document.querySelector("#quantityInput"),
  searchStatus: document.querySelector("#searchStatus"),
  results: document.querySelector("#results"),
  resultTemplate: document.querySelector("#resultTemplate"),
  productCount: document.querySelector("#productCount"),
  discountableCount: document.querySelector("#discountableCount"),
  scaledCount: document.querySelector("#scaledCount"),
  cartSummary: document.querySelector("#cartSummary"),
  cartItems: document.querySelector("#cartItems"),
  clearCartButton: document.querySelector("#clearCartButton"),
  downloadPdfButton: document.querySelector("#downloadPdfButton"),
};

init();

async function init() {
  renderDistributorOptions();
  bindAuth();
  renderPriceFileStatus();
  renderAuthState();
  if (!state.authenticated) {
    return;
  }

  bindEvents();
  initializeSelectedDistributor();
  renderDistributors();
  renderManagementState();
  await loadProducts();
  renderStats();
  renderResults();
  renderCart();
}

function bindAuth() {
  elements.loadPriceFileButton.addEventListener("click", async () => {
    const file = elements.priceFileInput.files?.[0];
    if (!file) {
      elements.priceFileMessage.textContent = "Choose a private Excel or JSON pricing file first.";
      return;
    }

    try {
      const parsed = await parsePrivatePricingFile(file);

      state.products = parsed.products;
      localStorage.setItem(PRICE_DATA_STORAGE_KEY, JSON.stringify(parsed.products));
      if (parsed.distributors.length) {
        state.distributors = parsed.distributors;
        saveDistributors();
      }
      renderDistributorOptions();
      initializeSelectedDistributor();
      renderDistributors();
      renderManagementState();
      elements.priceFileMessage.textContent = parsed.distributors.length
        ? `Loaded ${formatInteger(parsed.products.length)} price rows and ${formatInteger(parsed.distributors.length)} distributors from ${file.name}.`
        : `Loaded ${formatInteger(parsed.products.length)} private price rows from ${file.name}.`;
      renderPriceFileStatus();
    } catch (error) {
      elements.priceFileMessage.textContent = `Could not load pricing file: ${error.message}`;
    }
  });

  elements.clearPriceFileButton.addEventListener("click", () => {
    localStorage.removeItem(PRICE_DATA_STORAGE_KEY);
    state.products = [];
    state.cart = [];
    saveCart();
    elements.priceFileInput.value = "";
    elements.priceFileMessage.textContent = "Cached private pricing cleared.";
    renderPriceFileStatus();
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.products.length) {
      elements.loginMessage.textContent = "Load a private pricing JSON file before logging in.";
      return;
    }

    const enteredPassword = elements.passwordInput.value;
    if (enteredPassword !== APP_PASSWORD) {
      elements.loginMessage.textContent = "Incorrect password.";
      elements.passwordInput.select();
      return;
    }

    state.authenticated = true;
    state.selectedDistributorId = elements.authDistributorSelect.value || state.distributors[0]?.id || "";
    if (!state.cart.length) {
      state.cartDistributorId = state.selectedDistributorId;
    } else if (!state.cartDistributorId) {
      state.cartDistributorId = state.selectedDistributorId;
    }
    sessionStorage.setItem(AUTH_STORAGE_KEY, "ok");
    elements.loginMessage.textContent = "";
    renderAuthState();

    bindEvents();
    renderDistributors();
    renderManagementState();
    await loadProducts();
    renderStats();
    renderResults();
    renderCart();
  });
}

function renderAuthState() {
  elements.authShell.classList.toggle("is-hidden", state.authenticated);
  elements.appShell.classList.toggle("is-hidden", !state.authenticated);
}

function renderPriceFileStatus() {
  if (state.products.length) {
    elements.priceFileMessage.textContent =
      elements.priceFileMessage.textContent || `Private pricing loaded: ${formatInteger(state.products.length)} rows.`;
  }
}

function bindEvents() {
  elements.distributorSelect.addEventListener("change", () => {
    if (!state.managementUnlocked) {
      elements.distributorSelect.value = state.selectedDistributorId;
      return;
    }

    const nextDistributorId = elements.distributorSelect.value;
    if (state.cart.length && state.cartDistributorId && state.cartDistributorId !== nextDistributorId) {
      elements.distributorSelect.value = state.selectedDistributorId;
      alert("Clear the cart before switching to a different distributor.");
      return;
    }

    state.selectedDistributorId = nextDistributorId;
    if (!state.cart.length) {
      state.cartDistributorId = nextDistributorId;
    }
    renderDistributorSummary();
    renderResults();
    renderCart();
  });

  elements.searchInput.addEventListener("input", () => renderResults());
  elements.quantityInput.addEventListener("input", () => renderResults());

  elements.distributorForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const editingId = elements.editingDistributorId.value.trim();
    const distributor = {
      id: editingId || slugify(`${elements.distCountry.value}-${elements.distName.value}`),
      name: elements.distName.value.trim(),
      country: elements.distCountry.value.trim(),
      discount: clamp(Number(elements.distDiscount.value) || 0, 0, 100),
    };

    if (!distributor.name || !distributor.country) {
      return;
    }

    const existingIndex = state.distributors.findIndex((item) => item.id === distributor.id);
    if (existingIndex >= 0) {
      state.distributors[existingIndex] = distributor;
    } else {
      state.distributors.push(distributor);
    }

    saveDistributors();
    renderDistributorOptions();
    renderDistributors(distributor.id);
    renderResults();
    renderCart();
    resetDistributorForm();
  });

  elements.cancelEditButton.addEventListener("click", () => {
    resetDistributorForm();
  });

  elements.distributorList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const { action, distributorId } = actionButton.dataset;
    if (action === "edit") {
      startEditDistributor(distributorId);
      return;
    }

    if (action === "remove") {
      removeDistributor(distributorId);
    }
  });

  elements.results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-to-cart]");
    if (!button) {
      return;
    }

    addToCart(button.dataset.addToCart);
  });

  elements.cartItems.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-cart-action]");
    if (!actionButton) {
      return;
    }

    const { cartAction, typeNumber } = actionButton.dataset;
    if (cartAction === "remove") {
      removeFromCart(typeNumber);
    }
  });

  elements.cartItems.addEventListener("input", (event) => {
    const quantityInput = event.target.closest("[data-cart-quantity]");
    if (!quantityInput) {
      return;
    }

    updateCartQuantity(quantityInput.dataset.cartQuantity, quantityInput.value);
  });

  elements.downloadPdfButton.addEventListener("click", () => {
    downloadCartPdf();
  });

  elements.clearCartButton.addEventListener("click", () => {
    clearCart();
  });

  elements.manageUnlockForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (elements.managePasswordInput.value !== APP_PASSWORD) {
      elements.manageUnlockMessage.textContent = "Incorrect password.";
      elements.managePasswordInput.select();
      return;
    }

    state.managementUnlocked = true;
    sessionStorage.setItem(MANAGE_AUTH_STORAGE_KEY, "ok");
    elements.manageUnlockMessage.textContent = "";
    elements.managePasswordInput.value = "";
    renderManagementState();
  });
}

function renderManagementState() {
  elements.manageLock.classList.toggle("is-hidden", state.managementUnlocked);
  elements.manageBox.classList.toggle("is-hidden", !state.managementUnlocked);
  elements.distributorSelect.disabled = !state.managementUnlocked;
  elements.distributorLockMessage.textContent = state.managementUnlocked
    ? "Distributor selection is unlocked."
    : "Distributor is locked after login. Unlock distributor management to change it.";
}

async function loadProducts() {
  if (!state.products.length) {
    elements.searchStatus.textContent = "No private pricing data loaded.";
  }
}

function loadDistributors() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [...defaultDistributors];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : [...defaultDistributors];
  } catch {
    return [...defaultDistributors];
  }
}

function loadCart() {
  const stored = localStorage.getItem(CART_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadPrivateProducts() {
  const stored = localStorage.getItem(PRICE_DATA_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function parsePrivatePricingFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".json")) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { products: parsed, distributors: [] };
    }

    if (parsed && Array.isArray(parsed.products)) {
      return {
        products: parsed.products,
        distributors: Array.isArray(parsed.distributors) ? parsed.distributors : [],
      };
    }

    throw new Error("JSON pricing file must contain a product array.");
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    if (!window.XLSX) {
      throw new Error("Excel parser library is not available.");
    }

    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Workbook has no sheets.");
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    const distributorsSheetName = workbook.SheetNames.find(
      (sheetName) => sheetName.trim().toLowerCase() === "distributors",
    );
    const distributors = distributorsSheetName
      ? window.XLSX.utils
          .sheet_to_json(workbook.Sheets[distributorsSheetName], { defval: "" })
          .map(mapWorkbookRowToDistributor)
          .filter((distributor) => distributor.id && distributor.name)
      : [];

    return {
      products: rows.map(mapWorkbookRowToProduct).filter((product) => product.typeNumber),
      distributors,
    };
  }

  throw new Error("Unsupported file type. Use .xlsx, .xls, or .json.");
}

function mapWorkbookRowToProduct(row) {
  const scaleBreaks = [];
  for (let index = 1; index <= 4; index += 1) {
    const quantity = parseNumber(row[`Scale quantity ${index}`]);
    const price = parseNumber(row[`Scale price ${index}`]);
    if (quantity && price) {
      scaleBreaks.push({ quantity, price });
    }
  }

  return {
    typeNumber: String(row["Type number"] || "").trim(),
    basePrice: parseNumber(row["Price"]) || 0,
    priceUnit: parseNumber(row["Price unit"]) || 1,
    quantityUnit: String(row["Quantity unit"] || "PCE").trim() || "PCE",
    discountable: String(row["Discountable"] || "").trim().toUpperCase() === "YES",
    scaleBreaks,
    weightPerPiece: parseNumber(row["Weight/pce."]),
    customsTariffNo: String(row["Customs tariff no."] || "").trim(),
    countryOfOrigin: String(row["Country of origin"] || "").trim(),
    regionOfOrigin: String(row["Region of origin"] || "").trim(),
  };
}

function mapWorkbookRowToDistributor(row) {
  const name = String(row["Distributor Name"] || row["Name"] || "").trim();
  const country = String(row["Country"] || "").trim();
  const id =
    String(row["Distributor ID"] || "").trim() ||
    slugify(`${country}-${name}`);

  return {
    id,
    name,
    country,
    discount: clamp(parseNumber(row["Discount"]) || 0, 0, 100),
  };
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const normalized = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(normalized) ? normalized : null;
}

function saveDistributors() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.distributors));
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

function renderDistributorOptions() {
  const options = state.distributors
    .map(
      (distributor) =>
        `<option value="${distributor.id}">${escapeHtml(distributor.country)} - ${escapeHtml(distributor.name)}</option>`,
    )
    .join("");

  elements.authDistributorSelect.innerHTML = options;
  syncAuthDistributorSelect();
}

function syncAuthDistributorSelect() {
  const selectedId = state.selectedDistributorId || state.distributors[0]?.id || "";
  if (selectedId) {
    elements.authDistributorSelect.value = selectedId;
  }
}

function initializeSelectedDistributor() {
  state.selectedDistributorId =
    state.selectedDistributorId ||
    elements.authDistributorSelect.value ||
    state.distributors[0]?.id ||
    "";
  if (!state.cart.length) {
    state.cartDistributorId = state.selectedDistributorId;
  }
}

function renderDistributors(selectedId) {
  if (!state.distributors.length) {
    state.distributors = [...defaultDistributors];
  }

  state.selectedDistributorId = selectedId || state.selectedDistributorId || state.distributors[0].id;
  if (!state.cart.length) {
    state.cartDistributorId = state.selectedDistributorId;
  }
  elements.distributorSelect.innerHTML = state.distributors
    .map(
      (distributor) =>
        `<option value="${distributor.id}" ${
          distributor.id === state.selectedDistributorId ? "selected" : ""
        }>${escapeHtml(distributor.country)} - ${escapeHtml(distributor.name)}</option>`,
    )
    .join("");

  renderDistributorSummary();
  renderDistributorList();
  syncAuthDistributorSelect();
}

function renderDistributorSummary() {
  const distributor = getSelectedDistributor();
  if (!distributor) {
    elements.distributorSummary.textContent = "Add a distributor discount to begin.";
    return;
  }

  elements.distributorSummary.innerHTML =
    `<strong>${escapeHtml(distributor.name)}</strong><br>` +
    `Country: ${escapeHtml(distributor.country)}<br>` +
    `Discount applied to YES items: ${formatPercent(distributor.discount)}`;
}

function renderStats() {
  elements.productCount.textContent = formatInteger(state.products.length);
  elements.discountableCount.textContent = formatInteger(
    state.products.filter((product) => product.discountable).length,
  );
  elements.scaledCount.textContent = formatInteger(
    state.products.filter((product) => product.scaleBreaks.length > 0).length,
  );
}

function renderDistributorList() {
  elements.distributorList.innerHTML = state.distributors
    .map(
      (distributor) => `
        <div class="distributor-item">
          <div>
            <strong>${escapeHtml(distributor.name)}</strong>
            <div class="hint">${escapeHtml(distributor.country)} · ${formatPercent(distributor.discount)} discount</div>
          </div>
          <div class="distributor-actions">
            <button type="button" class="button button-secondary" data-action="edit" data-distributor-id="${escapeHtml(
              distributor.id,
            )}">Edit</button>
            <button type="button" class="button button-danger" data-action="remove" data-distributor-id="${escapeHtml(
              distributor.id,
            )}">Remove</button>
          </div>
        </div>`,
    )
    .join("");
}

function renderResults() {
  if (!state.products.length) {
    elements.results.innerHTML = `<div class="empty-state">Loading products...</div>`;
    return;
  }

  const term = elements.searchInput.value.trim().toLowerCase();
  const quantity = Math.max(1, Math.floor(Number(elements.quantityInput.value) || 1));
  const distributor = getSelectedDistributor();

  const matches = state.products
    .filter((product) => !term || product.typeNumber.toLowerCase().includes(term))
    .slice(0, MAX_SEARCH_RESULTS);

  elements.searchStatus.textContent =
    term && matches.length === MAX_SEARCH_RESULTS
      ? `Showing the first ${MAX_SEARCH_RESULTS} matches. Keep typing to narrow the results.`
      : `${formatInteger(matches.length)} product${matches.length === 1 ? "" : "s"} found`;

  if (!matches.length) {
    elements.results.innerHTML =
      `<div class="empty-state">No products matched that search. Try a shorter or different type number.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const product of matches) {
    fragment.appendChild(buildResultCard(product, quantity, distributor));
  }

  elements.results.replaceChildren(fragment);
}

function buildResultCard(product, quantity, distributor) {
  const card = elements.resultTemplate.content.firstElementChild.cloneNode(true);
  const pricing = calculatePricing(product, quantity, distributor?.discount || 0);
  const priceLabel = product.priceUnit > 1 ? `per ${formatInteger(product.priceUnit)} ${product.quantityUnit}` : `per ${product.quantityUnit}`;

  card.querySelector(".result-title").textContent = product.typeNumber;

  const badge = card.querySelector(".badge");
  badge.textContent = product.discountable ? "Discountable" : "No discount";
  if (!product.discountable) {
    badge.classList.add("no-discount");
  }

  const addToCartButton = card.querySelector(".add-to-cart-button");
  addToCartButton.dataset.addToCart = product.typeNumber;
  addToCartButton.textContent = `Add ${formatInteger(quantity)} to cart`;

  card.querySelector(".applied-price").textContent = `${formatMoney(pricing.appliedPrice)} ${priceLabel}`;
  card.querySelector(".per-piece").textContent = formatMoney(pricing.perPiecePrice);
  card.querySelector(".line-total").textContent = formatMoney(pricing.lineTotal);

  const meta = [
    ["Base price", `${formatMoney(product.basePrice)} ${priceLabel}`],
    ["MOQ", `${formatInteger(product.priceUnit)} ${product.quantityUnit}`],
    ["Quantity entered", `${formatInteger(quantity)} ${product.quantityUnit}`],
    ["Customs tariff no.", product.customsTariffNo || "N/A"],
    ["Country of origin", product.countryOfOrigin || "N/A"],
  ];

  const metaGrid = card.querySelector(".meta-grid");
  metaGrid.innerHTML = meta
    .map(
      ([label, value]) =>
        `<div class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
    )
    .join("");

  const scaleWrap = card.querySelector(".scale-wrap");
  if (product.scaleBreaks.length) {
    scaleWrap.innerHTML =
      `<div class="meta-item"><span>Scale pricing</span><strong>${escapeHtml(
        pricing.scaleSummary,
      )}</strong></div>` +
      product.scaleBreaks
        .map(
          (breakPoint) =>
            `<div class="scale-item"><span>From ${formatInteger(breakPoint.quantity)} ${escapeHtml(
              product.quantityUnit,
            )}</span><strong>${formatMoney(breakPoint.price)} per ${formatInteger(
              product.priceUnit,
            )} ${escapeHtml(product.quantityUnit)}</strong></div>`,
        )
        .join("");
  } else {
    scaleWrap.innerHTML =
      `<div class="meta-item"><span>Scale pricing</span><strong>No scale breaks in workbook</strong></div>`;
  }

  return card;
}

function renderCart() {
  const distributor = getSelectedDistributor();
  const cartProducts = state.cart
    .map((item) => ({ item, product: state.products.find((product) => product.typeNumber === item.typeNumber) }))
    .filter(({ product }) => Boolean(product));

  const totalItems = cartProducts.reduce((sum, { item }) => sum + item.quantity, 0);
  const totalValue = cartProducts.reduce(
    (sum, { item, product }) =>
      sum + calculatePricing(product, item.quantity, distributor?.discount || 0).lineTotal,
    0,
  );

  elements.cartSummary.innerHTML = `
    <div class="cart-summary-card">
      <div>
        <span class="metric-label">Cart items</span>
        <strong>${formatInteger(totalItems)}</strong>
      </div>
      <div>
        <span class="metric-label">Cart total</span>
        <strong>${formatMoney(totalValue)}</strong>
      </div>
    </div>
    <div class="hint">${
      distributor
        ? `Prices in cart use ${escapeHtml(distributor.name)} with ${formatPercent(distributor.discount)} discount.`
        : "Select a distributor to apply pricing."
    }</div>
    <div class="cart-grand-total">
      <span>Total amount</span>
      <strong>${formatMoney(totalValue)}</strong>
    </div>
  `;

  if (!cartProducts.length) {
    elements.cartItems.innerHTML =
      '<div class="empty-state">Your cart is empty. Search for an item and click "Add to cart".</div>';
    return;
  }

  elements.cartItems.innerHTML = cartProducts
    .map(({ item, product }) => buildCartItem(product, item.quantity, distributor))
    .join("");
}

function buildCartItem(product, quantity, distributor) {
  const pricing = calculatePricing(product, quantity, distributor?.discount || 0);
  return `
    <article class="cart-card">
      <div class="cart-item-header">
        <div>
          <strong class="cart-item-title">${escapeHtml(product.typeNumber)}</strong>
          <div class="cart-item-subtitle">${escapeHtml(
            product.discountable ? "Discountable item" : "Non-discountable item",
          )}</div>
        </div>
        <button
          type="button"
          class="button button-danger"
          data-cart-action="remove"
          data-type-number="${escapeHtml(product.typeNumber)}"
        >
          Remove
        </button>
      </div>
      <div class="cart-item-row">
        <span>Quantity</span>
        <div class="cart-item-controls">
          <input
            class="cart-qty-input"
            type="number"
            min="1"
            step="1"
            value="${escapeHtml(String(quantity))}"
            data-cart-quantity="${escapeHtml(product.typeNumber)}"
          />
          <span class="hint">${formatInteger(product.priceUnit)} ${escapeHtml(product.quantityUnit)} MOQ</span>
        </div>
      </div>
      <div class="cart-item-row">
        <span>Applied price</span>
        <strong>${formatMoney(pricing.appliedPrice)} per ${formatInteger(product.priceUnit)} ${escapeHtml(
          product.quantityUnit,
        )}</strong>
      </div>
      <div class="cart-item-row">
        <span>Per piece</span>
        <strong>${formatMoney(pricing.perPiecePrice)}</strong>
      </div>
      <div class="cart-item-row">
        <span>Line total</span>
        <strong>${formatMoney(pricing.lineTotal)}</strong>
      </div>
    </article>
  `;
}

function addToCart(typeNumber) {
  const quantity = Math.max(1, Math.floor(Number(elements.quantityInput.value) || 1));
  const selectedDistributor = getSelectedDistributor();

  if (!selectedDistributor) {
    alert("Select a distributor before adding items to the cart.");
    return;
  }

  if (!state.cartDistributorId) {
    state.cartDistributorId = selectedDistributor.id;
  }

  if (state.cart.length && state.cartDistributorId !== selectedDistributor.id) {
    alert("Clear the cart before adding items for a different distributor.");
    return;
  }

  const existingItem = state.cart.find((item) => item.typeNumber === typeNumber);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    state.cart.push({ typeNumber, quantity });
  }

  saveCart();
  renderCart();
}

function updateCartQuantity(typeNumber, value) {
  const cartItem = state.cart.find((item) => item.typeNumber === typeNumber);
  if (!cartItem) {
    return;
  }

  cartItem.quantity = Math.max(1, Math.floor(Number(value) || 1));
  saveCart();
  renderCart();
}

function removeFromCart(typeNumber) {
  state.cart = state.cart.filter((item) => item.typeNumber !== typeNumber);
  if (!state.cart.length) {
    state.cartDistributorId = state.selectedDistributorId;
  }
  saveCart();
  renderCart();
}

function clearCart() {
  state.cart = [];
  state.cartDistributorId = state.selectedDistributorId;
  saveCart();
  renderCart();
}

function downloadCartPdf() {
  const distributor = getSelectedDistributor();
  const cartProducts = state.cart
    .map((item) => ({ item, product: state.products.find((product) => product.typeNumber === item.typeNumber) }))
    .filter(({ product }) => Boolean(product));

  if (!cartProducts.length) {
    alert("Add at least one item to the cart before exporting a PDF.");
    return;
  }

  const totalValue = cartProducts.reduce(
    (sum, { item, product }) =>
      sum + calculatePricing(product, item.quantity, distributor?.discount || 0).lineTotal,
    0,
  );
  const logoUrl = new URL("./assets/schlegel-logo.webp", window.location.href).href;

  const openedWindow = window.open("", "_blank", "width=980,height=760");
  if (!openedWindow) {
    alert("Please allow pop-ups for this page to export the cart as PDF.");
    return;
  }

  const rows = cartProducts
    .map(({ item, product }, index) => {
      const pricing = calculatePricing(product, item.quantity, distributor?.discount || 0);
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(product.typeNumber)}</td>
          <td>${formatInteger(item.quantity)} ${escapeHtml(product.quantityUnit)}</td>
          <td>${formatMoney(pricing.appliedPrice)} / ${formatInteger(product.priceUnit)} ${escapeHtml(
            product.quantityUnit,
          )}</td>
          <td>${formatMoney(pricing.perPiecePrice)}</td>
          <td>${formatMoney(pricing.lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  const now = new Date();
  const documentTitle = `Distributor Price Cart ${formatDateForFilename(now)}`;
  openedWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(documentTitle)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 32px;
            color: #1f1f1f;
            font-size: 12px;
          }
          .brand {
            margin-bottom: 18px;
          }
          .brand img {
            width: 280px;
            max-width: 100%;
            height: auto;
            display: block;
            margin-bottom: 16px;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 24px;
          }
          .meta {
            margin-bottom: 20px;
            color: #4f4f4f;
            line-height: 1.6;
          }
          .total {
            margin: 18px 0 24px;
            padding: 14px 16px;
            background: #f4ede3;
            border: 1px solid #d7c3aa;
            border-radius: 10px;
            display: inline-block;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #d6d0c8;
            padding: 10px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f4ede3;
          }
          @media print {
            body {
              margin: 16mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="brand">
          <img src="${escapeHtml(logoUrl)}" alt="Schlegel Elektrokontakt logo" />
        </div>
        <h1>Distributor Price</h1>
        <div class="meta">
          Distributor: ${escapeHtml(distributor?.name || "Not selected")}<br />
          Country: ${escapeHtml(distributor?.country || "N/A")}<br />
          Discount: ${formatPercent(distributor?.discount || 0)}<br />
          Generated: ${escapeHtml(formatDateForDisplay(now))}
        </div>
        <div class="total"><strong>Total amount: ${formatMoney(totalValue)}</strong></div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Type number</th>
              <th>Quantity</th>
              <th>Applied price</th>
              <th>Per piece</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  openedWindow.document.close();
  openedWindow.focus();
  openedWindow.print();
}

function calculatePricing(product, quantity, distributorDiscount) {
  const activeScale = [...product.scaleBreaks]
    .sort((left, right) => left.quantity - right.quantity)
    .filter((breakPoint) => breakPoint.quantity > 0 && quantity >= breakPoint.quantity)
    .pop();

  let appliedPrice = activeScale ? activeScale.price : product.basePrice;
  const usedScale = Boolean(activeScale);
  const discountApplied = product.discountable && distributorDiscount > 0;

  if (discountApplied) {
    appliedPrice *= 1 - distributorDiscount / 100;
  }

  const perPiecePrice = appliedPrice / product.priceUnit;
  const lineTotal = perPiecePrice * quantity;

  let ruleLabel = usedScale
    ? `Scale price from ${formatInteger(activeScale.quantity)} ${product.quantityUnit}`
    : "Base workbook price";

  if (discountApplied) {
    ruleLabel += ` + ${formatPercent(distributorDiscount)} distributor discount`;
  } else if (!product.discountable) {
    ruleLabel += " (discount blocked by workbook)";
  }

  return {
    appliedPrice,
    perPiecePrice,
    lineTotal,
    ruleLabel,
    scaleSummary: usedScale
      ? `Quantity qualifies for the ${formatInteger(activeScale.quantity)}+ break`
      : "Entered quantity does not trigger a scale break",
  };
}

function getSelectedDistributor() {
  return state.distributors.find((item) => item.id === state.selectedDistributorId);
}

function startEditDistributor(distributorId) {
  const distributor = state.distributors.find((item) => item.id === distributorId);
  if (!distributor) {
    return;
  }

  elements.editingDistributorId.value = distributor.id;
  elements.distName.value = distributor.name;
  elements.distCountry.value = distributor.country;
  elements.distDiscount.value = String(distributor.discount);
  elements.saveDistributorButton.textContent = "Update distributor";
  elements.cancelEditButton.hidden = false;
  elements.distributorForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function removeDistributor(distributorId) {
  if (state.distributors.length === 1) {
    alert("At least one distributor must remain in the list.");
    return;
  }

  if (state.cart.length && state.cartDistributorId === distributorId) {
    alert("Clear the cart before removing the distributor currently used for cart pricing.");
    return;
  }

  state.distributors = state.distributors.filter((item) => item.id !== distributorId);
  if (!state.distributors.some((item) => item.id === state.selectedDistributorId)) {
    state.selectedDistributorId = state.distributors[0]?.id || "";
    state.cartDistributorId = state.selectedDistributorId;
  }

  saveDistributors();
  renderDistributorOptions();
  renderDistributors();
  renderResults();
  renderCart();
  resetDistributorForm();
}

function resetDistributorForm() {
  elements.distributorForm.reset();
  elements.editingDistributorId.value = "";
  elements.distDiscount.value = "0";
  elements.saveDistributorButton.textContent = "Save distributor";
  elements.cancelEditButton.hidden = true;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value || 0);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatDateForDisplay(value) {
  return new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDateForFilename(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
