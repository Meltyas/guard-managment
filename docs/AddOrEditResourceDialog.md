# AddOrEditResourceDialog

Un dialog reutilizable basado en DialogV2 para crear y editar recursos en el módulo Guard Management.

## Características

- **DialogV2 Nativo**: Utiliza el sistema DialogV2 de Foundry VTT V13 para una experiencia consistente
- **Reutilizable**: Puede ser usado en cualquier parte del módulo
- **Fallback**: Incluye respaldo a Dialog estándar si DialogV2 no está disponible
- **Validación**: Validación completa de datos del formulario
- **TypeScript**: Completamente tipado para desarrollo seguro
- **Responsive**: Diseño adaptable para diferentes tamaños de pantalla

## Uso Básico

### Importar el Dialog

```typescript
import { AddOrEditResourceDialog } from '../dialogs/AddOrEditResourceDialog';
```

### Crear un Nuevo Recurso

```typescript
// Método estático conveniente
const newResource = await AddOrEditResourceDialog.create('organization-id');

if (newResource) {
  console.log('Recurso creado:', newResource);
  // Procesar el nuevo recurso...
}
```

### Editar un Recurso Existente

```typescript
// Método estático conveniente
const updatedResource = await AddOrEditResourceDialog.edit(existingResource);

if (updatedResource) {
  console.log('Recurso actualizado:', updatedResource);
  // Procesar el recurso actualizado...
}
```

### Uso Genérico

```typescript
// Método genérico con más control
const resource = await AddOrEditResourceDialog.show(
  'create', // o 'edit'
  'organization-id',
  existingResource // opcional para modo edit
);
```

## Tipos de Datos

### ResourceDialogData

```typescript
interface ResourceDialogData {
  name: string;
  description: string;
  quantity: number;
  organizationId: string;
}
```

### Resource (Entity)

```typescript
interface Resource extends BaseEntity {
  description: string;
  quantity: number;
  organizationId: string;
}
```

## Validación

El dialog incluye validación automática para:

- **Nombre**: Obligatorio, máximo 100 caracteres
- **Descripción**: Opcional, máximo 500 caracteres
- **Cantidad**: Número entero ≥ 0, máximo 999,999
- **Organization ID**: Obligatorio (pasado automáticamente)

## Ejemplos Avanzados

### Integración con Event Handlers

```typescript
// Manejar click en botón "Agregar Recurso"
async function onAddResourceClick(event: Event, organizationId: string) {
  event.preventDefault();

  const resource = await AddOrEditResourceDialog.create(organizationId);
  if (resource) {
    const gm = (window as any).GuardManagement;
    await gm.documentManager.createGuardResource(resource);
    ui.notifications.info(`Recurso "${resource.name}" creado`);
  }
}

// Manejar click en botón "Editar Recurso"
async function onEditResourceClick(event: Event, resource: Resource) {
  event.preventDefault();

  const updated = await AddOrEditResourceDialog.edit(resource);
  if (updated) {
    const gm = (window as any).GuardManagement;
    await gm.documentManager.updateGuardResource(resource.id, updated);
    ui.notifications.info(`Recurso "${updated.name}" actualizado`);
  }
}
```

### Validación Personalizada

```typescript
async function createResourceWithValidation(organizationId: string) {
  const resource = await AddOrEditResourceDialog.create(organizationId);

  if (resource) {
    // Validación personalizada
    if (resource.quantity > 1000) {
      ui.notifications.warn('Cantidad muy alta, considera dividir en lotes');
    }

    // Continuar con el procesamiento...
    return resource;
  }

  return null;
}
```

### Creación en Lote

```typescript
async function createMultipleResources(organizationId: string, count: number) {
  const resources: Resource[] = [];

  for (let i = 0; i < count; i++) {
    const resource = await AddOrEditResourceDialog.create(organizationId);
    if (resource) {
      resources.push(resource);
    } else {
      break; // Usuario canceló
    }
  }

  return resources;
}
```

## Características Técnicas

### DialogV2 Support

- Utiliza `foundry.applications.api.DialogV2.wait()` para máxima compatibilidad
- Manejo automático de formularios y callbacks
- Configuración modal y responsive

### Fallback Strategy

Si DialogV2 no está disponible:

- Detecta automáticamente la disponibilidad
- Cambia a Dialog estándar sin pérdida de funcionalidad
- Mantiene la misma API para el desarrollador

### Error Handling

- Validación completa del formulario
- Mensajes de error informativos
- Manejo seguro de `ui.notifications`
- Logging detallado para debugging

### Accessibility

- Labels correctos para screen readers
- Navegación por teclado
- Validación visual y programática
- Contraste adecuado para diferentes temas

## Estilos

Los estilos están definidos en `src/styles/resource-dialog.css` e incluyen:

- Variables CSS para temas claro/oscuro
- Diseño responsive
- Animaciones sutiles para mejor UX
- Estados de validación visual

## Testing

El dialog incluye tests comprehensivos en `src/tests/dialogs/AddOrEditResourceDialog.test.ts`:

- Tests unitarios para todos los métodos públicos
- Mocking de dependencias de Foundry
- Tests de validación
- Tests de integración con DialogV2

## Integración con el Módulo

### En Managers

```typescript
// En DocumentBasedManager
async createResource(organizationId: string): Promise<Resource | null> {
  const resource = await AddOrEditResourceDialog.create(organizationId);
  if (resource) {
    return this.createGuardResource(resource);
  }
  return null;
}
```

### En UI Components

```typescript
// En componentes UI
renderAddButton(organizationId: string) {
  return html`
    <button
      @click=${() => this.handleAddResource(organizationId)}
      class="btn btn-primary"
    >
      <i class="fas fa-plus"></i> Agregar Recurso
    </button>
  `;
}

async handleAddResource(organizationId: string) {
  const resource = await AddOrEditResourceDialog.create(organizationId);
  if (resource) {
    this.resources.push(resource);
    this.requestUpdate();
  }
}
```

## Próximas Mejoras

- [ ] Soporte para templates/plantillas de recursos
- [ ] Integración con drag & drop
- [ ] Búsqueda y filtrado de recursos existentes
- [ ] Validación de duplicados
- [ ] Soporte para categorías de recursos
- [ ] Historia de cambios (audit trail)

## Compatibilidad

- **Foundry VTT**: V13+
- **Sistema**: Foundryborne (Daggerheart)
- **Navegadores**: Chrome 90+, Firefox 88+, Safari 14+
- **TypeScript**: 5.3+
- **Node.js**: 20.11.0+
