# Módulo de Registro de Inventario (Full Stack)

Módulo integral de registro y gestión de inventario desarrollado bajo estándares de arquitectura limpia y modular, utilizando **Node.js**, **Supabase (PostgreSQL + Storage)** y un frontend moderno con **HTML5 + Vanilla CSS + Vanilla JS**.

---

## 🛠️ Stack Tecnológico

- **Backend:** Node.js (ES Modules), Express.
- **Base de Datos & Almacenamiento:** Supabase (PostgreSQL con RLS + Storage Bucket).
- **Procesamiento de Archivos:** Multer con almacenamiento en memoria y validación binaria de *Magic Bytes* para PNG.
- **Frontend:** HTML5 semántico, Vanilla CSS (diseño responsivo con glassmorphism, paleta oscura premium) y Vanilla JS.
- **Testing:** Suite automatizada de pruebas nativa (11 pruebas cubriendo Happy Path, errores de validación y casos límite).

---

## 📋 Reglas de Negocio & Validación de Capas

| Campo | Capa UI / Form | Capa Backend / DB | Formato y Restricciones |
| :--- | :--- | :--- | :--- |
| **SKU** | `sku` | `sku` (`VARCHAR(50)`) | Alfanumérico (`^[A-Za-z0-9\-_]{3,50}$`), único (`UNIQUE`), no nulo. Normalización automática a mayúsculas y trim. |
| **Stock** | `stock` | `stock` (`INTEGER`) | Obligatorio, número entero positivo o cero (`CHECK (stock >= 0)`). No permite decimales ni negativos. |
| **Foto** | `image` (file) | `image_url` (`TEXT`) | Obligatorio en creación, opcional en edición. Formato estricto **PNG** (`image/png`), máx. 5 MB. Verificación binaria de encabezado (*Magic Bytes*). |

---

## 🔐 Autenticación, Roles (RBAC) y Seguridad

El sistema incluye autenticación mediante contraseñas protegidas con **`scrypt` + `timingSafeEqual`**, tokens firmados con **`HMAC-SHA256`**, cookies **`HttpOnly; SameSite=Strict`**, cabeceras HTTP de seguridad y **Rate Limiting** contra fuerza bruta:

| Perfil | Usuario | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **Administrador (`admin`)** | `admin` | `Admin123!` | Visualizar catálogo (`GET`), registrar productos (`POST`) y editar productos (`PUT`). |
| **Consulta (`viewer`)** | `consulta` | `Consulta123!` | Exclusivamente visualizar y filtrar el catálogo (`GET`). Bloqueado en `POST` y `PUT` (`403 Forbidden`). |

---

## 🚀 Puesta en Marcha

### 1. Instalación de dependencias
```bash
npm install
```

### 2. Configuración de Base de Datos y Supabase
1. Ejecuta el script SQL [schema.sql](file:///d:/PROYECTOS/IA/Antigravity/proy02/schema.sql) en el **SQL Editor** de tu proyecto Supabase para crear:
   - Tabla `inventory_items` con restricciones de integridad y RLS.
   - Bucket de almacenamiento `inventory-images`.
   - Políticas de seguridad y lectura pública.
2. Copia tus credenciales en el archivo `.env`:
```env
PORT=3000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-service-role-o-anon-key
SUPABASE_BUCKET=inventory-images
```
*(Nota: Si no configuras las claves de Supabase de inmediato, la aplicación se ejecutará de forma segura en **modo local/memoria** para permitir pruebas completas).*

### 3. Carga de Datos de Prueba (Seed)
El sistema incluye **10 artículos de prueba** alineados con `public.inventory_items` (cubriendo estados *Disponible*, *Stock Bajo* y *Agotado*, con imágenes PNG reales):
- **En Supabase SQL Editor:** Ejecuta el script idempotente [seed.sql](file:///d:/PROYECTOS/IA/Antigravity/proy02/seed.sql).
- **Vía CLI (Storage + BD o validación local):**
```bash
npm run seed
```
*(En modo local/demo sin credenciales en `.env`, los 10 productos se precargan automáticamente en memoria al iniciar el servidor).*

### 4. Ejecución de Pruebas Automatizadas
Para validar las 11 pruebas de negocio, integridad y casos límite:
```bash
npm test
```

### 5. Iniciar Servidor
```bash
# Modo producción
npm start

# Modo desarrollo con auto-reload
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 📁 Estructura del Proyecto

```text
proy02/
├── .agents/rules/             # Reglas operativas Full Stack
├── public/                    # Frontend
│   ├── css/styles.css         # Estilos Vanilla CSS y variables de diseño
│   ├── js/app.js              # Controlador cliente (validación, dropzone, fetch)
│   └── index.html             # Interfaz semántica y accesible
├── src/
│   ├── config/
│   │   ├── seedData.js        # Datos de prueba y generador nativo de PNG
│   │   └── supabase.js        # Cliente Supabase e inicialización
│   ├── controllers/           # Controladores de negocio y manejo de errores
│   │   └── inventoryController.js
│   ├── middlewares/           # Validación de upload y Magic Bytes PNG
│   │   └── uploadMiddleware.js
│   ├── routes/                # Rutas REST de la API
│   │   └── inventoryRoutes.js
│   ├── seed.js                # Script CLI de carga y validación de semillas
│   └── server.js              # Servidor Express principal
├── test/
│   ├── run_tests.js           # Suite automatizada de pruebas
│   └── setup_test_files.js    # Generador de assets de prueba
├── .env.example               # Plantilla de variables de entorno
├── package.json
├── schema.sql                 # DDL de base de datos y políticas RLS
└── seed.sql                   # DML idempotente con 10 productos de prueba
```
