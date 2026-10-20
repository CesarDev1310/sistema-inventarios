/**
 * Test Suite Automatizado para Validación de Reglas de Negocio, Seguridad y RBAC
 * Ejecuta los casos del Paso 3 de la especificación
 */

import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/server.js');

const runTests = async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  console.log(`\n========================================================`);
  console.log(`🧪 INICIANDO BATERÍA DE PRUEBAS AUTOMATIZADAS (PASO 3)`);
  console.log(`   Servidor de prueba montado en: ${baseUrl}`);
  console.log(`========================================================\n`);

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  };

  const validPngBuffer = fs.readFileSync(path.resolve('test/valid_sample.png'));
  const invalidTxtBuffer = fs.readFileSync(path.resolve('test/invalid_sample.txt'));

  try {
    // --------------------------------------------------------------------------
    // Test 0: Comprobación de Health Check y Cabeceras de Seguridad
    // --------------------------------------------------------------------------
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    const nosniffHeader = healthRes.headers.get('x-content-type-options');
    assert(
      healthRes.status === 200 && healthData.status === 'online' && nosniffHeader === 'nosniff',
      '0. Endpoint /api/health responde 200 OK con cabeceras de seguridad HTTP activas'
    );

    // --------------------------------------------------------------------------
    // Test 0.1: Seguridad - Acceso sin autenticación rechazado (HTTP 401)
    // --------------------------------------------------------------------------
    const unauthRes = await fetch(`${baseUrl}/api/inventory`);
    assert(unauthRes.status === 401, '0.1 Seguridad: Acceso a /api/inventory sin sesión retorna HTTP 401');

    // --------------------------------------------------------------------------
    // Test 0.2: Seguridad - Login con credenciales incorrectas rechazado (HTTP 401)
    // --------------------------------------------------------------------------
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'ClaveIncorrecta999' })
    });
    assert(badLoginRes.status === 401, '0.2 Seguridad: Login con contraseña inválida retorna HTTP 401');

    // --------------------------------------------------------------------------
    // Test 0.3: RBAC - Login exitoso como Usuario de Consulta (viewer)
    // --------------------------------------------------------------------------
    const viewerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'consulta', password: 'Consulta123!' })
    });
    const viewerLoginData = await viewerLoginRes.json();
    const viewerToken = viewerLoginData.token;
    const viewerHeaders = { Authorization: `Bearer ${viewerToken}` };
    assert(
      viewerLoginRes.status === 200 && viewerLoginData.user?.role === 'viewer' && Boolean(viewerToken),
      '0.3 RBAC: Login con usuario "consulta" retorna HTTP 200 y rol "viewer"'
    );

    // --------------------------------------------------------------------------
    // Test 0.4: RBAC - Usuario de Consulta puede visualizar el inventario (GET 200)
    // --------------------------------------------------------------------------
    const viewerGetRes = await fetch(`${baseUrl}/api/inventory`, { headers: viewerHeaders });
    assert(viewerGetRes.status === 200, '0.4 RBAC: Usuario "viewer" puede consultar GET /api/inventory (HTTP 200)');

    // --------------------------------------------------------------------------
    // Test 0.5: RBAC - Usuario de Consulta tiene bloqueado registrar productos (POST 403)
    // --------------------------------------------------------------------------
    const viewerPostForm = new FormData();
    viewerPostForm.append('sku', 'PROD-VIEWER-01');
    viewerPostForm.append('stock', '10');
    viewerPostForm.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const viewerPostRes = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: viewerHeaders,
      body: viewerPostForm
    });
    assert(
      viewerPostRes.status === 403,
      '0.5 RBAC: Usuario "viewer" bloqueado al intentar crear producto (HTTP 403 Forbidden)'
    );

    // --------------------------------------------------------------------------
    // Test 0.6: RBAC - Login exitoso como Administrador (admin)
    // --------------------------------------------------------------------------
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin123!' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    assert(
      adminLoginRes.status === 200 && adminLoginData.user?.role === 'admin' && Boolean(adminToken),
      '0.6 RBAC: Login con usuario "admin" retorna HTTP 200 y rol "admin"'
    );

    // --------------------------------------------------------------------------
    // Test 1: Flujo Exitoso (Happy Path - Rol Admin)
    // --------------------------------------------------------------------------
    const form1 = new FormData();
    form1.append('sku', 'PROD-A100-X');
    form1.append('stock', '15');
    form1.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res1 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form1
    });
    const data1 = await res1.json();
    assert(res1.status === 201 && data1.success === true, '1. Flujo Exitoso: Registro válido por Admin retorna HTTP 201');
    assert(data1.data?.sku === 'PROD-A100-X' && data1.data?.stock === 15, '1.1 Sincronización de datos SKU y stock en respuesta');

    // --------------------------------------------------------------------------
    // Test 2.1: Validación Negativa - SKU con caracteres no alfanuméricos
    // --------------------------------------------------------------------------
    const form2 = new FormData();
    form2.append('sku', 'SKU#*!@');
    form2.append('stock', '10');
    form2.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res2 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form2
    });
    const data2 = await res2.json();
    assert(res2.status === 400 && data2.success === false, '2.1 Validación Negativa: SKU con caracteres inválidos retorna HTTP 400');

    // --------------------------------------------------------------------------
    // Test 2.2: Validación Negativa - SKU Duplicado
    // --------------------------------------------------------------------------
    const form3 = new FormData();
    form3.append('sku', 'PROD-A100-X'); // Mismo SKU de la prueba 1
    form3.append('stock', '20');
    form3.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res3 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form3
    });
    const data3 = await res3.json();
    assert(res3.status === 409 && data3.success === false, '2.2 Validación Negativa: SKU duplicado retorna HTTP 409');

    // --------------------------------------------------------------------------
    // Test 2.3: Validación Negativa - Stock negativo
    // --------------------------------------------------------------------------
    const form4 = new FormData();
    form4.append('sku', 'PROD-NEG-01');
    form4.append('stock', '-5');
    form4.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res4 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form4
    });
    const data4 = await res4.json();
    assert(res4.status === 400 && data4.success === false, '2.3 Validación Negativa: Stock negativo (-5) retorna HTTP 400');

    // --------------------------------------------------------------------------
    // Test 2.4: Validación Negativa - Stock decimal
    // --------------------------------------------------------------------------
    const form5 = new FormData();
    form5.append('sku', 'PROD-DEC-01');
    form5.append('stock', '3.5');
    form5.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res5 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form5
    });
    const data5 = await res5.json();
    assert(res5.status === 400 && data5.success === false, '2.4 Validación Negativa: Stock decimal (3.5) retorna HTTP 400');

    // --------------------------------------------------------------------------
    // Test 2.5: Validación Negativa - Archivo no PNG (.txt)
    // --------------------------------------------------------------------------
    const form6 = new FormData();
    form6.append('sku', 'PROD-IMG-01');
    form6.append('stock', '8');
    form6.append('image', new Blob([invalidTxtBuffer], { type: 'text/plain' }), 'documento.txt');

    const res6 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form6
    });
    const data6 = await res6.json();
    assert(res6.status === 400 && data6.success === false, '2.5 Validación Negativa: Archivo no PNG rechazado con HTTP 400');

    // --------------------------------------------------------------------------
    // Test 3.1: Caso Límite - Stock en 0 (Agotado)
    // --------------------------------------------------------------------------
    const form7 = new FormData();
    form7.append('sku', 'PROD-ZERO-01');
    form7.append('stock', '0');
    form7.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res7 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form7
    });
    const data7 = await res7.json();
    assert(res7.status === 201 && data7.data?.stock === 0, '3.1 Caso Límite: Stock igual a 0 aceptado correctamente (HTTP 201)');

    // --------------------------------------------------------------------------
    // Test 3.2: Caso Límite - SKU con espacios extremos y minúsculas normalizado
    // --------------------------------------------------------------------------
    const form8 = new FormData();
    form8.append('sku', '  prod-clean-99  ');
    form8.append('stock', '4');
    form8.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res8 = await fetch(`${baseUrl}/api/inventory`, {
      method: 'POST',
      headers: adminHeaders,
      body: form8
    });
    const data8 = await res8.json();
    assert(res8.status === 201 && data8.data?.sku === 'PROD-CLEAN-99', '3.2 Caso Límite: Normalización automática de SKU a mayúsculas y trim');

    // --------------------------------------------------------------------------
    // Test 4: Consulta de Catálogo GET /api/inventory
    // --------------------------------------------------------------------------
    const listRes = await fetch(`${baseUrl}/api/inventory`, { headers: adminHeaders });
    const listData = await listRes.json();
    assert(listRes.status === 200 && Array.isArray(listData.data) && listData.data.length >= 3, '4. GET /api/inventory devuelve lista estructurada de productos');

    // --------------------------------------------------------------------------
    // Test 5.0: RBAC en Edición - Usuario "viewer" bloqueado al intentar editar (PUT 403)
    // --------------------------------------------------------------------------
    const itemToEditId = data1.data?.id;
    const originalImageUrl = data1.data?.image_url;
    const formViewerEdit = new FormData();
    formViewerEdit.append('sku', 'PROD-HACK-01');
    formViewerEdit.append('stock', '999');

    const resViewerEdit = await fetch(`${baseUrl}/api/inventory/${itemToEditId}`, {
      method: 'PUT',
      headers: viewerHeaders,
      body: formViewerEdit
    });
    assert(
      resViewerEdit.status === 403,
      '5.0 RBAC en Edición: Usuario "viewer" bloqueado al intentar editar producto (HTTP 403)'
    );

    // --------------------------------------------------------------------------
    // Test 5.1: Edición Exitosa por Admin (Sin cambiar imagen PNG)
    // --------------------------------------------------------------------------
    const formEdit1 = new FormData();
    formEdit1.append('sku', 'PROD-A100-EDITED');
    formEdit1.append('stock', '99');

    const resEdit1 = await fetch(`${baseUrl}/api/inventory/${itemToEditId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: formEdit1
    });
    const dataEdit1 = await resEdit1.json();
    assert(
      resEdit1.status === 200 &&
      dataEdit1.success === true &&
      dataEdit1.data?.sku === 'PROD-A100-EDITED' &&
      dataEdit1.data?.stock === 99 &&
      dataEdit1.data?.image_url === originalImageUrl,
      '5.1 Edición Exitosa: Actualiza SKU y stock conservando imagen PNG original (HTTP 200)'
    );

    // --------------------------------------------------------------------------
    // Test 5.2: Edición Exitosa por Admin (Reemplazando imagen PNG)
    // --------------------------------------------------------------------------
    const formEdit2 = new FormData();
    formEdit2.append('sku', 'PROD-A100-EDITED');
    formEdit2.append('stock', '50');
    formEdit2.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'updated.png');

    const resEdit2 = await fetch(`${baseUrl}/api/inventory/${itemToEditId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: formEdit2
    });
    const dataEdit2 = await resEdit2.json();
    assert(
      resEdit2.status === 200 &&
      dataEdit2.success === true &&
      dataEdit2.data?.stock === 50,
      '5.2 Edición Exitosa: Reemplaza imagen PNG válida y actualiza stock (HTTP 200)'
    );

    // --------------------------------------------------------------------------
    // Test 5.3: Validación Negativa en Edición - Conflicto con otro SKU existente
    // --------------------------------------------------------------------------
    const formEdit3 = new FormData();
    formEdit3.append('sku', 'PROD-ZERO-01'); // Pertenece al artículo creado en Test 3.1
    formEdit3.append('stock', '10');

    const resEdit3 = await fetch(`${baseUrl}/api/inventory/${itemToEditId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: formEdit3
    });
    const dataEdit3 = await resEdit3.json();
    assert(
      resEdit3.status === 409 && dataEdit3.success === false,
      '5.3 Validación Negativa en Edición: Colisión con SKU de otro producto retorna HTTP 409'
    );

    // --------------------------------------------------------------------------
    // Test 5.4: Validación Negativa en Edición - Stock negativo
    // --------------------------------------------------------------------------
    const formEdit4 = new FormData();
    formEdit4.append('sku', 'PROD-A100-EDITED');
    formEdit4.append('stock', '-10');

    const resEdit4 = await fetch(`${baseUrl}/api/inventory/${itemToEditId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: formEdit4
    });
    const dataEdit4 = await resEdit4.json();
    assert(
      resEdit4.status === 400 && dataEdit4.success === false,
      '5.4 Validación Negativa en Edición: Stock negativo rechazado con HTTP 400'
    );

    // --------------------------------------------------------------------------
    // Test 5.5: Caso Límite en Edición - ID de producto inexistente
    // --------------------------------------------------------------------------
    const formEdit5 = new FormData();
    formEdit5.append('sku', 'PROD-GHOST-01');
    formEdit5.append('stock', '10');

    const resEdit5 = await fetch(`${baseUrl}/api/inventory/id-inexistente-999`, {
      method: 'PUT',
      headers: adminHeaders,
      body: formEdit5
    });
    const dataEdit5 = await resEdit5.json();
    assert(
      resEdit5.status === 404 && dataEdit5.success === false,
      '5.5 Caso Límite en Edición: Producto inexistente retorna HTTP 404'
    );

  } catch (error) {
    console.error('Error durante la ejecución del test suite:', error);
    failed++;
  } finally {
    server.close();
    console.log(`\n--------------------------------------------------------`);
    console.log(`🏁 RESULTADOS: ${passed} Pasadas, ${failed} Fallidas`);
    console.log(`--------------------------------------------------------\n`);

    process.exitCode = failed > 0 ? 1 : 0;
    server.close();
  }
};

runTests();
