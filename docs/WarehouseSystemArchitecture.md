# Sistema de Warehouse Genérico

## Resumen

Hemos refactorizado el sistema de recursos para crear una arquitectura genérica que permite manejar diferentes tipos de entidades similares a los recursos. Cada tipo puede tener sus propios dialogs personalizados mientras mantiene la estructura común del warehouse y la integración con el guard info.

## Arquitectura

### Componentes Principales

1. **BaseWarehouseItem** (`types/warehouse.ts`)
   - Interfaz base para todos los items del warehouse
   - Extiende BaseEntity con propiedades comunes

2. **BaseWarehouseManager** (`managers/BaseWarehouseManager.ts`)
   - Manager genérico para manejar cualquier tipo de item
   - Proporciona CRUD básico, validación y templates

3. **BaseWarehouseItemDialog** (`dialogs/BaseWarehouseItemDialog.ts`)
   - Dialog base genérico (opcional de usar)
   - Cada entidad puede tener su propio dialog personalizado

4. **WarehouseItemFactory** (`managers/WarehouseItemFactory.ts`)
   - Registry central para todos los tipos de warehouse items
   - Maneja la inicialización y acceso a managers

5. **WarehouseSystem** (`systems/WarehouseSystem.ts`)
   - Sistema principal que coordina todo
   - Maneja eventos, chat messages y actualización de UI

## Tipos de Entidades Incluidas

### 1. Enhanced Resources (Recursos Mejorados)

- **Archivo**: `entities/EnhancedResource.ts`
- **Características**:
  - Cantidad, categoría, rareza, valor
  - Dialog personalizado para crear/editar
  - Categorías: Armas, Armaduras, Suministros, etc.
  - Rarezas: Común, Poco Común, Raro, Legendario

### 2. Contacts (Contactos)

- **Archivo**: `entities/Contact.ts`
- **Características**:
  - Relación, influencia, facción, especialidades
  - Dialog personalizado con campos específicos
  - Seguimiento de última interacción
  - Gestión de red de contactos

## Cómo Crear Una Nueva Entidad

### Paso 1: Definir la Interfaz

```typescript
// entities/MiNuevaEntidad.ts
import { BaseWarehouseItem } from '../types/warehouse';

export interface MiNuevaEntidad extends BaseWarehouseItem {
  propiedadEspecifica: string;
  otraPropiedad: number;
  // ... más propiedades específicas
}
```

### Paso 2: Crear la Configuración del Tipo

```typescript
export const MI_ENTIDAD_TYPE: WarehouseItemType<MiNuevaEntidad> = {
  category: {
    id: 'mi-entidad',
    name: 'Mi Entidad',
    icon: '🎯',
    description: 'Descripción de mi entidad',
    singularName: 'Entidad',
    pluralName: 'Entidades',
  },

  createNew: () => ({
    propiedadEspecifica: '',
    otraPropiedad: 0,
  }),

  validate: (data) => {
    // Lógica de validación
  },

  renderInfo: (item) => {
    // HTML para mostrar en guard info
  },

  renderChatMessage: (item, action) => {
    // HTML para mensajes de chat
  },
};
```

### Paso 3: Crear el Manager

```typescript
export class MiEntidadManager extends BaseWarehouseManager<MiNuevaEntidad> {
  constructor() {
    super(MI_ENTIDAD_TYPE);
  }

  protected async loadData(): Promise<void> {
    // Cargar desde storage de Foundry
  }

  protected async saveData(): Promise<void> {
    // Guardar en storage de Foundry
  }

  // Métodos específicos de la entidad...
}
```

### Paso 4: Crear el Dialog Personalizado

```typescript
export class MiEntidadDialog extends BaseWarehouseItemDialog<MiNuevaEntidad> {
  public static async show(item?: MiNuevaEntidad): Promise<MiNuevaEntidad | null> {
    const config = {
      title: item ? 'Editar Mi Entidad' : 'Nueva Mi Entidad',
      renderContent: async (entidad?: MiNuevaEntidad) => {
        return `
          <form>
            <!-- Tu HTML personalizado aquí -->
          </form>
        `;
      },

      handleSubmit: async (formData, entidad?) => {
        // Lógica de submit personalizada
      },
    };

    const dialog = new MiEntidadDialog(config, item);
    return dialog.show();
  }
}
```

### Paso 5: Registrar en el Sistema

```typescript
// En WarehouseSystem.ts initialize()
this.factory.registerType('mi-entidad', {
  type: MI_ENTIDAD_TYPE,
  manager: new MiEntidadManager(),
  dialogConfig: {
    /* config básico */
  },
});
```

## Uso del Sistema

### Inicialización

```typescript
import { initializeWarehouseSystem } from './systems/WarehouseSystem';

// En hooks.ts o main.ts
await initializeWarehouseSystem();
```

### Crear/Editar Items

```typescript
import { getWarehouseSystem } from './systems/WarehouseSystem';

const warehouse = getWarehouseSystem();

// Crear nuevo
await warehouse.showCreateDialog('resources', organizationId);

// Editar existente
await warehouse.showEditDialog('contacts', contactId);
```

### Obtener Datos

```typescript
// Todos los items de una organización
const allItems = warehouse.getAllItemsForOrganization(orgId);

// Estadísticas por categoría
const summary = warehouse.getOrganizationSummary(orgId);

// Para mostrar en guard info
const rendered = warehouse.renderAllItemsForGuardInfo(orgId);
```

## Ventajas del Sistema

1. **Reutilización**: Código común compartido entre entidades
2. **Flexibilidad**: Cada entidad puede tener su dialog personalizado
3. **Escalabilidad**: Fácil agregar nuevos tipos de entidades
4. **Consistencia**: Misma estructura para warehouse, guard info, chat
5. **Eventos**: Sistema unificado de eventos para todas las entidades
6. **Templates**: Sistema de templates para crear items predefinidos

## Integración con el Sistema Existente

- **GMWarehouseDialog**: Actualizar para mostrar todas las categorías
- **GuardOrganizationDialog**: Integrar con `warehouse.renderAllItemsForGuardInfo()`
- **Chat Messages**: Automático a través del sistema de eventos
- **Storage**: Cada manager maneja su propio storage en Foundry

## Migración desde Recursos Antiguos

El sistema actual de recursos puede coexistir con el nuevo sistema. Para migrar:

1. Los recursos antiguos siguen funcionando
2. Los nuevos recursos usan `EnhancedResource`
3. Gradualmente migrar datos del sistema antiguo al nuevo
4. Eventualmente deprecar el sistema antiguo

## Notas de Implementación

- Cada entidad mantiene su propio storage separado en Foundry settings
- Los dialogs son completamente independientes y personalizables
- El sistema de eventos permite integración loose-coupled
- Los templates permiten crear items predefinidos por el GM
- Validación centralizada pero customizable por entidad
