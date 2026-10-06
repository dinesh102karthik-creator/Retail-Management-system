/**
 * RetailFlow — Core Application Logic
 * Integrates with the same-origin Express API.
 */

const API_BASE = '/api';

// State Management
const state = {
  currentView: 'dashboard',
  theme: localStorage.getItem('retail_theme') || 'light',
  products: [],
  suppliers: [],
  history: [],
  stats: null,
  isOnline: false
};

// ================= THEME CONTROLLER ================= //
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem('retail_theme', state.theme);
      updateThemeIcon();
      showToast(`Switched to ${state.theme} mode`, 'info');
    });
  }
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }
}

// ================= TOAST SYSTEM ================= //
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ================= NAVIGATION SYSTEM ================= //
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');
  const pageTitle = document.getElementById('page-title');

  const titles = {
    'dashboard': 'Dashboard Overview',
    'products': 'Products Catalog & Inventory',
    'stock-movement': 'Stock Movement & Adjustments',
    'history': 'Inventory Audit Trail & Access Ledger',
    'suppliers': 'Vendor & Supplier Directory',
    'reports': 'Valuation Reports & Exports'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      switchView(view);
    });
  });

  document.getElementById('btn-view-all-alerts')?.addEventListener('click', () => {
    switchView('products');
    document.getElementById('product-filter-status').value = 'Low Stock';
    filterProducts();
  });

  document.getElementById('btn-view-full-history')?.addEventListener('click', () => {
    switchView('history');
  });

  document.getElementById('btn-quick-stock')?.addEventListener('click', () => {
    switchView('stock-movement');
  });
}

function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-view') === viewName);
  });
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });

  const pageTitle = document.getElementById('page-title');
  const titles = {
    'dashboard': 'Dashboard Overview',
    'products': 'Products Catalog & Inventory',
    'stock-movement': 'Stock Movement & Adjustments',
    'history': 'Inventory Audit Trail & Access Ledger',
    'suppliers': 'Vendor & Supplier Directory',
    'reports': 'Valuation Reports & Exports'
  };
  if (pageTitle && titles[viewName]) {
    pageTitle.textContent = titles[viewName];
  }

  // Auto refresh view-specific data
  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'products') loadProducts();
  else if (viewName === 'stock-movement') populateStockSelect();
  else if (viewName === 'history') loadHistory();
  else if (viewName === 'suppliers') loadSuppliers();
  else if (viewName === 'reports') loadReports();
}

// ================= API HEALTH CHECK ================= //
async function checkHealth() {
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');

  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      state.isOnline = true;
      if (dot) {
        dot.style.backgroundColor = 'var(--in-stock-color)';
        dot.style.boxShadow = '0 0 8px var(--in-stock-color)';
      }
      if (text) text.textContent = 'System Connected';
    } else {
      throw new Error('Server offline');
    }
  } catch (err) {
    state.isOnline = false;
    if (dot) {
      dot.style.backgroundColor = 'var(--out-stock-color)';
      dot.style.boxShadow = '0 0 8px var(--out-stock-color)';
    }
    if (text) text.textContent = 'System Offline';
  }
}

// ================= DASHBOARD CONTROLLER ================= //
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    state.stats = data;

    // KPI Cards
    const summary = data.summary;
    document.getElementById('kpi-total-products').textContent = summary.totalProducts;
    document.getElementById('kpi-total-stock').textContent = Number(summary.totalStock).toLocaleString();
    document.getElementById('kpi-in-stock-subtext').textContent = `${summary.inStockCount} items fully stocked`;
    document.getElementById('kpi-low-stock').textContent = summary.lowStockCount;
    document.getElementById('kpi-out-stock').textContent = summary.outOfStockCount;
    document.getElementById('kpi-total-value').textContent = `$${summary.totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-margin-subtext').textContent = `Est. Margin: ${summary.estimatedProfitMargin}% (Cost: $${summary.totalCostValue.toLocaleString()})`;

    // Low Stock Alerts Table
    const lowStockTbody = document.getElementById('low-stock-tbody');
    if (data.lowStockAlerts.length === 0) {
      lowStockTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">🎉 All items are currently healthy and well-stocked!</td></tr>`;
    } else {
      lowStockTbody.innerHTML = data.lowStockAlerts.map(p => {
        const badgeClass = p.quantity === 0 ? 'badge-out-stock' : 'badge-low-stock';
        return `
          <tr>
            <td>
              <div style="font-weight: 600;">${p.name}</div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${p.sku}</div>
            </td>
            <td>${p.category}</td>
            <td style="font-weight: 700; color: ${p.quantity === 0 ? 'var(--out-stock-color)' : 'var(--low-stock-color)'}">${p.quantity}</td>
            <td>${p.minStockAlert}</td>
            <td><span class="badge ${badgeClass}">${p.status}</span></td>
            <td>
              <button class="btn btn-outline btn-sm" onclick="openQuickStockModal('${p._id}', '${p.name.replace(/'/g, "\\'")}', ${p.quantity})">
                + Restock
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Category Distribution Progress Bars
    const catList = document.getElementById('category-progress-list');
    const categories = Object.keys(data.categoryBreakdown);
    if (categories.length === 0) {
      catList.innerHTML = `<div style="text-align:center; padding: 20px;">No categories available</div>`;
    } else {
      const maxStock = Math.max(...categories.map(c => data.categoryBreakdown[c].stock), 1);
      catList.innerHTML = categories.map(cat => {
        const info = data.categoryBreakdown[cat];
        const pct = Math.min(100, Math.round((info.stock / maxStock) * 100));
        return `
          <div class="cat-item">
            <div class="cat-meta">
              <span style="font-weight: 600;">${cat}</span>
              <span style="color: var(--text-muted);">${info.stock} units ($${Number(info.value.toFixed(0)).toLocaleString()})</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Recent History Table
    const recentHistoryTbody = document.getElementById('recent-history-tbody');
    if (data.recentHistory.length === 0) {
      recentHistoryTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No recent history recorded yet.</td></tr>`;
    } else {
      recentHistoryTbody.innerHTML = data.recentHistory.map(h => {
        const timeFormatted = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const deltaClass = h.quantityChanged > 0 ? 'color: var(--in-stock-color); font-weight: 600;' : h.quantityChanged < 0 ? 'color: var(--out-stock-color); font-weight: 600;' : '';
        const deltaSign = h.quantityChanged > 0 ? `+${h.quantityChanged}` : h.quantityChanged;

        return `
          <tr>
            <td style="color: var(--text-muted); font-size: 12px;">${timeFormatted}</td>
            <td><strong>${h.user}</strong></td>
            <td><span class="badge-action ${h.action === 'STOCK_IN' ? 'in' : h.action === 'STOCK_OUT' ? 'out' : ''}">${h.action}</span></td>
            <td>${h.productName}</td>
            <td style="${deltaClass}">${deltaSign}</td>
            <td>${h.newQuantity}</td>
            <td style="color: var(--text-secondary); font-size: 12.5px;">${h.notes || '—'}</td>
          </tr>
        `;
      }).join('');
    }

  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to load dashboard data. Check backend.', 'error');
  }
}

// ================= PRODUCTS CONTROLLER ================= //
async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 30px;">Loading product catalog...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Failed to fetch products');
    state.products = await res.json();
    renderProducts(state.products);
    populateStockSelect();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--out-stock-color); padding: 30px;">Unable to load products. Please check connection.</td></tr>`;
  }
}

function renderProducts(list) {
  const tbody = document.getElementById('products-tbody');
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">
            <span class="icon">🔍</span>
            <p>No products match your filter or search criteria.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(p => {
    let badgeClass = 'badge-in-stock';
    if (p.status === 'Low Stock') badgeClass = 'badge-low-stock';
    else if (p.status === 'Out of Stock') badgeClass = 'badge-out-stock';
    else if (p.status === 'Archived') badgeClass = 'badge-archived';

    return `
      <tr>
        <td><strong style="font-family: monospace; font-size: 13px;">${p.sku}</strong></td>
        <td>
          <div style="font-weight: 600;">${p.name}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${p.location || 'Warehouse'}</div>
        </td>
        <td>${p.category}</td>
        <td><strong>$${Number(p.price).toFixed(2)}</strong></td>
        <td style="color: var(--text-muted);">$${Number(p.costPrice || 0).toFixed(2)}</td>
        <td>
          <span style="font-size: 14.5px; font-weight: 700; ${p.quantity === 0 ? 'color: var(--out-stock-color);' : p.quantity <= p.minStockAlert ? 'color: var(--low-stock-color);' : ''}">${p.quantity}</span>
        </td>
        <td>${p.minStockAlert}</td>
        <td style="font-size: 12.5px;">${p.supplier || '—'}</td>
        <td><span class="badge ${badgeClass}">${p.status}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-outline btn-sm" onclick="openQuickStockModal('${p._id}', '${p.name.replace(/'/g, "\\'")}', ${p.quantity})" title="Quick Stock Movement">⚡</button>
            <button class="btn btn-outline btn-sm" onclick="openEditProductModal('${p._id}')" title="Edit Product">✏️</button>
            <button class="btn btn-outline btn-sm" onclick="deleteProduct('${p._id}', '${p.name.replace(/'/g, "\\'")}')" title="Delete Product" style="color: var(--out-stock-color);">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterProducts() {
  const query = document.getElementById('product-search').value.toLowerCase().trim();
  const category = document.getElementById('product-filter-category').value;
  const status = document.getElementById('product-filter-status').value;

  const filtered = state.products.filter(p => {
    const matchesSearch = !query ||
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.supplier && p.supplier.toLowerCase().includes(query));

    const matchesCategory = category === 'All' || p.category === category;
    const matchesStatus = status === 'All' || p.status === status;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  renderProducts(filtered);
}

// Add / Edit Product Modal Handlers
function openAddProductModal() {
  document.getElementById('modal-product-title').textContent = 'Add New Product';
  document.getElementById('form-product').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('modal-product').classList.add('active');
}

function openEditProductModal(id) {
  const prod = state.products.find(p => p._id === id);
  if (!prod) return;

  document.getElementById('modal-product-title').textContent = `Edit Product: ${prod.sku}`;
  document.getElementById('prod-id').value = prod._id;
  document.getElementById('prod-sku').value = prod.sku;
  document.getElementById('prod-name').value = prod.name;
  document.getElementById('prod-category').value = prod.category;
  document.getElementById('prod-price').value = prod.price;
  document.getElementById('prod-cost').value = prod.costPrice || '';
  document.getElementById('prod-quantity').value = prod.quantity;
  document.getElementById('prod-min-alert').value = prod.minStockAlert;
  document.getElementById('prod-supplier').value = prod.supplier || '';
  document.getElementById('prod-location').value = prod.location || '';
  document.getElementById('prod-barcode').value = prod.barcode || '';

  document.getElementById('modal-product').classList.add('active');
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;

  const payload = {
    sku: document.getElementById('prod-sku').value.trim().toUpperCase(),
    name: document.getElementById('prod-name').value.trim(),
    category: document.getElementById('prod-category').value,
    price: Number(document.getElementById('prod-price').value),
    costPrice: Number(document.getElementById('prod-cost').value) || 0,
    quantity: Number(document.getElementById('prod-quantity').value) || 0,
    minStockAlert: Number(document.getElementById('prod-min-alert').value) || 10,
    supplier: document.getElementById('prod-supplier').value.trim(),
    location: document.getElementById('prod-location').value.trim(),
    barcode: document.getElementById('prod-barcode').value.trim(),
    user: 'Admin'
  };

  try {
    let res;
    if (id) {
      res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Request failed');
    }

    document.getElementById('modal-product').classList.remove('active');
    showToast(id ? 'Product updated successfully' : 'New product created', 'success');
    await loadProducts();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Are you sure you want to remove "${name}" from the inventory? This will be recorded in the audit trail.`)) return;

  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'Admin' })
    });

    if (!res.ok) throw new Error('Failed to delete product');
    showToast(`Removed "${name}" from catalog`, 'success');
    await loadProducts();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= STOCK MOVEMENT CONTROLLER ================= //
function populateStockSelect() {
  const select = document.getElementById('adj-product-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose Product --</option>' +
    state.products.map(p => `
      <option value="${p._id}">${p.sku} — ${p.name} (Current: ${p.quantity} units)</option>
    `).join('');

  if (currentVal) select.value = currentVal;
}

async function handleStockMovementSubmit(e) {
  e.preventDefault();
  const productId = document.getElementById('adj-product-select').value;
  const action = document.getElementById('adj-action-select').value;
  const changeQuantity = Number(document.getElementById('adj-quantity').value);
  const user = document.getElementById('adj-user').value.trim() || 'Admin';
  const reasonPreset = document.getElementById('adj-reason-preset').value;
  const notesText = document.getElementById('adj-notes').value.trim();
  const fullNotes = `[${reasonPreset}] ${notesText}`;

  if (!productId) {
    showToast('Please select a product', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/inventory/stock-adjustment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        action,
        changeQuantity,
        user,
        notes: fullNotes
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Stock adjustment failed');
    }

    showToast(`Successfully processed ${action === 'STOCK_IN' ? 'Stock In' : 'Stock Out'} for ${data.product.name}`, 'success');
    document.getElementById('form-stock-adjustment').reset();
    document.getElementById('adj-user').value = 'Admin';

    await loadProducts();
    await loadDashboard();
    populateStockSelect();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Quick Stock Modal
function openQuickStockModal(id, name, currentQty) {
  document.getElementById('quick-prod-id').value = id;
  document.getElementById('quick-product-summary').innerHTML = `
    <span>${name}</span>
    <span style="float: right; color: var(--primary);">Current on hand: <strong>${currentQty}</strong></span>
  `;
  document.getElementById('quick-qty').value = '';
  document.getElementById('quick-notes').value = '';
  document.getElementById('modal-quick-stock').classList.add('active');
}

async function handleQuickStockModalSubmit(e) {
  e.preventDefault();
  const productId = document.getElementById('quick-prod-id').value;
  const action = document.getElementById('quick-action').value;
  const changeQuantity = Number(document.getElementById('quick-qty').value);
  const notes = document.getElementById('quick-notes').value.trim();

  try {
    const res = await fetch(`${API_BASE}/inventory/stock-adjustment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        action,
        changeQuantity,
        user: 'Admin',
        notes: `Quick Adjustment: ${notes}`
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Quick adjustment failed');

    document.getElementById('modal-quick-stock').classList.remove('active');
    showToast(`Stock updated: ${data.product.name} is now ${data.product.quantity} units`, 'success');
    await loadProducts();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= AUDIT TRAIL / HISTORY CONTROLLER ================= //
async function loadHistory() {
  const tbody = document.getElementById('full-history-tbody');
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 30px;">Loading audit trail...</td></tr>`;

  const action = document.getElementById('history-filter-action')?.value || 'All';
  const search = document.getElementById('history-search')?.value.trim() || '';

  const queryParams = new URLSearchParams();
  if (action && action !== 'All') queryParams.append('action', action);
  if (search) queryParams.append('search', search);

  try {
    const res = await fetch(`${API_BASE}/inventory/history?${queryParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch history');
    state.history = await res.json();
    renderHistory(state.history);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--out-stock-color); padding: 30px;">Error loading audit trail.</td></tr>`;
  }
}

function renderHistory(list) {
  const tbody = document.getElementById('full-history-tbody');
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 30px; color: var(--text-muted);">No audit events matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(h => {
    const date = new Date(h.timestamp);
    const dateFormatted = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const deltaClass = h.quantityChanged > 0 ? 'color: var(--in-stock-color); font-weight: 700;' : h.quantityChanged < 0 ? 'color: var(--out-stock-color); font-weight: 700;' : '';
    const deltaSign = h.quantityChanged > 0 ? `+${h.quantityChanged}` : h.quantityChanged;

    let actionClass = '';
    if (h.action === 'STOCK_IN') actionClass = 'in';
    else if (h.action === 'STOCK_OUT') actionClass = 'out';

    return `
      <tr>
        <td style="font-size: 12px; color: var(--text-muted); font-family: monospace;">${dateFormatted}</td>
        <td><strong>${h.user}</strong></td>
        <td><span class="badge-action ${actionClass}">${h.action}</span></td>
        <td style="font-weight: 600;">${h.productName}</td>
        <td style="font-family: monospace; font-size: 12px;">${h.productSku || '—'}</td>
        <td style="color: var(--text-muted);">${h.previousQuantity}</td>
        <td style="${deltaClass}">${deltaSign}</td>
        <td style="font-weight: 600;">${h.newQuantity}</td>
        <td style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${h.ip}</td>
        <td style="font-size: 12.5px; color: var(--text-secondary); max-width: 250px;">${h.notes || '—'}</td>
      </tr>
    `;
  }).join('');
}

// ================= SUPPLIERS CONTROLLER ================= //
async function loadSuppliers() {
  const tbody = document.getElementById('suppliers-tbody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px;">Loading suppliers...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/suppliers`);
    if (!res.ok) throw new Error('Failed to load suppliers');
    state.suppliers = await res.json();
    renderSuppliers(state.suppliers);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--out-stock-color); padding: 30px;">Failed to load suppliers.</td></tr>`;
  }
}

function renderSuppliers(list) {
  const tbody = document.getElementById('suppliers-tbody');
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: var(--text-muted);">No suppliers registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(s => `
    <tr>
      <td style="font-weight: 700;">${s.name}</td>
      <td>${s.contactPerson || '—'}</td>
      <td><a href="mailto:${s.email}" style="color: var(--primary); text-decoration: none;">${s.email || '—'}</a></td>
      <td>${s.phone || '—'}</td>
      <td>
        ${(s.categories || []).map(c => `<span class="badge" style="background: var(--surface-alt); border: 1px solid var(--border); font-size: 11px;">${c}</span>`).join(' ') || 'General'}
      </td>
      <td><span class="badge ${s.status === 'Active' ? 'badge-in-stock' : 'badge-archived'}">${s.status}</span></td>
      <td style="font-size: 12.5px; color: var(--text-secondary);">${s.address || '—'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="deleteSupplier('${s._id}', '${s.name.replace(/'/g, "\\'")}')" style="color: var(--out-stock-color);">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function handleSupplierFormSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('supp-name').value.trim(),
    contactPerson: document.getElementById('supp-contact').value.trim(),
    email: document.getElementById('supp-email').value.trim(),
    phone: document.getElementById('supp-phone').value.trim(),
    categories: [document.getElementById('supp-category').value],
    address: document.getElementById('supp-address').value.trim(),
    status: 'Active'
  };

  try {
    const res = await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Failed to create supplier');
    document.getElementById('modal-supplier').classList.remove('active');
    document.getElementById('form-supplier').reset();
    showToast('Supplier registered', 'success');
    await loadSuppliers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSupplier(id, name) {
  if (!confirm(`Are you sure you want to remove supplier "${name}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete supplier');
    showToast(`Removed supplier "${name}"`, 'success');
    await loadSuppliers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= REPORTS & EXPORT CONTROLLER ================= //
async function loadReports() {
  const tbody = document.getElementById('valuation-tbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px;">Calculating category valuations...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    const data = await res.json();
    const cats = data.categoryBreakdown;

    const rows = Object.keys(cats).map(c => {
      const info = cats[c];
      return `
        <tr>
          <td style="font-weight: 700;">${c}</td>
          <td>${info.count} active items</td>
          <td style="font-weight: 600;">${info.stock.toLocaleString()} units</td>
          <td style="color: var(--in-stock-color); font-weight: 700;">$${info.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td><span class="badge badge-in-stock">Healthy</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = rows.join('') || `<tr><td colspan="5" style="text-align:center;">No valuation data available.</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--out-stock-color);">Failed to load reports.</td></tr>`;
  }
}

function exportProductsToCSV() {
  if (!state.products || state.products.length === 0) {
    showToast('No products available to export', 'warning');
    return;
  }

  const headers = ['SKU', 'Name', 'Category', 'Price', 'CostPrice', 'Quantity', 'MinStockAlert', 'Supplier', 'Status', 'Barcode', 'Location'];
  const rows = state.products.map(p => [
    `"${p.sku}"`,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.category}"`,
    p.price,
    p.costPrice || 0,
    p.quantity,
    p.minStockAlert,
    `"${(p.supplier || '').replace(/"/g, '""')}"`,
    `"${p.status}"`,
    `"${p.barcode || ''}"`,
    `"${p.location || ''}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `retail_products_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Products catalog exported to CSV', 'success');
}

function exportHistoryToCSV() {
  if (!state.history || state.history.length === 0) {
    showToast('No audit trail available to export', 'warning');
    return;
  }

  const headers = ['Timestamp', 'User', 'Action', 'ProductName', 'ProductSKU', 'PreviousQuantity', 'NewQuantity', 'QuantityChanged', 'IP', 'Notes'];
  const rows = state.history.map(h => [
    `"${h.timestamp}"`,
    `"${h.user}"`,
    `"${h.action}"`,
    `"${(h.productName || '').replace(/"/g, '""')}"`,
    `"${h.productSku || ''}"`,
    h.previousQuantity,
    h.newQuantity,
    h.quantityChanged,
    `"${h.ip}"`,
    `"${(h.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `inventory_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Audit trail exported to CSV', 'success');
}

async function triggerDatabaseReseed() {
  if (!confirm('⚠️ Are you sure you want to restore the catalog? This will reset all current records back to the standard retail catalog!')) return;

  try {
    const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reset failed');

    showToast('Catalog successfully reset to standard inventory!', 'success');
    await loadProducts();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= MODAL CONTROLLER ================= //
function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetModalId = btn.getAttribute('data-close-modal');
      document.getElementById(targetModalId)?.classList.remove('active');
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });

  document.getElementById('btn-new-product')?.addEventListener('click', openAddProductModal);
  document.getElementById('btn-add-product-catalog')?.addEventListener('click', openAddProductModal);
  document.getElementById('form-product')?.addEventListener('submit', handleProductFormSubmit);

  document.getElementById('form-stock-adjustment')?.addEventListener('submit', handleStockMovementSubmit);
  document.getElementById('form-modal-quick-adj')?.addEventListener('submit', handleQuickStockModalSubmit);

  document.getElementById('btn-add-supplier')?.addEventListener('click', () => {
    document.getElementById('modal-supplier')?.classList.add('active');
  });
  document.getElementById('form-supplier')?.addEventListener('submit', handleSupplierFormSubmit);

  // Search & Filters
  document.getElementById('product-search')?.addEventListener('input', filterProducts);
  document.getElementById('product-filter-category')?.addEventListener('change', filterProducts);
  document.getElementById('product-filter-status')?.addEventListener('change', filterProducts);

  document.getElementById('history-search')?.addEventListener('input', loadHistory);
  document.getElementById('history-filter-action')?.addEventListener('change', loadHistory);
  document.getElementById('btn-refresh-history')?.addEventListener('click', loadHistory);

  // CSV Exports
  document.getElementById('btn-export-products-csv')?.addEventListener('click', exportProductsToCSV);
  document.getElementById('btn-report-export-products')?.addEventListener('click', exportProductsToCSV);
  document.getElementById('btn-export-history-csv')?.addEventListener('click', exportHistoryToCSV);
  document.getElementById('btn-report-export-history')?.addEventListener('click', exportHistoryToCSV);

  // Database re-seed
  document.getElementById('btn-reseed-db')?.addEventListener('click', triggerDatabaseReseed);
}

// ================= AUTHENTICATION ================= //
let healthInterval;

async function enterApplication() {
  document.getElementById('auth-screen').hidden = true;
  document.querySelector('.app-container').hidden = false;
  document.getElementById('btn-logout').hidden = false;

  initTheme();
  initNavigation();
  initModals();

  await checkHealth();
  await loadDashboard();
  await loadProducts();

  const reseedCard = document.getElementById('btn-reseed-db')?.closest('.stat-card');
  if (reseedCard) {
    const health = await fetch(`${API_BASE}/health`).then(response => response.json());
    reseedCard.hidden = !health.destructiveSeedEnabled;
  }

  if (!healthInterval) healthInterval = setInterval(checkHealth, 15000);
}

function initAuthentication() {
  const authScreen = document.getElementById('auth-screen');
  const appContainer = document.querySelector('.app-container');
  const loginForm = document.getElementById('form-login');
  const loginError = document.getElementById('login-error');

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('btn-login');
    button.disabled = true;
    loginError.textContent = '';

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('login-username').value,
          password: document.getElementById('login-password').value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Sign-in failed');
      loginForm.reset();
      await enterApplication();
    } catch (error) {
      loginError.textContent = error.message || 'Unable to sign in';
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    const response = await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    if (!response.ok) return;
    if (healthInterval) clearInterval(healthInterval);
    healthInterval = undefined;
    appContainer.hidden = true;
    document.getElementById('btn-logout').hidden = true;
    authScreen.hidden = false;
    document.getElementById('login-password').value = '';
    document.getElementById('login-username').focus();
  });

  fetch(`${API_BASE}/auth/session`)
    .then(response => {
      if (response.ok) return enterApplication();
      authScreen.hidden = false;
      appContainer.hidden = true;
    })
    .catch(() => {
      authScreen.hidden = false;
      appContainer.hidden = true;
      loginError.textContent = 'Unable to connect to the inventory service';
    });
}

// ================= INITIALIZATION ================= //
document.addEventListener('DOMContentLoaded', initAuthentication);
