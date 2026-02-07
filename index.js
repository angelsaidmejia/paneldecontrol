// ========================================
// Antojitos La Bendición - Panel de Control
// index.js
// ========================================

let currentProduct = null;
let customers = [];
let alarmInterval = null;

// Esperar a que la DB esté lista
window.addEventListener('dbReady', async () => {
  await loadCustomers();
  await loadDashboard();
  setupEventListeners();
  startAlarmCheck();
});

// Cargar clientes guardados
async function loadCustomers() {
  customers = await window.db.getSetting('customers') || [];
}

// Cargar dashboard
async function loadDashboard() {
  await loadPendingOrders();
  await loadCompletedOrders();
  await loadDebtsPreview();
  await loadTodayStats();
}

// Cargar pedidos pendientes
async function loadPendingOrders() {
  const orders = await window.db.getPendingOrders();
  const list = document.getElementById('pendingOrdersList');
  const badge = document.getElementById('pendingCount');
  const total = document.getElementById('pendingTotal');
  
  badge.textContent = orders.length;
  
  if (orders.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No hay pedidos pendientes</div>
        <div class="empty-state-description">Los pedidos aparecerán aquí</div>
      </div>
    `;
    total.textContent = 'Total: $0.00';
    return;
  }
  
  const totalAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  total.textContent = `Total: $${totalAmount.toFixed(2)}`;
  
  list.innerHTML = orders.map(order => {
    const isUrgent = checkIfUrgent(order);
    const deliveryInfo = order.forNow 
      ? '<span class="text-warning">Para Ahorita</span>'
      : `<span>Entrega: ${order.deliveryTime}</span>`;
    
    return `
      <div class="list-item ${isUrgent ? 'urgent' : ''}" data-id="${order.id}">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${order.customerName}</div>
            <div class="list-item-subtitle">${deliveryInfo}</div>
          </div>
        </div>
        <div class="list-item-meta">
          <span><strong>${order.productName}</strong></span>
          ${order.customizations ? `<span>${order.customizations}</span>` : ''}
          ${order.notes ? `<span class="text-muted">Nota: ${order.notes}</span>` : ''}
          <span class="text-success"><strong>$${order.totalPrice.toFixed(2)}</strong></span>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="cancelOrder(${order.id})">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="completeOrderAction(${order.id})">Completar</button>
        </div>
      </div>
    `;
  }).join('');
}

// Verificar si un pedido es urgente
function checkIfUrgent(order) {
  if (order.forNow || !order.deliveryTime) return false;
  
  const now = new Date();
  const [hours, minutes] = order.deliveryTime.split(':');
  const deliveryDate = new Date();
  deliveryDate.setHours(parseInt(hours), parseInt(minutes), 0);
  
  const minutesUntil = (deliveryDate - now) / 1000 / 60;
  return minutesUntil > 0 && minutesUntil <= 30;
}

// Cargar pedidos completados
async function loadCompletedOrders() {
  const orders = await window.db.getCompletedOrders();
  const list = document.getElementById('completedOrdersList');
  const badge = document.getElementById('completedCount');
  const total = document.getElementById('completedTotal');
  
  badge.textContent = orders.length;
  
  if (orders.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No hay pedidos completados hoy</div>
        <div class="empty-state-description">Completa pedidos para verlos aquí</div>
      </div>
    `;
    total.textContent = 'Total ganado: $0.00';
    return;
  }
  
  const totalAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  total.textContent = `Total ganado: $${totalAmount.toFixed(2)}`;
  
  list.innerHTML = orders.map(order => {
    const completedTime = new Date(order.completedAt).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${order.customerName}</div>
            <div class="list-item-subtitle">Completado: ${completedTime}</div>
          </div>
        </div>
        <div class="list-item-meta">
          <span><strong>${order.productName}</strong></span>
          <span class="text-muted">${order.paymentMethod}</span>
          <span class="text-success"><strong>$${order.totalPrice.toFixed(2)}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

// Cargar preview de deudas
async function loadDebtsPreview() {
  const debts = await window.db.getActiveDebts();
  const list = document.getElementById('debtsPreviewList');
  
  if (debts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No hay deudas activas</div>
      </div>
    `;
    return;
  }
  
  // Ordenar por monto y tomar top 3
  const topDebts = debts
    .sort((a, b) => {
      const remainingA = a.amount - (a.payments || []).reduce((sum, p) => sum + p.amount, 0);
      const remainingB = b.amount - (b.payments || []).reduce((sum, p) => sum + p.amount, 0);
      return remainingB - remainingA;
    })
    .slice(0, 3);
  
  list.innerHTML = topDebts.map(debt => {
    const totalPaid = (debt.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remaining = debt.amount - totalPaid;
    
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div class="list-item-title">${debt.customerName}</div>
          <span class="text-warning"><strong>$${remaining.toFixed(2)}</strong></span>
        </div>
        <div class="list-item-subtitle text-muted">${debt.concept}</div>
      </div>
    `;
  }).join('');
}

// Cargar estadísticas del día
async function loadTodayStats() {
  const today = new Date().toISOString().split('T')[0];
  const stats = await window.db.calculateDailyStats(today);
  
  document.getElementById('todayRevenue').textContent = `$${stats.totalRevenue.toFixed(2)}`;
  document.getElementById('todayOrders').textContent = stats.totalOrders;
  
  if (stats.topProducts.length > 0) {
    document.getElementById('topProduct').textContent = stats.topProducts[0].name;
  } else {
    document.getElementById('topProduct').textContent = '-';
  }
}

// Completar pedido
async function completeOrderAction(orderId) {
  if (!confirm('¿Marcar este pedido como completado?')) return;
  
  await window.db.completeOrder(orderId);
  await loadDashboard();
}

// Cancelar pedido
async function cancelOrder(orderId) {
  if (!confirm('¿Estás seguro de cancelar este pedido?')) return;
  
  await window.db.deleteRecord('orders', orderId);
  await loadDashboard();
}

// Terminar el día
async function endDay() {
  if (!confirm('¿Terminar el día? Se guardarán las estadísticas.')) return;
  
  await window.db.endDay();
  alert('✓ Día terminado. Estadísticas guardadas correctamente.');
  await loadDashboard();
}

// Sistema de alarma
function startAlarmCheck() {
  checkUrgentOrders();
  alarmInterval = setInterval(checkUrgentOrders, 60000); // Cada 1 minuto
}

async function checkUrgentOrders() {
  const orders = await window.db.getPendingOrders();
  const urgentOrders = orders.filter(checkIfUrgent);
  
  const fab = document.getElementById('urgentFab');
  const badge = document.getElementById('urgentBadge');
  const alarmSound = document.getElementById('alarmSound');
  
  if (urgentOrders.length > 0) {
    fab.classList.add('visible');
    badge.textContent = urgentOrders.length;
    
    // Reproducir alarma
    alarmSound.volume = 1.0;
    alarmSound.play().catch(() => {});
  } else {
    fab.classList.remove('visible');
    alarmSound.pause();
    alarmSound.currentTime = 0;
  }
}

// Mostrar modal de urgentes
async function showUrgentModal() {
  const orders = await window.db.getPendingOrders();
  const urgentOrders = orders.filter(checkIfUrgent);
  
  const list = document.getElementById('urgentOrdersList');
  list.innerHTML = urgentOrders.map(order => {
    const now = new Date();
    const [hours, minutes] = order.deliveryTime.split(':');
    const deliveryDate = new Date();
    deliveryDate.setHours(parseInt(hours), parseInt(minutes), 0);
    const minutesUntil = Math.round((deliveryDate - now) / 1000 / 60);
    
    return `
      <div class="list-item urgent">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${order.customerName}</div>
            <div class="list-item-subtitle text-danger">
              <strong>⏰ ${minutesUntil} minutos restantes</strong>
            </div>
          </div>
        </div>
        <div class="list-item-meta">
          <span><strong>${order.productName}</strong></span>
          <span>Entrega: ${order.deliveryTime}</span>
          <span class="text-success"><strong>$${order.totalPrice.toFixed(2)}</strong></span>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-primary btn-sm" onclick="completeOrderAction(${order.id}); closeUrgentModal();">
            Completar
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  document.getElementById('urgentModal').classList.add('active');
}

function closeUrgentModal() {
  document.getElementById('urgentModal').classList.remove('active');
}

// Modal de búsqueda de productos
let allProducts = [];
let selectedCategory = 'all';

async function openSearchModal() {
  allProducts = await window.db.getAllRecords('menuItems');
  renderProducts();
  document.getElementById('searchModal').classList.add('active');
  document.getElementById('searchInput').focus();
}

function closeSearchModal() {
  document.getElementById('searchModal').classList.remove('active');
  document.getElementById('searchInput').value = '';
  selectedCategory = 'all';
}

function renderProducts() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  const grid = document.getElementById('productsGrid');
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-title">No se encontraron productos</div>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map(product => `
    <div class="card" style="cursor: pointer; margin: 0;" onclick="selectProduct(${product.id})">
      <div class="card-content">
        <div class="list-item-title">${product.name}</div>
        <div class="list-item-subtitle text-muted">${getCategoryLabel(product.category)}</div>
        <div class="text-success mt-1"><strong>$${product.basePrice.toFixed(2)}</strong></div>
      </div>
    </div>
  `).join('');
}

function getCategoryLabel(category) {
  const labels = {
    desayunos: 'Desayunos',
    antojitos: 'Antojitos',
    guisados: 'Guisados',
    bebidas: 'Bebidas'
  };
  return labels[category] || category;
}

// Seleccionar producto y abrir modal de pedido
async function selectProduct(productId) {
  currentProduct = await window.db.getRecord('menuItems', productId);
  closeSearchModal();
  openOrderModal();
}

// Modal de pedido
function openOrderModal() {
  document.getElementById('orderModalTitle').textContent = `Pedido: ${currentProduct.name}`;
  
  // Limpiar formulario
  document.getElementById('orderForm').reset();
  document.getElementById('customerName').value = '';
  document.getElementById('deliveryTimeGroup').style.display = 'block';
  
  // Mostrar complementos
  const complementsSection = document.getElementById('complementsSection');
  const complementsList = document.getElementById('complementsList');
  
  if (currentProduct.complements && currentProduct.complements.length > 0) {
    complementsSection.style.display = 'block';
    complementsList.innerHTML = currentProduct.complements.map((comp, index) => `
      <div class="form-checkbox">
        <input type="checkbox" id="comp_${index}" data-price="${comp.price}">
        <label for="comp_${index}">${comp.name} (+$${comp.price.toFixed(2)})</label>
      </div>
    `).join('');
  } else {
    complementsSection.style.display = 'none';
  }
  
  // Mostrar opciones
  const optionsSection = document.getElementById('optionsSection');
  const optionsList = document.getElementById('optionsList');
  
  if (currentProduct.options && currentProduct.options.length > 0) {
    optionsSection.style.display = 'block';
    optionsList.innerHTML = currentProduct.options.map((option, optIndex) => `
      <div class="form-group">
        <label class="form-label">${option.name}</label>
        ${option.values.map((value, valIndex) => `
          <div class="form-checkbox">
            <input type="radio" name="option_${optIndex}" id="opt_${optIndex}_${valIndex}" value="${value}">
            <label for="opt_${optIndex}_${valIndex}">${value}</label>
          </div>
        `).join('')}
      </div>
    `).join('');
  } else {
    optionsSection.style.display = 'none';
  }
  
  updateOrderTotal();
  document.getElementById('orderModal').classList.add('active');
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('active');
  currentProduct = null;
}

// Actualizar total del pedido
function updateOrderTotal() {
  if (!currentProduct) return;
  
  let total = currentProduct.basePrice;
  
  // Sumar complementos
  const complementCheckboxes = document.querySelectorAll('[id^="comp_"]:checked');
  complementCheckboxes.forEach(cb => {
    total += parseFloat(cb.dataset.price);
  });
  
  document.getElementById('orderTotal').textContent = `$${total.toFixed(2)}`;
}

// Crear pedido
async function createOrderAction() {
  const customerName = document.getElementById('customerName').value.trim();
  const forNow = document.getElementById('forNow').checked;
  const deliveryTime = document.getElementById('deliveryTime').value;
  const notes = document.getElementById('orderNotes').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;
  
  if (!customerName) {
    alert('Por favor ingresa el nombre del cliente');
    return;
  }
  
  if (!forNow && !deliveryTime) {
    alert('Por favor indica la hora de entrega o marca "Para Ahorita"');
    return;
  }
  
  // Calcular total
  let totalPrice = currentProduct.basePrice;
  const selectedComplements = [];
  
  currentProduct.complements?.forEach((comp, index) => {
    const checkbox = document.getElementById(`comp_${index}`);
    if (checkbox?.checked) {
      selectedComplements.push(comp.name);
      totalPrice += comp.price;
    }
  });
  
  // Obtener opciones seleccionadas
  const selectedOptions = [];
  currentProduct.options?.forEach((option, optIndex) => {
    const selected = document.querySelector(`input[name="option_${optIndex}"]:checked`);
    if (selected) {
      selectedOptions.push(`${option.name}: ${selected.value}`);
    }
  });
  
  // Crear string de personalizaciones
  let customizations = '';
  if (selectedComplements.length > 0) {
    customizations += `Con: ${selectedComplements.join(', ')}`;
  }
  if (selectedOptions.length > 0) {
    if (customizations) customizations += ' | ';
    customizations += selectedOptions.join(', ');
  }
  
  const order = {
    customerName,
    productName: currentProduct.name,
    category: currentProduct.category,
    totalPrice,
    deliveryTime: forNow ? null : deliveryTime,
    forNow,
    notes,
    paymentMethod,
    customizations,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  await window.db.addRecord('orders', order);
  
  // Si es deuda, crear registro de deuda
  if (paymentMethod === 'deuda') {
    const debt = {
      customerName,
      amount: totalPrice,
      concept: `Pedido: ${currentProduct.name}`,
      phone: '',
      status: 'active',
      payments: [],
      createdAt: new Date().toISOString()
    };
    await window.db.addRecord('debts', debt);
  }
  
  closeOrderModal();
  await loadDashboard();
  alert('✓ Pedido creado correctamente');
}

// Autocompletado de clientes
function setupCustomerAutocomplete() {
  const input = document.getElementById('customerName');
  const dropdown = document.getElementById('customerDropdown');
  
  input.addEventListener('input', () => {
    const value = input.value.toLowerCase().trim();
    
    if (value.length < 2) {
      dropdown.classList.remove('active');
      return;
    }
    
    const matches = customers.filter(c => c.toLowerCase().includes(value));
    
    if (matches.length === 0) {
      dropdown.classList.remove('active');
      return;
    }
    
    dropdown.innerHTML = matches.map(customer => `
      <div class="autocomplete-item" onclick="selectCustomer('${customer}')">${customer}</div>
    `).join('');
    
    dropdown.classList.add('active');
  });
  
  // Cerrar al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });
}

function selectCustomer(name) {
  document.getElementById('customerName').value = name;
  document.getElementById('customerDropdown').classList.remove('active');
}

// Guardar cliente
async function saveCustomer() {
  const name = document.getElementById('customerName').value.trim();
  
  if (!name) {
    alert('Ingresa un nombre primero');
    return;
  }
  
  if (customers.includes(name)) {
    alert('Este cliente ya está guardado');
    return;
  }
  
  customers.push(name);
  await window.db.setSetting('customers', customers);
  alert('✓ Cliente guardado');
}

// Modal de gestión de clientes
async function openCustomersModal() {
  await loadCustomers();
  renderCustomersList();
  document.getElementById('customersModal').classList.add('active');
}

function closeCustomersModal() {
  document.getElementById('customersModal').classList.remove('active');
}

function renderCustomersList() {
  const list = document.getElementById('customersList');
  
  if (customers.length === 0) {
    list.innerHTML = '<div class="text-center text-muted">No hay clientes guardados</div>';
    return;
  }
  
  list.innerHTML = customers.map((customer, index) => `
    <div class="list-item" style="margin-bottom: 8px;">
      <div class="flex items-center justify-between">
        <span>${customer}</span>
        <button class="btn-icon-only btn-danger" onclick="deleteCustomer(${index})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

async function addCustomer() {
  const input = document.getElementById('newCustomerName');
  const name = input.value.trim();
  
  if (!name) {
    alert('Ingresa un nombre');
    return;
  }
  
  if (customers.includes(name)) {
    alert('Este cliente ya existe');
    return;
  }
  
  customers.push(name);
  await window.db.setSetting('customers', customers);
  input.value = '';
  renderCustomersList();
}

async function deleteCustomer(index) {
  if (!confirm(`¿Eliminar a ${customers[index]}?`)) return;
  
  customers.splice(index, 1);
  await window.db.setSetting('customers', customers);
  renderCustomersList();
}

// Event Listeners
function setupEventListeners() {
  // Header buttons
  document.getElementById('btnCustomers').addEventListener('click', openCustomersModal);
  document.getElementById('btnSearch').addEventListener('click', openSearchModal);
  
  // Modal de búsqueda
  document.getElementById('closeSearch').addEventListener('click', closeSearchModal);
  document.getElementById('searchInput').addEventListener('input', renderProducts);
  
  // Tabs de categorías
  document.querySelectorAll('#categoryTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#categoryTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedCategory = tab.dataset.category;
      renderProducts();
    });
  });
  
  // Modal de pedido
  document.getElementById('closeOrder').addEventListener('click', closeOrderModal);
  document.getElementById('cancelOrder').addEventListener('click', closeOrderModal);
  document.getElementById('createOrder').addEventListener('click', createOrderAction);
  document.getElementById('btnSaveCustomer').addEventListener('click', saveCustomer);
  
  // For Now checkbox
  document.getElementById('forNow').addEventListener('change', (e) => {
    document.getElementById('deliveryTimeGroup').style.display = e.target.checked ? 'none' : 'block';
  });
  
  // Actualizar total cuando cambian complementos
  document.addEventListener('change', (e) => {
    if (e.target.id?.startsWith('comp_')) {
      updateOrderTotal();
    }
  });
  
  // Autocompletado
  setupCustomerAutocomplete();
  
  // Modal de clientes
  document.getElementById('closeCustomers').addEventListener('click', closeCustomersModal);
  document.getElementById('btnAddCustomer').addEventListener('click', addCustomer);
  
  // Enter para agregar cliente
  document.getElementById('newCustomerName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addCustomer();
  });
  
  // Terminar día
  document.getElementById('btnEndDay').addEventListener('click', endDay);
  
  // FAB urgente
  document.getElementById('urgentFab').addEventListener('click', showUrgentModal);
}

// Funciones globales
window.completeOrderAction = completeOrderAction;
window.cancelOrder = cancelOrder;
window.selectProduct = selectProduct;
window.selectCustomer = selectCustomer;
window.deleteCustomer = deleteCustomer;
window.closeUrgentModal = closeUrgentModal;
