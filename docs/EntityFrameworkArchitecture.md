# Entity Framework Architecture

## 🎯 Overview

El nuevo **Entity Framework** proporciona una arquitectura extensible y modular para crear entidades complejas y únicas. Está diseñado para reemplazar el código específico de Resources con un sistema genérico que puede manejar cualquier tipo de entidad futura.

## 🏗️ Architecture Layers

### 1. **Core Traits** (`src/core/traits.ts`)

Interfaces modulares que las entidades pueden implementar:

```typescript
interface Renderable<T>    // Renderizado de UI
interface Chattable<T>     // Integración con chat
interface Validateable<T>  // Validación de datos
interface Syncable<T>      // Sincronización
interface Manageable<T>    // Operaciones CRUD
```

### 2. **Entity Framework** (`src/core/entity-framework.ts`)

Implementaciones genéricas de los traits:

```typescript
EntityTemplateRenderer<T>; // Renderizado configurable
EntityChatIntegration<T>; // Chat configurable
EntityValidator<T>; // Validación configurable
EntityFactory; // Factory para crear instancias
```

### 3. **Entity Configuration** (`src/entities/`)

Configuraciones específicas por entidad:

```typescript
resourceConfig; // Configuración para Resources
patrolConfig; // Ejemplo para Patrullas (futuro)
// Más configuraciones según necesidad
```

## 🔧 How It Works

### Entity Configuration System

Cada entidad tiene una configuración que define:

```typescript
interface EntityConfig<T> {
  entityType: string; // Tipo de entidad
  displayName: string; // Nombre para mostrar
  pluralName: string; // Nombre plural

  renderer?: EntityRenderer<T>; // Cómo renderizar
  chatIntegration?: ChatIntegration<T>; // Cómo enviar al chat
  validator?: EntityValidator<T>; // Cómo validar
  manager?: EntityManagerConfig; // Cómo almacenar
  extensions?: EntityExtension<T>[]; // Comportamientos únicos
}
```

### Field Renderers

Definen cómo renderizar campos específicos:

```typescript
const quantityRenderer: FieldRenderer<Resource> = {
  render: (value: number) => html` <span class="resource-quantity">Cantidad: ${value}</span> `,
  validate: (value: any) => typeof value === 'number' && value >= 0,
};
```

### Entity Extensions

Para comportamientos únicos y complejos:

```typescript
const statCalculationExtension: EntityExtension<Patrol> = {
  name: 'statCalculation',
  priority: 1,
  canHandle: (entity) => !!entity.organizationId,
  extend: async (entity) => {
    // Lógica compleja para calcular stats derivadas
    return enhancedEntity;
  },
};
```

## 🚀 Usage Examples

### Creating a New Entity Type

1. **Define the entity interface** (in `types/entities.ts`):

```typescript
interface MyEntity extends BaseEntity {
  specialField: string;
  complexData: MyComplexType;
}
```

2. **Create entity configuration** (`entities/my-entity-config.ts`):

```typescript
export const myEntityConfig: EntityConfig<MyEntity> = {
  entityType: 'my-entity',
  displayName: 'Mi Entidad',
  pluralName: 'Mis Entidades',

  renderer: {
    fieldRenderers: new Map([
      ['specialField', mySpecialRenderer],
      ['complexData', myComplexRenderer],
    ]),
    defaultActions: myActions,
  },

  chatIntegration: {
    chatTemplate: generateMyChatTemplate,
  },

  validator: {
    rules: myValidationRules,
  },

  extensions: [myUniqueExtension],
};
```

3. **Create template class** (`ui/MyEntityTemplate.ts`):

```typescript
export class MyEntityTemplate {
  private static renderer = EntityFactory.createRenderer(myEntityConfig);
  private static chatIntegration = EntityFactory.createChatIntegration(myEntityConfig);

  static renderItem(entity: MyEntity, options = {}) {
    return this.renderer.renderItem(entity, options);
  }

  static sendToChat(entity: MyEntity, context = {}) {
    return this.chatIntegration.sendToChat(entity, context);
  }
}
```

### Complex Entity Example

Ver `src/entities/patrol-config.example.ts` para un ejemplo completo de una entidad compleja con:

- ✅ Renderizado custom de stats complejos
- ✅ Múltiples acciones específicas
- ✅ Validación avanzada
- ✅ Extensions para cálculos automáticos
- ✅ Template overrides
- ✅ Chat integration rica

## 🎨 Key Benefits

### **🔄 Reusability**

- Los traits se pueden reutilizar en cualquier entidad
- El framework maneja la lógica común automáticamente

### **🎯 Flexibility**

- Cada entidad puede implementar solo los traits que necesita
- Extensions permiten comportamientos únicos sin afectar el core

### **📈 Scalability**

- Fácil añadir nuevas entidades sin duplicar código
- El sistema crece orgánicamente con nuevas necesidades

### **🛡️ Type Safety**

- Todo está tipado con TypeScript
- IntelliSense completo en configuraciones

### **🧪 Testability**

- Cada componente es independiente y testeable
- Mocking fácil para tests unitarios

## 🔄 Migration Strategy

### Phase 1: ✅ Foundation (Completed)

- ✅ Core traits definidos
- ✅ Entity framework implementado
- ✅ Resource configuration creada
- ✅ ResourceTemplate refactorizado

### Phase 2: 🔄 Resource Migration (Current)

- 🔄 Migrar ResourceManager
- 🔄 Migrar AddOrEditResourceDialog
- 🔄 Actualizar tests existentes

### Phase 3: 🚀 Future Entities

- 🚀 Implementar Patrol usando el framework
- 🚀 Implementar GuardOrganization
- 🚀 Implementar Reputation
- 🚀 Implementar Effects

## 🎪 Real World Usage

### Current: Resource Template

```typescript
// Before (hardcoded)
static renderResourceItem(resourceId: string, options = {}) {
  // 100+ lines of hardcoded HTML generation
}

// After (configurable)
static renderResourceItem(resourceId: string, options = {}) {
  const resourceData = this.getResourceData(resourceId);
  const renderOptions = this.convertOptions(options);
  return this.renderer.renderItem(resourceData, renderOptions);
}
```

### Future: Any Entity

```typescript
// Patrol (complex)
PatrolTemplate.renderItem(patrol, { showStats: true, showEffects: true });

// Effect (simple)
EffectTemplate.renderItem(effect, { compact: true });

// Organization (very complex)
OrganizationTemplate.renderItem(org, {
  showResources: true,
  showPatrols: true,
  expandStats: true,
});
```

## 🧩 Extension Points

El sistema está diseñado para ser extensible en múltiples niveles:

### **Template Level**

- Custom field renderers
- Template overrides
- Action customization

### **Behavior Level**

- Entity extensions
- Validation customization
- Chat integration hooks

### **Storage Level**

- Custom managers
- Sync strategies
- Conflict resolution

---

**Esta arquitectura prepara el módulo para cualquier entidad futura, por compleja que sea, manteniendo consistencia y reutilización de código.**
