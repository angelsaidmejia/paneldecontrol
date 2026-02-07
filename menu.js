// ========================================
// Antojitos La Bendición - Gestión de Menú
// menu.js
// ========================================

let products = [];
let selectedCategory = 'all';
let editingProduct = null;
let complements = [];
let options = [];

// Esperar a que la DB esté lista
window.addEventListener('dbReady', async () => {
  await loadProducts();
  setupEventListeners();
});

// Cargar productos
async function loadProducts() {
  products = await window.db.getAllRecords('menuItems');
  renderProducts();
}

// Renderizar productos
function renderProducts() {
  const grid = document.getElementById('productsGrid');
  
  const filtered = products.filter(p => 
    selectedCategory === 'all' || p.category === selectedCategory
  );
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <div class="empty-state-title">No hay productos</div>
        <div class="empty-state-description">
          ${selectedCategory === 'all' ? 'Agrega tu primer producto' : 'No hay productos en esta categoría'}
        </div>
        ${selectedCategory === 'all' ? '<button class="btn btn-primary mt-2" onclick="openProductModal()">Agregar Producto</button>' : ''}
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map(product => {
    const categoryLabels = {
      desayunos: 'Desayunos',
      antojitos: 'Antojitos',
      guisados: 'Guisados',
      bebidas: 'Bebidas'
    };
    
    const complementsInfo = product.complements?.length > 0 
      ? `<div class="text-muted" style="font-size: 0.875rem; margin-top: 8px;">
          <strong>Complementos:</strong> ${product.complements.map(c => `${c.name} (+$${c.price})`).join(', ')}
         </div>`
      : '';
    
    const optionsInfo = product.options?.length > 0
      ? `<div class="text-muted" style="font-size: 0.875rem; margin-top: 8px;">
          <strong>Opciones:</strong> ${product.options.map(o => o.name).join(', ')}
         </div>`
      : '';
    
    return `
      <div class="card" style="margin: 0;">
        <div class="card-header">
          <div class="card-header-left" style="flex: 1; min-width: 0;">
            <h3 class="card-title" style="font-size: 1rem;">${product.name}</h3>
            <span class="card-badge" style="font-size: 0.75rem;">${categoryLabels[product.category]}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-icon-only btn-primary" onclick="editProduct(${product.id})" aria-label="Editar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon-only btn-danger" onclick="deleteProduct(${product.id})" aria-label="Eliminar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="card-content">
          ${product.description ? `<p style="color: var(--text-secondary); margin-bottom: 12px;">${product.description}</p>` : ''}
          ${complementsInfo}
          ${optionsInfo}
          <div style="margin-top: 12px;">
            <span class="text-success" style="font-size: 1.25rem; font-weight: 700;">$${product.basePrice.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Abrir modal para agregar producto
function openProductModal() {
  editingProduct = null;
  complements = [];
  options = [];
  
  document.getElementById('modalTitle').textContent = 'Agregar Producto';
  document.getElementById('productForm').reset();
  document.getElementById('complementsList').innerHTML = '';
  document.getElementById('optionsList').innerHTML = '';
  document.getElementById('productModal').classList.add('active');
}

// Abrir modal para editar producto
async function editProduct(productId) {
  editingProduct = await window.db.getRecord('menuItems', productId);
  
  document.getElementById('modalTitle').textContent = 'Editar Producto';
  document.getElementById('productName').value = editingProduct.name;
  document.getElementById('productCategory').value = editingProduct.category;
  document.getElementById('productPrice').value = editingProduct.basePrice;
  document.getElementById('productDescription').value = editingProduct.description || '';
  
  complements = editingProduct.complements || [];
  options = editingProduct.options || [];
  
  renderComplements();
  renderOptions();
  
  document.getElementById('productModal').classList.add('active');
}

// Cerrar modal
function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
  editingProduct = null;
  complements = [];
  options = [];
}

// Agregar complemento
function addComplement() {
  complements.push({ name: '', price: 0 });
  renderComplements();
}

// Renderizar complementos
function renderComplements() {
  const list = document.getElementById('complementsList');
  
  if (complements.length === 0) {
    list.innerHTML = '<div class="text-center text-muted">No hay complementos</div>';
    return;
  }
  
  list.innerHTML = complements.map((comp, index) => `
    <div style="display: flex; gap: 8px; margin-bottom: 12px; background: var(--primary-light); padding: 12px; border-radius: 8px;">
      <input 
        type="text" 
        class="form-input" 
        placeholder="Nombre del complemento"
        value="${comp.name}"
        onchange="updateComplement(${index}, 'name', this.value)"
        style="flex: 2;"
      >
      <div class="input-with-prefix" style="flex: 1;">
        <input 
          type="number" 
          class="form-input" 
          placeholder="Precio"
          value="${comp.price}"
          step="0.01"
          min="0"
          onchange="updateComplement(${index}, 'price', parseFloat(this.value))"
        >
      </div>
      <button 
        type="button" 
        class="btn-icon-only btn-danger" 
        onclick="removeComplement(${index})"
        aria-label="Eliminar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');
}

// Actualizar complemento
function updateComplement(index, field, value) {
  complements[index][field] = value;
}

// Eliminar complemento
function removeComplement(index) {
  complements.splice(index, 1);
  renderComplements();
}

// Agregar opción
function addOption() {
  options.push({ name: '', values: [] });
  renderOptions();
}

// Renderizar opciones
function renderOptions() {
  const list = document.getElementById('optionsList');
  
  if (options.length === 0) {
    list.innerHTML = '<div class="text-center text-muted">No hay opciones</div>';
    return;
  }
  
  list.innerHTML = options.map((option, index) => `
    <div style="background: var(--primary-light); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <input 
          type="text" 
          class="form-input" 
          placeholder="Nombre de la opción (ej: Plátanos)"
          value="${option.name}"
          onchange="updateOption(${index}, 'name', this.value)"
          style="flex: 1;"
        >
        <button 
          type="button" 
          class="btn-icon-only btn-danger" 
          onclick="removeOption(${index})"
          aria-label="Eliminar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <input 
        type="text" 
        class="form-input" 
        placeholder="Valores separados por comas (ej: Enteros, Rodajas, Picados)"
        value="${option.values.join(', ')}"
        onchange="updateOptionValues(${index}, this.value)"
      >
    </div>
  `).join('');
}

// Actualizar opción
function updateOption(index, field, value) {
  options[index][field] = value;
}

// Actualizar valores de opción
function updateOptionValues(index, value) {
  options[index].values = value.split(',').map(v => v.trim()).filter(v => v);
}

// Eliminar opción
function removeOption(index) {
  options.splice(index, 1);
  renderOptions();
}

// Guardar producto
async function saveProduct() {
  const name = document.getElementById('productName').value.trim();
  const category = document.getElementById('productCategory').value;
  const basePrice = parseFloat(document.getElementById('productPrice').value);
  const description = document.getElementById('productDescription').value.trim();
  
  if (!name || !category || isNaN(basePrice) || basePrice < 0) {
    alert('Por favor completa todos los campos requeridos correctamente');
    return;
  }
  
  // Validar complementos
  const validComplements = complements.filter(c => c.name && !isNaN(c.price) && c.price >= 0);
  
  // Validar opciones
  const validOptions = options.filter(o => o.name && o.values.length > 0);
  
  const productData = {
    name,
    category,
    basePrice,
    description,
    complements: validComplements,
    options: validOptions,
    createdAt: editingProduct?.createdAt || new Date().toISOString()
  };
  
  if (editingProduct) {
    productData.id = editingProduct.id;
    await window.db.updateRecord('menuItems', productData);
    alert('✓ Producto actualizado');
  } else {
    await window.db.addRecord('menuItems', productData);
    alert('✓ Producto agregado');
  }
  
  closeProductModal();
  await loadProducts();
}

// Eliminar producto
async function deleteProduct(productId) {
  const product = await window.db.getRecord('menuItems', productId);
  
  if (!confirm(`¿Eliminar "${product.name}"?`)) return;
  
  await window.db.deleteRecord('menuItems', productId);
  alert('✓ Producto eliminado');
  await loadProducts();
}

// Exportar menú
async function exportMenu() {
  const menuItems = await window.db.getAllRecords('menuItems');
  
  const exportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    restaurant: 'Antojitos La Bendición',
    items: menuItems
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  a.href = url;
  a.download = `menu_${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  alert(`✓ Menú exportado (${menuItems.length} productos)`);
}

// Importar menú
function importMenu() {
  document.getElementById('fileInput').click();
}

async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validar estructura
    if (!data.items || !Array.isArray(data.items)) {
      alert('✗ Archivo inválido: no contiene items');
      return;
    }
    
    if (!confirm(`¿Importar ${data.items.length} productos?`)) return;
    
    // Agregar productos sin ID para evitar conflictos
    for (const item of data.items) {
      const { id, createdAt, ...productData } = item;
      productData.createdAt = new Date().toISOString();
      await window.db.addRecord('menuItems', productData);
    }
    
    alert(`✓ ${data.items.length} productos importados correctamente`);
    await loadProducts();
    
  } catch (error) {
    console.error(error);
    alert('✗ Error al importar: archivo inválido');
  }
  
  // Limpiar input
  event.target.value = '';
}

// Event Listeners
function setupEventListeners() {
  // Header buttons
  document.getElementById('btnAddProduct').addEventListener('click', openProductModal);
  document.getElementById('btnExport').addEventListener('click', exportMenu);
  document.getElementById('btnImport').addEventListener('click', importMenu);
  document.getElementById('fileInput').addEventListener('change', handleFileImport);
  
  // Modal
  document.getElementById('closeModal').addEventListener('click', closeProductModal);
  document.getElementById('cancelBtn').addEventListener('click', closeProductModal);
  document.getElementById('saveBtn').addEventListener('click', saveProduct);
  
  // Complementos y opciones
  document.getElementById('btnAddComplement').addEventListener('click', addComplement);
  document.getElementById('btnAddOption').addEventListener('click', addOption);
  
  // Tabs de categorías
  document.querySelectorAll('#categoryTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#categoryTabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectedCategory = tab.dataset.category;
      renderProducts();
    });
  });
}

// Funciones globales
window.openProductModal = openProductModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.updateComplement = updateComplement;
window.removeComplement = removeComplement;
window.updateOption = updateOption;
window.updateOptionValues = updateOptionValues;
window.removeOption = removeOption;
