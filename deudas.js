// ========================================
// Antojitos La Bendición - Gestión de Deudas
// deudas.js
// ========================================

let debts = [];
let currentDebt = null;

// Esperar a que la DB esté lista
window.addEventListener('dbReady', async () => {
  await loadDebts();
  setupEventListeners();
});

// Cargar deudas
async function loadDebts() {
  debts = await window.db.getActiveDebts();
  renderStats();
  renderDebts();
  renderPaymentsHistory();
}

// Renderizar estadísticas
function renderStats() {
  // Total por cobrar
  const totalRemaining = debts.reduce((sum, debt) => {
    const paid = (debt.payments || []).reduce((p, payment) => p + payment.amount, 0);
    return sum + (debt.amount - paid);
  }, 0);
  document.getElementById('totalDebt').textContent = `$${totalRemaining.toFixed(2)}`;
  
  // Clientes con deuda
  document.getElementById('totalCustomers').textContent = debts.length;
  
  // Deudas vencidas (más de 30 días)
  const now = new Date();
  const overdueCount = debts.filter(debt => {
    const created = new Date(debt.createdAt);
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    return daysDiff > 30;
  }).length;
  document.getElementById('overdueDebts').textContent = overdueCount;
}

// Renderizar deudas
function renderDebts() {
  const list = document.getElementById('debtsList');
  const searchTerm = document.getElementById('searchDebts').value.toLowerCase();
  
  const filtered = debts.filter(debt => 
    debt.customerName.toLowerCase().includes(searchTerm)
  );
  
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No hay deudas activas</div>
        <div class="empty-state-description">
          ${searchTerm ? 'No se encontraron resultados' : 'Las deudas aparecerán aquí'}
        </div>
      </div>
    `;
    return;
  }
  
  // Ordenar por monto restante (mayor a menor)
  filtered.sort((a, b) => {
    const remainingA = a.amount - (a.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remainingB = b.amount - (b.payments || []).reduce((sum, p) => sum + p.amount, 0);
    return remainingB - remainingA;
  });
  
  list.innerHTML = filtered.map(debt => {
    const totalPaid = (debt.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const remaining = debt.amount - totalPaid;
    const percentage = (totalPaid / debt.amount) * 100;
    
    const created = new Date(debt.createdAt);
    const now = new Date();
    const daysDiff = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const isOverdue = daysDiff > 30;
    
    return `
      <div class="list-item ${isOverdue ? 'urgent' : ''}" onclick="showDebtDetail(${debt.id})" style="cursor: pointer;">
        <div class="list-item-header">
          <div style="flex: 1;">
            <div class="list-item-title">${debt.customerName}</div>
            <div class="list-item-subtitle text-muted">Hace ${daysDiff} días</div>
          </div>
          <span class="${isOverdue ? 'text-danger' : 'text-warning'}" style="font-size: 1.125rem; font-weight: 700;">
            $${remaining.toFixed(2)}
          </span>
        </div>
        
        <div class="progress-bar">
          <div class="progress-bar-fill ${percentage < 50 ? 'danger' : percentage < 100 ? 'warning' : 'success'}" 
               style="width: ${percentage}%"></div>
        </div>
        
        <div class="list-item-meta">
          <span class="text-muted">Total: $${debt.amount.toFixed(2)}</span>
          <span class="text-success">Pagado: $${totalPaid.toFixed(2)}</span>
        </div>
        
        <div class="list-item-subtitle text-muted mt-1">${debt.concept}</div>
        
        <div class="list-item-actions">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPaymentModal(${debt.id})">
            Registrar Pago
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar historial de pagos
async function renderPaymentsHistory() {
  const allDebts = await window.db.getAllRecords('debts');
  const allPayments = [];
  
  allDebts.forEach(debt => {
    if (debt.payments && debt.payments.length > 0) {
      debt.payments.forEach(payment => {
        allPayments.push({
          ...payment,
          customerName: debt.customerName,
          debtId: debt.id
        });
      });
    }
  });
  
  // Ordenar por fecha (más reciente primero)
  allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Tomar últimos 10
  const recentPayments = allPayments.slice(0, 10);
  
  const list = document.getElementById('paymentsHistory');
  
  if (recentPayments.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No hay pagos registrados</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = recentPayments.map(payment => {
    const date = new Date(payment.date);
    const dateStr = date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${payment.customerName}</div>
            <div class="list-item-subtitle text-muted">${dateStr}</div>
          </div>
          <span class="text-success" style="font-weight: 700;">+$${payment.amount.toFixed(2)}</span>
        </div>
        ${payment.notes ? `<div class="list-item-subtitle text-muted mt-1">${payment.notes}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Abrir modal de nueva deuda
function openDebtModal() {
  document.getElementById('debtForm').reset();
  document.getElementById('debtModal').classList.add('active');
}

function closeDebtModal() {
  document.getElementById('debtModal').classList.remove('active');
}

// Guardar deuda
async function saveDebtAction() {
  const customerName = document.getElementById('debtCustomer').value.trim();
  const amount = parseFloat(document.getElementById('debtAmount').value);
  const concept = document.getElementById('debtConcept').value.trim();
  const phone = document.getElementById('debtPhone').value.trim();
  
  if (!customerName || !concept || isNaN(amount) || amount <= 0) {
    alert('Por favor completa todos los campos requeridos correctamente');
    return;
  }
  
  const debt = {
    customerName,
    amount,
    concept,
    phone,
    status: 'active',
    payments: [],
    createdAt: new Date().toISOString()
  };
  
  await window.db.addRecord('debts', debt);
  closeDebtModal();
  await loadDebts();
  alert('✓ Deuda registrada correctamente');
}

// Abrir modal de pago
async function openPaymentModal(debtId) {
  currentDebt = await window.db.getRecord('debts', debtId);
  
  const totalPaid = (currentDebt.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = currentDebt.amount - totalPaid;
  
  document.getElementById('paymentCustomer').textContent = currentDebt.customerName;
  document.getElementById('paymentTotal').textContent = `$${currentDebt.amount.toFixed(2)}`;
  document.getElementById('paymentPaid').textContent = `$${totalPaid.toFixed(2)}`;
  document.getElementById('paymentRemaining').textContent = `$${remaining.toFixed(2)}`;
  
  document.getElementById('paymentForm').reset();
  document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
  currentDebt = null;
}

// Botones de pago rápido
function payHalf() {
  const totalPaid = (currentDebt.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = currentDebt.amount - totalPaid;
  const half = remaining / 2;
  document.getElementById('paymentAmount').value = half.toFixed(2);
}

function payAll() {
  const totalPaid = (currentDebt.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = currentDebt.amount - totalPaid;
  document.getElementById('paymentAmount').value = remaining.toFixed(2);
}

// Guardar pago
async function savePaymentAction() {
  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const notes = document.getElementById('paymentNotes').value.trim();
  
  if (isNaN(amount) || amount <= 0) {
    alert('Por favor ingresa un monto válido');
    return;
  }
  
  const totalPaid = (currentDebt.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = currentDebt.amount - totalPaid;
  
  if (amount > remaining) {
    alert(`El monto no puede ser mayor al restante ($${remaining.toFixed(2)})`);
    return;
  }
  
  const payment = {
    amount,
    date: new Date().toISOString(),
    notes
  };
  
  await window.db.addPaymentToDebt(currentDebt.id, payment);
  closePaymentModal();
  await loadDebts();
  alert('✓ Pago registrado correctamente');
}

// Mostrar detalle de deuda
async function showDebtDetail(debtId) {
  const debt = await window.db.getRecord('debts', debtId);
  currentDebt = debt;
  
  const totalPaid = (debt.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const remaining = debt.amount - totalPaid;
  
  const created = new Date(debt.createdAt);
  const createdStr = created.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  
  let paymentsHtml = '';
  if (debt.payments && debt.payments.length > 0) {
    paymentsHtml = `
      <div class="form-section">
        <div class="form-section-header">
          <h4 class="form-section-title">Historial de Pagos</h4>
        </div>
        ${debt.payments.map(payment => {
          const paymentDate = new Date(payment.date);
          const dateStr = paymentDate.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
          return `
            <div class="list-item" style="margin-bottom: 8px;">
              <div class="list-item-header">
                <div>
                  <div class="list-item-subtitle text-muted">${dateStr}</div>
                  ${payment.notes ? `<div class="text-muted" style="font-size: 0.875rem;">${payment.notes}</div>` : ''}
                </div>
                <span class="text-success" style="font-weight: 700;">$${payment.amount.toFixed(2)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  document.getElementById('debtDetailContent').innerHTML = `
    <div class="card" style="margin-bottom: 20px;">
      <div class="card-content">
        <div class="list-item-title" style="font-size: 1.25rem; margin-bottom: 8px;">
          ${debt.customerName}
        </div>
        <div class="list-item-meta">
          <span>Registrada: ${createdStr}</span>
          ${debt.phone ? `<span>Tel: ${debt.phone}</span>` : ''}
        </div>
        <div style="margin: 16px 0;">
          <div class="text-muted" style="margin-bottom: 4px;">Concepto:</div>
          <div>${debt.concept}</div>
        </div>
        <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px;">
          <div>
            <div class="text-muted" style="font-size: 0.875rem;">Total</div>
            <div style="font-size: 1.125rem; font-weight: 700;">$${debt.amount.toFixed(2)}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size: 0.875rem;">Pagado</div>
            <div class="text-success" style="font-size: 1.125rem; font-weight: 700;">$${totalPaid.toFixed(2)}</div>
          </div>
          <div>
            <div class="text-muted" style="font-size: 0.875rem;">Restante</div>
            <div class="text-warning" style="font-size: 1.125rem; font-weight: 700;">$${remaining.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
    
    ${paymentsHtml}
  `;
  
  document.getElementById('debtDetailModal').classList.add('active');
}

function closeDetailModal() {
  document.getElementById('debtDetailModal').classList.remove('active');
  currentDebt = null;
}

// Eliminar deuda
async function deleteDebtAction() {
  if (!currentDebt) return;
  
  if (!confirm(`¿Eliminar la deuda de ${currentDebt.customerName}? Esta acción no se puede deshacer.`)) {
    return;
  }
  
  await window.db.deleteRecord('debts', currentDebt.id);
  closeDetailModal();
  await loadDebts();
  alert('✓ Deuda eliminada');
}

// Event Listeners
function setupEventListeners() {
  // Header
  document.getElementById('btnAddDebt').addEventListener('click', openDebtModal);
  
  // Búsqueda
  document.getElementById('searchDebts').addEventListener('input', renderDebts);
  
  // Modal de deuda
  document.getElementById('closeDebtModal').addEventListener('click', closeDebtModal);
  document.getElementById('cancelDebt').addEventListener('click', closeDebtModal);
  document.getElementById('saveDebt').addEventListener('click', saveDebtAction);
  
  // Modal de pago
  document.getElementById('closePaymentModal').addEventListener('click', closePaymentModal);
  document.getElementById('cancelPayment').addEventListener('click', closePaymentModal);
  document.getElementById('savePayment').addEventListener('click', savePaymentAction);
  document.getElementById('btnPayHalf').addEventListener('click', payHalf);
  document.getElementById('btnPayAll').addEventListener('click', payAll);
  
  // Modal de detalle
  document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
  document.getElementById('closeDetail').addEventListener('click', closeDetailModal);
  document.getElementById('deleteDebt').addEventListener('click', deleteDebtAction);
}

// Funciones globales
window.openPaymentModal = openPaymentModal;
window.showDebtDetail = showDebtDetail;
