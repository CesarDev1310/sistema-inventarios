/**
 * Módulo de Gestión de Inventario
 * Cliente Frontend: HTML5 + Vanilla JS
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==============================================================================
  // ELEMENTOS DEL DOM
  // ==============================================================================
  const formCard = document.getElementById('form-card');
  const formBadge = document.getElementById('form-badge');
  const formTitle = document.getElementById('form-title');
  const formDesc = document.getElementById('form-desc');
  const inventoryForm = document.getElementById('inventory-form');
  const skuInput = document.getElementById('sku-input');
  const stockInput = document.getElementById('stock-input');
  const imageInput = document.getElementById('image-input');
  const dropzone = document.getElementById('dropzone');
  const dropzoneContent = document.getElementById('dropzone-content');
  const dropzonePreview = document.getElementById('dropzone-preview');
  const previewImage = document.getElementById('preview-image');
  const previewName = document.getElementById('preview-name');
  const previewMeta = document.getElementById('preview-meta');
  const btnRemoveImage = document.getElementById('btn-remove-image');
  const btnSubmit = document.getElementById('btn-submit');
  const btnSubmitText = document.getElementById('btn-submit-text');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const btnRefresh = document.getElementById('btn-refresh');
  const inventoryList = document.getElementById('inventory-list');
  const searchInput = document.getElementById('search-input');
  const metricTotalSkus = document.getElementById('metric-total-skus');
  const metricTotalStock = document.getElementById('metric-total-stock');
  const connectionStatus = document.getElementById('connection-status');
  const statusText = document.getElementById('status-text');
  const toastContainer = document.getElementById('toast-container');

  // Estado local en memoria
  let currentInventory = [];
  let selectedFile = null;
  let editingItem = null;

  // ==============================================================================
  // VERIFICACIÓN DEL ESTADO DEL SISTEMA (HEALTH CHECK)
  // ==============================================================================
  const checkSystemHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Error al conectar con la API');
      const data = await res.json();

      connectionStatus.className = 'connection-status';
      if (data.supabaseConnected) {
        connectionStatus.classList.add('status-online');
        statusText.textContent = 'Supabase Conectado';
      } else {
        connectionStatus.classList.add('status-demo');
        statusText.textContent = 'Modo Local / Demo';
      }
    } catch (err) {
      connectionStatus.className = 'connection-status status-offline';
      statusText.textContent = 'Servidor Desconectado';
    }
  };

  // ==============================================================================
  // UTILIDADES & NOTIFICACIONES TOAST
  // ==============================================================================
  const showToast = (message, type = 'success', title = null) => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const defaultTitle = type === 'success' ? 'Operación Exitosa' : type === 'error' ? 'Error' : 'Aviso';

    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-title">${title || defaultTitle}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-hiding');
      toast.addEventListener('animationend', () => toast.remove());
    }, 4500);
  };

  const escapeHtml = (str) => {
    return String(str).replace(/[&<>"']/g, (m) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Fecha no disponible';
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ==============================================================================
  // GESTIÓN DE CARGA Y PREVISUALIZACIÓN DE IMÁGENES (PNG)
  // ==============================================================================
  const handleFileSelect = (file) => {
    if (!file) return;

    // Validación client-side de extensión y tipo MIME
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      showToast('Solo se permiten fotografías en formato PNG (.png).', 'error', 'Formato no permitido');
      clearImage();
      return;
    }

    // Validación de tamaño máximo (5 MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('El archivo excede el tamaño máximo permitido de 5 MB.', 'error', 'Archivo demasiado grande');
      clearImage();
      return;
    }

    selectedFile = file;

    // Generar vista previa con FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      previewName.textContent = file.name;
      previewMeta.textContent = `${formatFileSize(file.size)} • PNG`;
      dropzoneContent.classList.add('hidden');
      dropzonePreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    selectedFile = null;
    imageInput.value = '';
    previewImage.src = '';
    previewName.textContent = '';
    previewMeta.textContent = '';
    dropzonePreview.classList.add('hidden');
    dropzoneContent.classList.remove('hidden');
  };

  // Eventos de selección de archivo
  imageInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });

  btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImage();
  });

  // ==============================================================================
  // GESTIÓN DE MODO EDICIÓN
  // ==============================================================================
  const startEditItem = (item) => {
    if (!item) return;
    editingItem = item;
    selectedFile = null;
    imageInput.value = '';

    // Poblar campos del formulario
    skuInput.value = item.sku;
    stockInput.value = item.stock;

    // Mostrar vista previa de la imagen actual
    previewImage.src = item.image_url;
    previewName.textContent = `Imagen actual (${item.sku})`;
    previewMeta.textContent = 'Se conservará si no seleccionas otro PNG';
    dropzoneContent.classList.add('hidden');
    dropzonePreview.classList.remove('hidden');

    // Actualizar encabezados y botones del formulario
    if (formCard) formCard.classList.add('is-editing-card');
    if (formBadge) {
      formBadge.textContent = 'Modo Edición';
      formBadge.classList.add('badge-warning');
    }
    if (formTitle) formTitle.textContent = 'Editar Producto';
    if (formDesc) {
      formDesc.textContent = `Modificando el artículo ${item.sku}. Puedes actualizar el SKU, las existencias o reemplazar la fotografía PNG.`;
    }
    if (btnSubmitText) btnSubmitText.textContent = 'Guardar Cambios';
    if (btnCancelEdit) btnCancelEdit.classList.remove('hidden');

    // Re-renderizar catálogo para resaltar la tarjeta en edición
    applyFilterAndRender();

    // Desplazar suavemente hacia el formulario y enfocar stock
    if (formCard && typeof formCard.scrollIntoView === 'function') {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    stockInput.focus();
  };

  const cancelEditMode = () => {
    editingItem = null;
    inventoryForm.reset();
    clearImage();

    if (formCard) formCard.classList.remove('is-editing-card');
    if (formBadge) {
      formBadge.textContent = 'Nuevo Registro';
      formBadge.classList.remove('badge-warning');
    }
    if (formTitle) formTitle.textContent = 'Registrar Producto';
    if (formDesc) {
      formDesc.textContent = 'Ingresa el código SKU alfanumérico, las existencias y la fotografía oficial en formato PNG.';
    }
    if (btnSubmitText) btnSubmitText.textContent = 'Registrar en Inventario';
    if (btnCancelEdit) btnCancelEdit.classList.add('hidden');

    applyFilterAndRender();
  };

  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', () => {
      cancelEditMode();
      showToast('Edición cancelada.', 'warning', 'Modo Registro');
    });
  }

  // Drag and Drop
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  // Normalización automática de SKU al escribir
  skuInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  // ==============================================================================
  // OBTENCIÓN Y RENDERIZADO DEL CATÁLOGO DE INVENTARIO
  // ==============================================================================
  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      if (!res.ok) throw new Error('Error al obtener lista de artículos');
      const responseData = await res.json();

      currentInventory = responseData.data || [];
      renderInventoryList(currentInventory);
      updateMetrics(currentInventory);
    } catch (err) {
      inventoryList.innerHTML = `
        <div class="list-placeholder">
          <p style="color: var(--danger-color);">Error al cargar el inventario: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  };

  const updateMetrics = (items) => {
    const totalSkus = items.length;
    const totalStock = items.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0);

    metricTotalSkus.textContent = totalSkus.toLocaleString();
    metricTotalStock.textContent = totalStock.toLocaleString();
  };

  const renderInventoryList = (items) => {
    if (items.length === 0) {
      inventoryList.innerHTML = `
        <div class="list-empty">
          <svg class="list-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          <p>No hay artículos registrados aún.</p>
          <span style="font-size: 0.8125rem; color: var(--text-dim);">Completa el formulario de la izquierda para registrar el primero.</span>
        </div>
      `;
      return;
    }

    inventoryList.innerHTML = items.map((item) => {
      const stockNum = Number(item.stock) || 0;
      let stockClass = 'stock-in';
      let stockText = `${stockNum} uds.`;

      if (stockNum === 0) {
        stockClass = 'stock-out';
        stockText = 'Agotado (0)';
      } else if (stockNum <= 5) {
        stockClass = 'stock-low';
        stockText = `Bajo (${stockNum})`;
      }

      const isEditingThis = editingItem && editingItem.id === item.id;

      return `
        <article class="inventory-item-card ${isEditingThis ? 'is-editing' : ''}" data-sku="${escapeHtml(item.sku)}" data-id="${escapeHtml(item.id)}">
          <div class="item-thumb-wrapper">
            <img 
              src="${escapeHtml(item.image_url)}" 
              alt="Foto ${escapeHtml(item.sku)}" 
              class="item-thumb" 
              loading="lazy"
              onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' fill=\\'%2364748b\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231e293b\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%2394a3b8\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'10\\'>PNG</text></svg>'"
            />
          </div>
          <div class="item-details">
            <h3 class="item-sku text-mono">${escapeHtml(item.sku)}</h3>
            <span class="item-date">${formatDate(item.updated_at || item.created_at)}</span>
          </div>
          <div class="item-stock-badge">
            <span class="stock-pill ${stockClass} text-mono">${stockText}</span>
            <button type="button" class="btn-edit-item" data-edit-id="${escapeHtml(item.id)}" title="Editar ${escapeHtml(item.sku)}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Editar</span>
            </button>
          </div>
        </article>
      `;
    }).join('');
  };

  // Delegación de evento para botón Editar en las tarjetas
  inventoryList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-item');
    if (!editBtn) return;

    const itemId = editBtn.getAttribute('data-edit-id');
    const itemToEdit = currentInventory.find((i) => String(i.id) === String(itemId));
    if (itemToEdit) {
      startEditItem(itemToEdit);
    }
  });

  const applyFilterAndRender = () => {
    const query = searchInput.value.trim().toUpperCase();
    if (!query) {
      renderInventoryList(currentInventory);
      return;
    }

    const filtered = currentInventory.filter((item) =>
      item.sku.toUpperCase().includes(query)
    );
    renderInventoryList(filtered);
  };

  // Filtrado reactivo en tiempo real
  searchInput.addEventListener('input', () => {
    applyFilterAndRender();
  });

  btnRefresh.addEventListener('click', () => {
    fetchInventory();
    checkSystemHealth();
    showToast('Catálogo actualizado.', 'success');
  });

  // ==============================================================================
  // ENVÍO DEL FORMULARIO Y VALIDACIONES
  // ==============================================================================
  inventoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const skuValue = skuInput.value.trim().toUpperCase();
    const stockValue = stockInput.value.trim();

    // 1. Validación de SKU
    const skuRegex = /^[A-Za-z0-9\-_]{3,50}$/;
    if (!skuValue || !skuRegex.test(skuValue)) {
      showToast('El SKU debe ser alfanumérico (letras, números o guiones) entre 3 y 50 caracteres.', 'error', 'SKU Inválido');
      skuInput.focus();
      return;
    }

    // 2. Validación de Stock
    const parsedStock = Number(stockValue);
    if (stockValue === '' || !Number.isInteger(parsedStock) || parsedStock < 0) {
      showToast('El stock debe ser un número entero positivo o cero (ej. 0, 5, 100).', 'error', 'Stock Inválido');
      stockInput.focus();
      return;
    }

    // 3. Validación de Archivo PNG (Obligatorio en registro nuevo, opcional en edición)
    const isEditMode = Boolean(editingItem && editingItem.id);
    if (!isEditMode && !selectedFile) {
      showToast('Debes seleccionar o arrastrar una fotografía en formato PNG.', 'error', 'Foto Requerida');
      return;
    }

    // Preparar FormData para el envío multipart
    const formData = new FormData();
    formData.append('sku', skuValue);
    formData.append('stock', parsedStock);
    if (selectedFile) {
      formData.append('image', selectedFile);
    }

    // Estado visual de carga
    setSubmittingState(true);

    try {
      const endpoint = isEditMode
        ? `/api/inventory/${encodeURIComponent(editingItem.id)}`
        : '/api/inventory';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          (isEditMode ? 'Error al actualizar el producto.' : 'Error al procesar el registro del producto.')
        );
      }

      // Éxito: notificación y actualización de datos
      showToast(
        result.message || (isEditMode ? 'Artículo actualizado exitosamente.' : 'Artículo registrado exitosamente.'),
        'success',
        isEditMode ? '¡Actualizado!' : '¡Registrado!'
      );
      
      // Limpiar formulario, archivo y salir de modo edición si estaba activo
      cancelEditMode();

      // Recargar catálogo de inventario
      await fetchInventory();

    } catch (err) {
      showToast(err.message, 'error', isEditMode ? 'Error al Editar' : 'Error en el Registro');
    } finally {
      setSubmittingState(false);
    }
  });

  const setSubmittingState = (isSubmitting) => {
    btnSubmit.disabled = isSubmitting;
    if (isSubmitting) {
      btnSpinner.classList.remove('hidden');
    } else {
      btnSpinner.classList.add('hidden');
    }
  };

  // Inicialización de la aplicación
  checkSystemHealth();
  fetchInventory();
});
