// ========================================
// Antojitos La Bendición - Database Manager
// IndexedDB Configuration
// ========================================

const DB_NAME = 'AntojitosLaBendicion';
const DB_VERSION = 1;

let db = null;

// Inicializar la base de datos
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Store: menuItems (Productos del Menú)
      if (!database.objectStoreNames.contains('menuItems')) {
        const menuStore = database.createObjectStore('menuItems', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        menuStore.createIndex('category', 'category', { unique: false });
        menuStore.createIndex('name', 'name', { unique: false });
      }
      
      // Store: orders (Pedidos)
      if (!database.objectStoreNames.contains('orders')) {
        const ordersStore = database.createObjectStore('orders', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        ordersStore.createIndex('status', 'status', { unique: false });
        ordersStore.createIndex('customerName', 'customerName', { unique: false });
        ordersStore.createIndex('createdAt', 'createdAt', { unique: false });
        ordersStore.createIndex('paymentMethod', 'paymentMethod', { unique: false });
      }
      
      // Store: debts (Deudas)
      if (!database.objectStoreNames.contains('debts')) {
        const debtsStore = database.createObjectStore('debts', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        debtsStore.createIndex('status', 'status', { unique: false });
        debtsStore.createIndex('customerName', 'customerName', { unique: false });
        debtsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Store: dailyStats (Estadísticas Diarias)
      if (!database.objectStoreNames.contains('dailyStats')) {
        database.createObjectStore('dailyStats', { keyPath: 'date' });
      }
      
      // Store: settings (Configuraciones)
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

// Operaciones CRUD genéricas

// Agregar un registro
async function addRecord(storeName, data) {
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Obtener un registro por ID
async function getRecord(storeName, id) {
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Obtener todos los registros
async function getAllRecords(storeName) {
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Actualizar un registro
async function updateRecord(storeName, data) {
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Eliminar un registro
async function deleteRecord(storeName, id) {
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Obtener registros por índice
async function getRecordsByIndex(storeName, indexName, value) {
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);
  const index = store.index(indexName);
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Funciones específicas para Settings

async function getSetting(key) {
  const setting = await getRecord('settings', key);
  return setting ? setting.value : null;
}

async function setSetting(key, value) {
  return await updateRecord('settings', { key, value });
}

// Funciones específicas para Pedidos

async function getPendingOrders() {
  return await getRecordsByIndex('orders', 'status', 'pending');
}

async function getCompletedOrders() {
  const orders = await getRecordsByIndex('orders', 'status', 'completed');
  const today = new Date().toISOString().split('T')[0];
  return orders.filter(order => {
    const orderDate = new Date(order.completedAt).toISOString().split('T')[0];
    return orderDate === today;
  });
}

async function completeOrder(orderId) {
  const order = await getRecord('orders', orderId);
  if (order) {
    order.status = 'completed';
    order.completedAt = new Date().toISOString();
    return await updateRecord('orders', order);
  }
}

// Funciones específicas para Deudas

async function getActiveDebts() {
  return await getRecordsByIndex('debts', 'status', 'active');
}

async function addPaymentToDebt(debtId, payment) {
  const debt = await getRecord('debts', debtId);
  if (debt) {
    if (!debt.payments) {
      debt.payments = [];
    }
    debt.payments.push(payment);
    
    // Calcular total pagado
    const totalPaid = debt.payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Si se pagó todo, marcar como pagada
    if (totalPaid >= debt.amount) {
      debt.status = 'paid';
    }
    
    return await updateRecord('debts', debt);
  }
}

// Funciones específicas para Estadísticas

async function getDailyStats(date) {
  return await getRecord('dailyStats', date);
}

async function saveDailyStats(date, stats) {
  stats.date = date;
  stats.savedAt = new Date().toISOString();
  return await updateRecord('dailyStats', stats);
}

async function calculateDailyStats(date) {
  const orders = await getAllRecords('orders');
  const dateOrders = orders.filter(order => {
    if (order.status !== 'completed' || !order.completedAt) return false;
    const orderDate = new Date(order.completedAt).toISOString().split('T')[0];
    return orderDate === date;
  });
  
  if (dateOrders.length === 0) {
    return {
      date,
      totalRevenue: 0,
      totalOrders: 0,
      averageOrder: 0,
      paymentMethods: { efectivo: 0, transferencia: 0, deuda: 0 },
      topProducts: [],
      categorySales: { desayunos: 0, antojitos: 0, guisados: 0, bebidas: 0 },
      hourlySales: new Array(24).fill(0)
    };
  }
  
  // Calcular totales
  const totalRevenue = dateOrders.reduce((sum, order) => sum + order.totalPrice, 0);
  const totalOrders = dateOrders.length;
  const averageOrder = totalRevenue / totalOrders;
  
  // Métodos de pago
  const paymentMethods = { efectivo: 0, transferencia: 0, deuda: 0 };
  dateOrders.forEach(order => {
    paymentMethods[order.paymentMethod] += order.totalPrice;
  });
  
  // Productos más vendidos
  const productMap = {};
  dateOrders.forEach(order => {
    const key = order.productName;
    if (!productMap[key]) {
      productMap[key] = {
        name: order.productName,
        count: 0,
        revenue: 0,
        category: order.category
      };
    }
    productMap[key].count++;
    productMap[key].revenue += order.totalPrice;
  });
  
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  
  // Ventas por categoría
  const categorySales = { desayunos: 0, antojitos: 0, guisados: 0, bebidas: 0 };
  dateOrders.forEach(order => {
    if (categorySales.hasOwnProperty(order.category)) {
      categorySales[order.category] += order.totalPrice;
    }
  });
  
  // Ventas por hora
  const hourlySales = new Array(24).fill(0);
  dateOrders.forEach(order => {
    const hour = new Date(order.completedAt).getHours();
    hourlySales[hour] += order.totalPrice;
  });
  
  return {
    date,
    totalRevenue,
    totalOrders,
    averageOrder,
    paymentMethods,
    topProducts,
    categorySales,
    hourlySales
  };
}

// Limpiar pedidos completados y guardar estadísticas
async function endDay() {
  const today = new Date().toISOString().split('T')[0];
  
  // Calcular y guardar estadísticas del día
  const stats = await calculateDailyStats(today);
  await saveDailyStats(today, stats);
  
  // Los pedidos completados se mantienen
  return stats;
}

// Inicializar DB al cargar el script
initDB().then(() => {
  console.log('Database initialized successfully');
  // Emitir evento personalizado cuando la DB esté lista
  window.dispatchEvent(new Event('dbReady'));
}).catch(error => {
  console.error('Error initializing database:', error);
});

// Exportar funciones globalmente
window.db = {
  addRecord,
  getRecord,
  getAllRecords,
  updateRecord,
  deleteRecord,
  getRecordsByIndex,
  getSetting,
  setSetting,
  getPendingOrders,
  getCompletedOrders,
  completeOrder,
  getActiveDebts,
  addPaymentToDebt,
  getDailyStats,
  saveDailyStats,
  calculateDailyStats,
  endDay
};
