// ========================================
// Antojitos La Bendición - Estadísticas
// estadisticas.js
// ========================================

let currentPeriod = 'day';
let currentDate = new Date();
let statsData = null;
let charts = {};

// Esperar a que la DB esté lista
window.addEventListener('dbReady', async () => {
  await loadStats();
  setupEventListeners();
});

// Cargar estadísticas
async function loadStats() {
  if (currentPeriod === 'day') {
    await loadDayStats();
  } else if (currentPeriod === 'month') {
    await loadMonthStats();
  } else {
    await loadYearStats();
  }
  
  renderStats();
  renderCharts();
  renderTopProducts();
  renderPaymentMethods();
  renderDetailTable();
}

// Cargar stats de un día
async function loadDayStats() {
  const dateStr = currentDate.toISOString().split('T')[0];
  statsData = await window.db.calculateDailyStats(dateStr);
  
  // Actualizar etiquetas
  const isToday = dateStr === new Date().toISOString().split('T')[0];
  document.getElementById('currentPeriodLabel').textContent = isToday ? 'Hoy' : 'Día Seleccionado';
  document.getElementById('currentDateLabel').textContent = currentDate.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Mostrar gráfica por hora
  document.getElementById('hourlyCard').style.display = 'block';
}

// Cargar stats de un mes
async function loadMonthStats() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Obtener todas las stats del mes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStats = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0];
    const dayStats = await window.db.calculateDailyStats(dateStr);
    monthStats.push(dayStats);
  }
  
  // Consolidar estadísticas del mes
  statsData = consolidateStats(monthStats, 'month');
  
  // Actualizar etiquetas
  document.getElementById('currentPeriodLabel').textContent = currentDate.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric'
  });
  document.getElementById('currentDateLabel').textContent = `${daysInMonth} días`;
  
  // Ocultar gráfica por hora
  document.getElementById('hourlyCard').style.display = 'none';
}

// Cargar stats de un año
async function loadYearStats() {
  const year = currentDate.getFullYear();
  const yearStats = [];
  
  for (let month = 0; month < 12; month++) {
    const monthDate = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayStats = await window.db.calculateDailyStats(dateStr);
      monthData.push(dayStats);
    }
    
    yearStats.push(consolidateStats(monthData, 'month'));
  }
  
  statsData = consolidateStats(yearStats, 'year');
  
  // Actualizar etiquetas
  document.getElementById('currentPeriodLabel').textContent = year.toString();
  document.getElementById('currentDateLabel').textContent = '12 meses';
  
  // Ocultar gráfica por hora
  document.getElementById('hourlyCard').style.display = 'none';
}

// Consolidar estadísticas
function consolidateStats(statsArray, type) {
  const consolidated = {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrder: 0,
    paymentMethods: { efectivo: 0, transferencia: 0, deuda: 0 },
    topProducts: {},
    categorySales: { desayunos: 0, antojitos: 0, guisados: 0, bebidas: 0 },
    hourlySales: new Array(24).fill(0),
    periodData: [] // Para gráfica temporal
  };
  
  statsArray.forEach(stats => {
    consolidated.totalRevenue += stats.totalRevenue;
    consolidated.totalOrders += stats.totalOrders;
    
    // Métodos de pago
    Object.keys(stats.paymentMethods).forEach(method => {
      consolidated.paymentMethods[method] += stats.paymentMethods[method];
    });
    
    // Productos
    stats.topProducts.forEach(product => {
      const key = product.name;
      if (!consolidated.topProducts[key]) {
        consolidated.topProducts[key] = {
          name: product.name,
          count: 0,
          revenue: 0,
          category: product.category
        };
      }
      consolidated.topProducts[key].count += product.count;
      consolidated.topProducts[key].revenue += product.revenue;
    });
    
    // Categorías
    Object.keys(stats.categorySales).forEach(category => {
      consolidated.categorySales[category] += stats.categorySales[category];
    });
    
    // Datos del período
    consolidated.periodData.push(stats.totalRevenue);
  });
  
  // Calcular promedio
  consolidated.averageOrder = consolidated.totalOrders > 0 
    ? consolidated.totalRevenue / consolidated.totalOrders 
    : 0;
  
  // Convertir topProducts a array y ordenar
  consolidated.topProducts = Object.values(consolidated.topProducts)
    .sort((a, b) => b.revenue - a.revenue);
  
  return consolidated;
}

// Renderizar estadísticas principales
function renderStats() {
  document.getElementById('totalRevenue').textContent = `$${statsData.totalRevenue.toFixed(2)}`;
  document.getElementById('totalOrders').textContent = statsData.totalOrders;
  document.getElementById('averageTicket').textContent = `$${statsData.averageOrder.toFixed(2)}`;
}

// Renderizar gráficas
function renderCharts() {
  renderSalesChart();
  renderCategoryChart();
  if (currentPeriod === 'day') {
    renderHourlyChart();
  }
}

// Gráfica de ventas por período
function renderSalesChart() {
  const canvas = document.getElementById('salesChart');
  const ctx = canvas.getContext('2d');
  
  // Destruir gráfica anterior si existe
  if (charts.sales) {
    charts.sales.destroy();
  }
  
  let labels, data;
  
  if (currentPeriod === 'day') {
    labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    data = statsData.hourlySales || new Array(24).fill(0);
  } else if (currentPeriod === 'month') {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    data = statsData.periodData || [];
  } else {
    labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    data = statsData.periodData || new Array(12).fill(0);
  }
  
  charts.sales = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ventas',
        data,
        borderColor: '#4a90e2',
        backgroundColor: 'rgba(74, 144, 226, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#a8b2c1',
            callback: value => `$${value}`
          },
          grid: {
            color: 'rgba(168, 178, 193, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#a8b2c1'
          },
          grid: {
            color: 'rgba(168, 178, 193, 0.1)'
          }
        }
      }
    }
  });
}

// Gráfica de distribución por categoría
function renderCategoryChart() {
  const canvas = document.getElementById('categoryChart');
  const ctx = canvas.getContext('2d');
  
  if (charts.category) {
    charts.category.destroy();
  }
  
  const data = [
    statsData.categorySales.desayunos,
    statsData.categorySales.antojitos,
    statsData.categorySales.guisados,
    statsData.categorySales.bebidas
  ];
  
  charts.category = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Desayunos', 'Antojitos', 'Guisados', 'Bebidas'],
      datasets: [{
        data,
        backgroundColor: ['#f39c12', '#e74c3c', '#2ecc71', '#3498db'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#a8b2c1',
            padding: 15,
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
}

// Gráfica por hora (solo día)
function renderHourlyChart() {
  const canvas = document.getElementById('hourlyChart');
  const ctx = canvas.getContext('2d');
  
  if (charts.hourly) {
    charts.hourly.destroy();
  }
  
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const data = statsData.hourlySales || new Array(24).fill(0);
  
  charts.hourly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ventas por Hora',
        data,
        backgroundColor: '#4a90e2',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#a8b2c1',
            callback: value => `$${value}`
          },
          grid: {
            color: 'rgba(168, 178, 193, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#a8b2c1'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// Renderizar top productos
function renderTopProducts() {
  const list = document.getElementById('topProductsList');
  const topFive = statsData.topProducts.slice(0, 5);
  
  if (topFive.length === 0) {
    list.innerHTML = '<div class="text-center text-muted">No hay datos</div>';
    return;
  }
  
  const maxRevenue = topFive[0].revenue;
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  
  list.innerHTML = topFive.map((product, index) => {
    const percentage = (product.revenue / maxRevenue) * 100;
    
    return `
      <div class="list-item" style="margin-bottom: 12px;">
        <div class="list-item-header">
          <div style="flex: 1;">
            <div class="list-item-title">
              <span style="font-size: 1.25rem; margin-right: 8px;">${medals[index]}</span>
              ${product.name}
            </div>
            <div class="list-item-subtitle text-muted">
              ${product.count} vendidos
            </div>
          </div>
          <span class="text-success" style="font-weight: 700;">
            $${product.revenue.toFixed(2)}
          </span>
        </div>
        <div class="progress-bar" style="margin-top: 8px;">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar métodos de pago
function renderPaymentMethods() {
  const list = document.getElementById('paymentMethodsList');
  const total = statsData.totalRevenue;
  
  if (total === 0) {
    list.innerHTML = '<div class="text-center text-muted">No hay datos</div>';
    return;
  }
  
  const methods = [
    { name: 'Efectivo', amount: statsData.paymentMethods.efectivo, icon: '💵' },
    { name: 'Transferencia', amount: statsData.paymentMethods.transferencia, icon: '💳' },
    { name: 'Deuda', amount: statsData.paymentMethods.deuda, icon: '📝' }
  ];
  
  list.innerHTML = methods.map(method => {
    const percentage = total > 0 ? (method.amount / total) * 100 : 0;
    
    return `
      <div class="list-item" style="margin-bottom: 12px;">
        <div class="list-item-header">
          <div style="flex: 1;">
            <div class="list-item-title">
              <span style="font-size: 1.25rem; margin-right: 8px;">${method.icon}</span>
              ${method.name}
            </div>
            <div class="list-item-subtitle text-muted">
              ${percentage.toFixed(1)}% del total
            </div>
          </div>
          <span class="text-success" style="font-weight: 700;">
            $${method.amount.toFixed(2)}
          </span>
        </div>
        <div class="progress-bar" style="margin-top: 8px;">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar tabla detallada
function renderDetailTable() {
  const table = document.getElementById('detailTable');
  const products = statsData.topProducts;
  
  if (products.length === 0) {
    table.innerHTML = '<div class="text-center text-muted" style="padding: 20px;">No hay datos</div>';
    return;
  }
  
  const total = statsData.totalRevenue;
  
  table.innerHTML = `
    <thead>
      <tr style="border-bottom: 2px solid var(--primary-light);">
        <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Producto</th>
        <th style="padding: 12px; text-align: center; color: var(--text-secondary);">Cantidad</th>
        <th style="padding: 12px; text-align: right; color: var(--text-secondary);">Ingresos</th>
        <th style="padding: 12px; text-align: right; color: var(--text-secondary);">% Total</th>
      </tr>
    </thead>
    <tbody>
      ${products.map(product => {
        const percentage = total > 0 ? (product.revenue / total) * 100 : 0;
        return `
          <tr style="border-bottom: 1px solid var(--primary-light);">
            <td style="padding: 12px;">${product.name}</td>
            <td style="padding: 12px; text-align: center;">${product.count}</td>
            <td style="padding: 12px; text-align: right; color: var(--success); font-weight: 600;">$${product.revenue.toFixed(2)}</td>
            <td style="padding: 12px; text-align: right; color: var(--text-secondary);">${percentage.toFixed(1)}%</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
}

// Exportar a CSV
function exportCSV() {
  const products = statsData.topProducts;
  
  if (products.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  
  const total = statsData.totalRevenue;
  
  let csv = 'Producto,Cantidad,Ingresos,% del Total\n';
  products.forEach(product => {
    const percentage = total > 0 ? (product.revenue / total) * 100 : 0;
    csv += `"${product.name}",${product.count},${product.revenue.toFixed(2)},${percentage.toFixed(1)}%\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  a.href = url;
  a.download = `resumen_${timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  alert('✓ CSV exportado correctamente');
}

// Cambiar período
function changePeriod(period) {
  currentPeriod = period;
  currentDate = new Date();
  loadStats();
}

// Navegar períodos
function navigatePrevious() {
  if (currentPeriod === 'day') {
    currentDate.setDate(currentDate.getDate() - 1);
  } else if (currentPeriod === 'month') {
    currentDate.setMonth(currentDate.getMonth() - 1);
  } else {
    currentDate.setFullYear(currentDate.getFullYear() - 1);
  }
  loadStats();
}

function navigateNext() {
  if (currentPeriod === 'day') {
    currentDate.setDate(currentDate.getDate() + 1);
  } else if (currentPeriod === 'month') {
    currentDate.setMonth(currentDate.getMonth() + 1);
  } else {
    currentDate.setFullYear(currentDate.getFullYear() + 1);
  }
  loadStats();
}

// Borrar estadísticas
function openClearModal() {
  document.getElementById('clearStatsModal').classList.add('active');
}

function closeClearModal() {
  document.getElementById('clearStatsModal').classList.remove('active');
}

async function clearAllStats() {
  // Eliminar todos los pedidos completados
  const allOrders = await window.db.getAllRecords('orders');
  const completedOrders = allOrders.filter(o => o.status === 'completed');
  
  for (const order of completedOrders) {
    await window.db.deleteRecord('orders', order.id);
  }
  
  // Eliminar todas las estadísticas guardadas
  const allStats = await window.db.getAllRecords('dailyStats');
  for (const stat of allStats) {
    await window.db.deleteRecord('dailyStats', stat.date);
  }
  
  closeClearModal();
  alert('✓ Todas las estadísticas han sido borradas');
  currentDate = new Date();
  await loadStats();
}

// Event Listeners
function setupEventListeners() {
  // Tabs de período
  document.querySelectorAll('#periodTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#periodTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      changePeriod(tab.dataset.period);
    });
  });
  
  // Navegación
  document.getElementById('btnPrevious').addEventListener('click', navigatePrevious);
  document.getElementById('btnNext').addEventListener('click', navigateNext);
  
  // Exportar CSV
  document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
  
  // Borrar estadísticas
  document.getElementById('btnClearStats').addEventListener('click', openClearModal);
  document.getElementById('closeClearModal').addEventListener('click', closeClearModal);
  document.getElementById('cancelClear').addEventListener('click', closeClearModal);
  document.getElementById('confirmClear').addEventListener('click', clearAllStats);
}
