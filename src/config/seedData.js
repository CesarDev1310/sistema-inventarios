import zlib from 'zlib';

/**
 * Tabla CRC32 estándar para bloques PNG (IHDR, IDAT, IEND)
 */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const createPngChunk = (type, data) => {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
};

/**
 * Genera un Buffer PNG binario 100% válido (cumple Magic Bytes 89 50 4E 47 0D 0A 1A 0A)
 * sin dependencias externas, usando únicamente zlib nativo de Node.js.
 */
export const createColoredPngBuffer = (r, g, b, width = 16, height = 16) => {
  // Cabecera estándar PNG (8 bytes)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // Chunk IHDR (13 bytes): width, height, bitDepth=8, colorType=2 (RGB), compression=0, filter=0, interlace=0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 2; // Color type: Truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Datos de imagen: cada fila lleva 1 byte de filtro (0 = None) + width * 3 bytes (R, G, B)
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filtro None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      rawData[pixelOffset] = isBorder ? Math.max(0, r - 35) : r;
      rawData[pixelOffset + 1] = isBorder ? Math.max(0, g - 35) : g;
      rawData[pixelOffset + 2] = isBorder ? Math.max(0, b - 35) : b;
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });

  return Buffer.concat([
    signature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', compressedData),
    createPngChunk('IEND', Buffer.alloc(0))
  ]);
};

/**
 * Definición canónica de los 10 artículos de prueba alineados con public.inventory_items
 * Cubre los 3 estados visuales del frontend:
 * - Disponible (stock > 5)
 * - Stock Bajo (1 <= stock <= 5)
 * - Agotado (stock === 0)
 */
export const SEED_ITEMS_DEFINITION = [
  { sku: 'LAP-PRO-16X', stock: 24, color: [59, 130, 246], hoursAgo: 10 },
  { sku: 'MON-4K-27U', stock: 15, color: [16, 185, 129], hoursAgo: 9 },
  { sku: 'KEY-MECH-RGB', stock: 42, color: [139, 92, 246], hoursAgo: 8 },
  { sku: 'MOU-ERG-WL1', stock: 4, color: [245, 158, 11], hoursAgo: 7 },
  { sku: 'SSD-NVME-2TB', stock: 0, color: [239, 68, 68], hoursAgo: 6 },
  { sku: 'RAM-DDR5-32G', stock: 18, color: [6, 182, 212], hoursAgo: 5 },
  { sku: 'GPU-RTX-4080S', stock: 2, color: [236, 72, 153], hoursAgo: 4 },
  { sku: 'DOC-USB4-12P', stock: 9, color: [99, 102, 241], hoursAgo: 3 },
  { sku: 'CAM-STR-1080P', stock: 0, color: [100, 116, 139], hoursAgo: 2 },
  { sku: 'UPS-SMT-1500W', stock: 5, color: [20, 184, 166], hoursAgo: 1 }
];

/**
 * Genera la lista de registros semilla con estructura idéntica a la tabla public.inventory_items
 */
export const getInitialSeedItems = () => {
  const now = Date.now();
  return SEED_ITEMS_DEFINITION.map((item, idx) => {
    const pngBuffer = createColoredPngBuffer(...item.color);
    const timestamp = new Date(now - item.hoursAgo * 3600 * 1000).toISOString();
    return {
      id: `local-seed-${String(idx + 1).padStart(2, '0')}`,
      sku: item.sku,
      stock: item.stock,
      image_url: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      created_at: timestamp,
      updated_at: timestamp
    };
  });
};
