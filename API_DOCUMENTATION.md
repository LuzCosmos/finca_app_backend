# Finca App Backend (NestJS) — Documentación

Este documento resume la API y arquitectura del backend NestJS en `finca_app_backend`.

## 1) Resumen rápido

- **Framework**: NestJS 11
- **Prefijo global**: `/api/v1`
- **Swagger**: `/api`
- **DB**: PostgreSQL (PostGIS) + TypeORM
- **Cache/Sesión**: Redis
- **Auth**: JWT (Bearer)
- **Multi-tenant**: interceptor de tenant y control de permisos por módulo/entidad/acción

## 2) Cómo ejecutar (Docker)

Ver `README.md` del backend para el setup completo. Resumen:

1) Crear `.env` desde `.example.env`.
2) Preparar rutas para DB/Redis/Uploads:
```
${BASE_PATH}/${ENVIRONMENT}-srv/docker-data/fa-database
${BASE_PATH}/${ENVIRONMENT}-srv/docker-data/fa-redis
${BASE_PATH}/${ENVIRONMENT}-srv/docker-data/fa-uploads
```
3) Ejecutar:
```
cd finca_app_backend
docker compose build
docker compose up -d
```

## 3) Entry points y configuración

- `src/main.ts`:
  - Prefijo global `/api/v1`
  - CORS
  - `ValidationPipe` global
  - Swagger en `/api`
- `src/app.module.ts`: módulo raíz
- `src/config/env.ts`: validación de variables de entorno
- `src/config/typeorm.config.ts`: configuración TypeORM
- `src/database/data-source.ts`: DataSource de TypeORM

## 4) Autenticación y autorización

### Auth (JWT)
- `POST /api/v1/auth/login`
  - Autentica y devuelve JWT
  - Header esperado en endpoints protegidos:  
    `Authorization: Bearer <token>`

### Configuración de expiración de sesión
- La variable de entorno `JWT_EXPIRATION` define:
  - La expiración del `access_token` firmado por JWT.
  - El TTL de la sesión almacenada en Redis (`session:{userId}:{sessionId}`).
- Formatos soportados: `s` (segundos), `m` (minutos), `h` (horas), `d` (días).  
  Ejemplos: `30s`, `15m`, `24h`, `7d`.
- Si `JWT_EXPIRATION` es inválido, el backend aplica fallback de seguridad a `86400` segundos (24h) para el TTL en Redis.

### Guards y permisos
- `JwtAuthGuard`: valida token JWT
- `ApplicationPermissionsGuard`: permisos por módulo/entidad/acción  
  Decoradores:
  - `@RequireModule(...)`
  - `@RequireEntity(...)`
  - `@RequireAction(...)`

### Interceptors
- `TenantInterceptor`: inyecta `tenantId` en request/response

## 5) Módulos principales

- **Auth**: login, JWT
- **Employee Management**: usuarios, roles, tenants, permisos
- **Farm**: ganado, marcas, ubicaciones, colores, características, historial
- **Commerce**: compras, ventas, proveedores, lotes
- **Production Center**: dispositivos, perfiles de dispositivos
- **Massive Events**: eventos masivos y eventos simples
- **Purchase Receptions**: recepción de ganado
- **Configurations**: parámetros/configuraciones del sistema
- **MQTT**: integración con IoT (ChirpStack/MQTT)

## 6) Endpoints por módulo

### Health
- `GET /api/v1/` — Health check básico
- `GET /api/v1/health` — Health check con timestamp

### Auth
- `POST /api/v1/auth/login` — Login y generación de JWT

### Employee Management — Users
- `POST /api/v1/users` — Crear usuario
- `GET /api/v1/users` — Listar usuarios (paginado)
- `GET /api/v1/users/:id` — Obtener usuario por ID
- `PUT /api/v1/users/:id` — Actualizar usuario
- `DELETE /api/v1/users/:id` — Eliminar usuario
- `GET /api/v1/users/roles` — Listar roles disponibles

### Employee Management — Roles & Permissions
- `GET /api/v1/roles` — Listar roles
- `GET /api/v1/roles/:id` — Obtener rol por ID
- `POST /api/v1/roles/permissions` — Crear permiso por rol/módulo
- `PUT /api/v1/roles/:roleId/permissions/:moduleId` — Actualizar permiso
- `DELETE /api/v1/roles/:roleId/permissions/:moduleId` — Eliminar permiso
- `GET /api/v1/roles/permissions/:roleId` — Listar permisos de un rol

### Employee Management — Tenants
- `POST /api/v1/tenants` — Crear tenant con usuario admin
- `GET /api/v1/tenants/:id` — Obtener tenant por ID

### Farm — Cattle
- `POST /api/v1/cattle` — Crear ganado
- `GET /api/v1/cattle` — Listar ganado (paginado)
- `GET /api/v1/cattle/search` — Buscar ganado (número/eartag/dispositivo)
- `GET /api/v1/cattle/:id` — Obtener ganado por ID
- `PATCH /api/v1/cattle/:id` — Actualizar ganado
- `DELETE /api/v1/cattle/:id` — Eliminar ganado
- `GET /api/v1/cattle/basic-info` — Info básica
- `GET /api/v1/cattle/basic` — Info básica paginada con cursor
- `GET /api/v1/cattle/simple-events/:id` — Eventos simples por ganado
- `POST /api/v1/cattle/apply-events/:cattleNumber` — Aplicar eventos a un ganado
- `POST /api/v1/cattle/apply-simple-events` — Aplicar eventos a múltiples ganados
- `POST /api/v1/cattle/sync-cattle-simple-event` — Sincronización offline
- `POST /api/v1/cattle/import` — Importar ganado (Excel)
- `GET /api/v1/cattle/validate-number/:number` — Validar para venta
- `POST /api/v1/cattle/:id/weight-history` — Registrar peso en historial
- `PUT /api/v1/cattle/:id/weight` — Actualizar peso actual
- `PUT /api/v1/cattle/bulk-status` — Actualizar estado masivo
- `POST /api/v1/cattle/:id/medication` — Historial de medicación

### Farm — Brands
- `POST /api/v1/brands` — Crear marca (con imagen)
- `GET /api/v1/brands` — Listar marcas
- `GET /api/v1/brands/:id` — Obtener marca por ID
- `PUT /api/v1/brands/:id` — Actualizar marca
- `DELETE /api/v1/brands/:id` — Eliminar marca
- `POST /api/v1/brands/sync` — Sincronizar marcas offline

### Farm — Locations
- `GET /api/v1/locations/:id` — Ubicación por ID
- `GET /api/v1/locations/cattle/:id` — Ubicación por ganado
- `GET /api/v1/locations/device/:id` — Ubicación por dispositivo
- `DELETE /api/v1/locations/:id` — Eliminar ubicación

### Farm — Color/Characteristics
- `GET /api/v1/color-characteristics/color` — Colores
- `GET /api/v1/color-characteristics/characteristic` — Características

### Commerce — Purchases
- `POST /api/v1/purchases` — Crear compra
- `GET /api/v1/purchases` — Listar compras (paginado)
- `GET /api/v1/purchases/:id` — Obtener compra por ID
- `PATCH /api/v1/purchases/:id` — Actualizar compra
- `DELETE /api/v1/purchases/:id` — Eliminar compra

### Commerce — Sales
- `POST /api/v1/sales` — Crear venta
- `GET /api/v1/sales` — Listar ventas (paginado)
- `GET /api/v1/sales/:id` — Obtener venta por ID
- `PUT /api/v1/sales/:id` — Actualizar venta

### Commerce — Providers
- `POST /api/v1/providers` — Crear proveedor
- `GET /api/v1/providers` — Listar proveedores
- `GET /api/v1/providers/search` — Buscar por nombre
- `GET /api/v1/providers/search/by-nit` — Buscar por NIT
- `GET /api/v1/providers/:id` — Obtener por ID
- `GET /api/v1/providers/nit/:nit` — Obtener por NIT
- `PUT /api/v1/providers/:id` — Actualizar por ID
- `PUT /api/v1/providers/nit/:nit` — Actualizar por NIT
- `DELETE /api/v1/providers/:id` — Eliminar por ID
- `DELETE /api/v1/providers/nit/:nit` — Eliminar por NIT

### Commerce — Lots
- `GET /api/v1/lots/:id` — Obtener lote por ID
- `GET /api/v1/lots/purchase/:idPurchase` — Lotes por compra

### Production Center — Devices
- `POST /api/v1/devices` — Crear dispositivo
- `GET /api/v1/devices` — Listar dispositivos
- `GET /api/v1/devices/:deveui` — Obtener por deveui
- `PUT /api/v1/devices/:deveui` — Actualizar dispositivo
- `DELETE /api/v1/devices/:id` — Eliminar dispositivo
- `POST /api/v1/devices/import` — Importar dispositivos (Excel)

### Production Center — Device Profiles
- `POST /api/v1/device-profiles` — Crear perfil
- `GET /api/v1/device-profiles` — Listar perfiles
- `GET /api/v1/device-profiles/:id` — Obtener por ID
- `PUT /api/v1/device-profiles/:id` — Actualizar perfil
- `DELETE /api/v1/device-profiles/:id` — Eliminar perfil

### Massive Events
- `POST /api/v1/massive-events` — Crear evento masivo
- `GET /api/v1/massive-events` — Listar eventos masivos
- `GET /api/v1/massive-events/:id` — Obtener por ID
- `GET /api/v1/massive-events/cattle/:id` — Ganado impactado
- `PUT /api/v1/massive-events/close/:id` — Cerrar evento masivo
- `POST /api/v1/massive-events/sync` — Sincronizar eventos offline

### Simple Events
- `POST /api/v1/simple-events` — Crear evento simple
- `GET /api/v1/simple-events/:id` — Obtener por ID
- `GET /api/v1/simple-events/by-massive-event/:idMassiveEvent` — Listar por evento masivo
- `GET /api/v1/simple-events/by-cattle/:id` — Ganado relacionado
- `PUT /api/v1/simple-events/:id` — Actualizar evento simple
- `POST /api/v1/simple-events/sync` — Sincronizar eventos offline

### Purchase Receptions
- `GET /api/v1/purchase-receptions/number-exists` — Verificar número
- `GET /api/v1/purchase-receptions/eartag-exists` — Verificar eartag
- `GET /api/v1/purchase-receptions/:idPurchase` — Buscar/crear recepción
- `GET /api/v1/purchase-receptions/search-devices/by-query` — Buscar dispositivos
- `POST /api/v1/purchase-receptions/receive-cattle` — Recibir ganado
- `PATCH /api/v1/purchase-receptions/assign-lot-cattle` — Asignar lote
- `GET /api/v1/purchase-receptions/next-number/:number` — Siguiente número
- `PATCH /api/v1/purchase-receptions/purchase-status/:id` — Actualizar estado compra
- `PUT /api/v1/purchase-receptions/update-simple-event/:id` — Actualizar evento simple

## 7) Entidades principales

**Employee Management**
- User, Role, Tenant, Module, RoleModulePermission

**Farm**
- Cattle, Brand, Location, Color, Characteristic, CattleCharacteristic
- CattleWeightHistory, CattleMedicationHistory, CattleEartagHistory, CattleDeviceHistory

**Commerce**
- Purchase, Sale, SaleDetail, Provider, Contact, Lot

**Production Center**
- Device, DeviceProfile

**Massive Events**
- MassiveEvent, SimpleEvent, AnimalSimpleEvent

**Purchase Receptions**
- PurchaseReception

**Configurations**
- Configuration

## 8) DTOs y validaciones

El backend usa DTOs con `class-validator` / `class-transformer` para:
- Creación (`Create*Dto`)
- Actualización (`Update*Dto`)
- Sincronización offline (`Sync*Dto`)
- Consultas (`*QueryDto`)
- Respuestas (`*ResponseDto`)

`ValidationPipe` está habilitado globalmente en `main.ts`.

## 9) Integraciones y utilidades

- **ChirpStack**: integración LoRaWAN
- **MQTT**: publicación de eventos IoT
- **Excel**: importación de ganado/dispositivos
- **Multer**: carga de archivos

## 10) Notas de operación

- El acceso a recursos suele estar protegido por JWT y permisos.
- Swagger muestra detalles de esquemas y validaciones.

