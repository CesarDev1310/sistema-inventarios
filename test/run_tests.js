/**
 * Test Suite Automatizado para Validación de Reglas de Negocio
 * Ejecuta los casos del Paso 3 de la especificación
 */

import fs from 'fs';
import path from 'path';
import app from '../src/server.js';

process.env.NODE_ENV = 'test';

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
    // Test 0: Comprobación de Health Check
    // --------------------------------------------------------------------------
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'online', 'Endpoint /api/health responde 200 OK');

    // --------------------------------------------------------------------------
    // Test 1: Flujo Exitoso (Happy Path)
    // --------------------------------------------------------------------------
    const form1 = new FormData();
    form1.append('sku', 'PROD-A100-X');
    form1.append('stock', '15');
    form1.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res1 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form1 });
    const data1 = await res1.json();
    assert(res1.status === 201 && data1.success === true, '1. Flujo Exitoso: Registro válido retorna HTTP 201');
    assert(data1.data?.sku === 'PROD-A100-X' && data1.data?.stock === 15, '1.1 Sincronización de datos SKU y stock en respuesta');

    // --------------------------------------------------------------------------
    // Test 2.1: Validación Negativa - SKU con caracteres no alfanuméricos
    // --------------------------------------------------------------------------
    const form2 = new FormData();
    form2.append('sku', 'SKU#*!@');
    form2.append('stock', '10');
    form2.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res2 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form2 });
    const data2 = await res2.json();
    assert(res2.status === 400 && data2.success === false, '2.1 Validación Negativa: SKU con caracteres inválidos retorna HTTP 400');

    // --------------------------------------------------------------------------
    // Test 2.2: Validación Negativa - SKU Duplicado
    // --------------------------------------------------------------------------
    const form3 = new FormData();
    form3.append('sku', 'PROD-A100-X'); // Mismo SKU de la prueba 1
    form3.append('stock', '20');
    form3.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res3 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form3 });
    const data3 = await res3.json();
    assert(res3.status === 409 && data3.success === false, '2.2 Validación Negativa: SKU duplicado retorna HTTP 409');

    // --------------------------------------------------------------------------
    // Test 2.3: Validación Negativa - Stock negativo
    // --------------------------------------------------------------------------
    const form4 = new FormData();
    form4.append('sku', 'PROD-NEG-01');
    form4.append('stock', '-5');
    form4.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res4 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form4 });
    const data4 = await res4.json();
    assert(res4.status === 400 && data4.success === false, '2.3 Validación Negativa: Stock negativo (-5) retorna HTTP 400');

    // --------------------------------------------------------------------------
    // Test 2.4: Validación Negativa - Stock decimal
    // --------------------------------------------------------------------------
    const form5 = new FormData();
    form5.append('sku', 'PROD-DEC-01');
    form5.append('stock', '3.5');
    form5.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res5 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form5 });
    const data5 = await res5.json();
    assert(res5.status === 400 && data5.success === false, '2.4 Validación Negativa: Stock decimal (3.5) retorna HTTP 400');

    // --------------------------------------------------------------------------
    // Test 2.5: Validación Negativa - Archivo no PNG (.txt)
    // --------------------------------------------------------------------------
    const form6 = new FormData();
    form6.append('sku', 'PROD-IMG-01');
    form6.append('stock', '8');
    form6.append('image', new Blob([invalidTxtBuffer], { type: 'text/plain' }), 'documento.txt');

    const res6 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form6 });
    const data6 = await res6.json();
    assert(res6.status === 400 && data6.success === false, '2.5 Validación Negativa: Archivo no PNG rechazado con HTTP 400');

    // --------------------------------------------------------------------------
    // Test 3.1: Caso Límite - Stock en 0 (Agotado)
    // --------------------------------------------------------------------------
    const form7 = new FormData();
    form7.append('sku', 'PROD-ZERO-01');
    form7.append('stock', '0');
    form7.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res7 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form7 });
    const data7 = await res7.json();
    assert(res7.status === 201 && data7.data?.stock === 0, '3.1 Caso Límite: Stock igual a 0 aceptado correctamente (HTTP 201)');

    // --------------------------------------------------------------------------
    // Test 3.2: Caso Límite - SKU con espacios extremos y minúsculas normalizado
    // --------------------------------------------------------------------------
    const form8 = new FormData();
    form8.append('sku', '  prod-clean-99  ');
    form8.append('stock', '4');
    form8.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'sample.png');

    const res8 = await fetch(`${baseUrl}/api/inventory`, { method: 'POST', body: form8 });
    const data8 = await res8.json();
    assert(res8.status === 201 && data8.data?.sku === 'PROD-CLEAN-99', '3.2 Caso Límite: Normalización automática de SKU a mayúsculas y trim');

    // --------------------------------------------------------------------------
    // Test 4: Consulta de Catálogo GET /api/inventory
    // --------------------------------------------------------------------------
    const listRes = await fetch(`${baseUrl}/api/inventory`);
    const listData = await listRes.json();
    assert(listRes.status === 200 && Array.isArray(listData.data) && listData.data.length >= 3, '4. GET /api/inventory devuelve lista estructurada de productos');

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
