# Migración de Settings a Custom Sub-Types

## Resumen de Cambios

Esta migración reemplaza completamente el sistema basado en Settings por Custom Sub-Types de Foundry VTT, eliminando todos los problemas de permisos y sincronización.

## Arquitectura Nueva

### Custom Sub-Types Definidos

1. **Actor Sub-Types:**
   - `guard-management.guard-organization`: Organizaciones de guardias
   - `guard-management.patrol`: Patrullas

2. **Item Sub-Types:**
   - `guard-management.guard-resource`: Recursos de la organización
   - `guard-management.guard-reputation`: Reputación con facciones

### DataModels Creados

- `GuardOrganizationModel`: Maneja stats base, modificadores, recursos, reputación y patrullas
- `PatrolModel`: Maneja líder, número de unidades, modificadores personalizados y efectos
- `GuardResourceModel`: Maneja descripción, cantidad y organización asociada
- `GuardReputationModel`: Maneja niveles de reputación y bonificadores

### Managers Actualizados

- `DocumentBasedManager`: Reemplaza todos los managers basados en Settings
- `SimpleGuardDialogManager`: UI simplificada para gestionar las entidades

## Beneficios de la Migración

### 1. **Permisos Nativos**

- ✅ Los documentos de Foundry tienen sistema de permisos robusto
- ✅ GM y jugadores pueden tener acceso granular por documento
- ✅ No hay problemas de restricciones de Settings

### 2. **Sincronización Automática**

- ✅ Foundry maneja toda la sincronización entre clientes
- ✅ No necesitamos SyncManager complejo
- ✅ Real-time updates automáticos

### 3. **Integración Nativa**

- ✅ Drag & Drop entre documentos
- ✅ Search/Filter integrado
- ✅ Folder organization gratis
- ✅ Export/Import con el mundo

### 4. **UI Mejorada**

- ✅ Aparece en las listas nativas de Actors/Items
- ✅ Sheets personalizables en el futuro
- ✅ Compatibilidad con otros módulos

## Estructura de Datos

### Guard Organization (Actor)

```typescript
{
  name: string,
  type: "guard-management.guard-organization",
  system: {
    subtitle: string,
    baseStats: {
      robustismo: number,
      analitica: number,
      subterfugio: number,
      elocuencia: number
    },
    activeModifiers: string[],  // IDs de modificadores
    resources: string[],        // IDs de recursos
    reputation: string[],       // IDs de reputación
    patrols: string[],         // IDs de patrullas
    version: number
  }
}
```

### Patrol (Actor)

```typescript
{
  name: string,
  type: "guard-management.patrol",
  system: {
    leaderId: string,
    unitCount: number,
    organizationId: string,
    customModifiers: StatModification[],
    activeEffects: string[],
    status: "idle" | "deployed" | "recalled",
    version: number
  }
}
```

### Guard Resource (Item)

```typescript
{
  name: string,
  type: "guard-management.guard-resource",
  system: {
    description: string,
    quantity: number,
    organizationId: string,
    version: number
  }
}
```

### Guard Reputation (Item)

```typescript
{
  name: string,
  type: "guard-management.guard-reputation",
  system: {
    description: string,
    level: ReputationLevel, // 1-7
    organizationId: string,
    version: number
  }
}
```

## Funcionalidades Disponibles

### DocumentBasedManager

- ✅ CRUD completo para todas las entidades
- ✅ Relaciones entre documentos mantenidas automáticamente
- ✅ Hooks para updates en tiempo real
- ✅ Cleanup automático al eliminar organizaciones

### SimpleGuardDialogManager

- ✅ Gestión de organizaciones con UI simple
- ✅ Gestión de patrullas por organización
- ✅ Creación de datos de ejemplo
- ✅ Edición básica de stats y propiedades

## APIs Disponibles

### Acceso Global

```javascript
const gm = window.GuardManagement;

// Crear organización
const org = await gm.documentManager.createGuardOrganization({
  name: 'City Watch',
  subtitle: 'Protectors of the Realm',
});

// Crear patrulla
const patrol = await gm.documentManager.createPatrol({
  name: 'Alpha Squad',
  organizationId: org.id,
  unitCount: 4,
});

// Mostrar UI de gestión
await gm.guardDialogManager.showManageOrganizationsDialog();
```

### Hooks Disponibles

```javascript
// Escuchar cambios en documentos
window.addEventListener('guard-document-updated', (event) => {
  console.log('Document updated:', event.detail);
});

window.addEventListener('guard-document-created', (event) => {
  console.log('Document created:', event.detail);
});

window.addEventListener('guard-document-deleted', (event) => {
  console.log('Document deleted:', event.detail);
});
```

## Siguiente Pasos

1. **Sheets Personalizadas**: Crear sheets específicas para cada sub-type
2. **Drag & Drop**: Implementar drag & drop entre organizaciones y patrullas
3. **Efectos Avanzados**: Sistema de efectos temporales
4. **Integración con Actores**: Conectar líderes de patrulla con Actors existentes
5. **Migración de Datos**: Tool para migrar datos existentes de Settings

## Archivos Eliminados/Deprecados

Los siguientes archivos ya no son necesarios:

- `GuardManager.ts` (reemplazado por DocumentBasedManager)
- `GuardOrganizationManager.ts` (reemplazado por DocumentBasedManager)
- `LocalStorageManager.ts` (no necesario)
- `ReputationManager.ts` (integrado en DocumentBasedManager)
- `ResourceManager.ts` (integrado en DocumentBasedManager)
- La mayoría de `settings.ts` (solo queda configuración básica)

## Tests Pendientes

- [ ] Test de creación de documentos
- [ ] Test de relaciones entre entidades
- [ ] Test de permisos
- [ ] Test de sincronización
- [ ] Test de UI
