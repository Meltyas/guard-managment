# Sistema Unificado de Templates de Resources

## Resumen

Se ha implementado un sistema unificado para renderizar resources que garantiza que el diseño HTML y CSS sea exactamente el mismo tanto en Guild Info como en Chat, eliminando cualquier duplicación de código.

## Arquitectura

### ResourceTemplate.ts

- **Ubicación**: `src/ui/ResourceTemplate.ts`
- **Función**: Componente centralizado que maneja todo el rendering de resources
- **Métodos principales**:
  - `renderResourceItem()`: Render para UI (guild info, warehouse)
  - `generateResourceChatHTML()`: Render para chat (mismo diseño, HTML estático)
  - `sendResourceToChat()`: Función unificada para enviar al chat

### Opciones de Configuración

```typescript
interface ResourceTemplateOptions {
  showActions?: boolean; // Mostrar botones de editar/remover
  showSendToChat?: boolean; // Mostrar botón de enviar al chat
  compact?: boolean; // Versión compacta
  organizationId?: string; // ID de organización para contexto
}
```

## Implementación en Guild Info (CustomInfoDialog)

### Cambios Realizados

1. **Import del ResourceTemplate**: Se importó la nueva clase unificada
2. **Refactorización de renderResourceItemTemplate()**: Ahora usa `ResourceTemplate.renderResourceItem()`
3. **Botón "Enviar al Chat"**: Agregado automáticamente cuando `showSendToChat: true`
4. **Event Handler**: Nuevo manejador para `.send-to-chat-btn`

### Configuración

```typescript
ResourceTemplate.renderResourceItem(resourceId, {
  showActions: true, // Botones editar/remover
  showSendToChat: true, // Botón enviar al chat
  organizationId: this.currentOrganization?.id || '',
});
```

## Implementación en GM Warehouse (GMWarehouseDialog)

### Cambios Realizados

1. **Import del ResourceTemplate**: Se importó la nueva clase
2. **Botón en Template**: Agregado botón "Enviar al Chat" en `renderResourceTemplate()`
3. **Event Handler**: Nuevo manejador para `.send-to-chat-template-btn`
4. **Método handleSendTemplateToChat()**: Maneja el envío desde warehouse

### Configuración

```typescript
// En el template HTML del warehouse
<button
  type="button"
  class="send-to-chat-template-btn"
  title="Enviar al chat"
  data-resource-id="${resourceData.id}"
>
  <i class="fas fa-comment"></i>
</button>
```

## Chat Message Rendering

### HTML Exacto

El HTML generado para el chat es **idéntico** al usado en Guild Info:

- Misma estructura de divs
- Mismas clases CSS
- Misma información mostrada
- Mismo diseño visual

### CSS Unificado

Los estilos CSS están en `custom-info-dialog.css` bajo la sección `/* ==== CHAT MESSAGE STYLES ==== */`:

```css
.guard-resource-chat {
  /* Mismos estilos base que .resource-item */
}

.guard-resource-chat .resource-item {
  /* Estructura idéntica a guild info */
}
```

## Botones y Estilos

### Guild Info Buttons

- **Enviar al Chat**: Verde (`#2ecc71`)
- **Editar**: Azul (`#4488ff`)
- **Remover**: Rojo (`#ff4444`)

### Warehouse Buttons

- **Enviar al Chat**: Verde (`#2ecc71`)
- **Editar**: Azul (`#3498db`)
- **Duplicar**: Naranja (`#f39c12`)
- **Eliminar**: Rojo (`#e74c3c`)

## Flujo de Funcionamiento

### Desde Guild Info

1. Usuario hace clic en botón "Enviar al Chat" 🔘
2. Se ejecuta `handleSendResourceToChat()`
3. Se llama a `ResourceTemplate.sendResourceToChat()`
4. Se genera HTML con `generateResourceChatHTML()`
5. Se crea ChatMessage con el HTML generado 💬

### Desde Warehouse

1. Usuario hace clic en botón "Enviar al Chat" 🔘
2. Se ejecuta `handleSendTemplateToChat()`
3. Se llama a `ResourceTemplate.sendResourceToChat()` con "GM Warehouse" como origen
4. Mismo proceso de generación y envío 💬

## Ventajas del Sistema Unificado

1. **Cero Duplicación**: Un solo lugar define el diseño
2. **Mantenimiento Simplificado**: Cambios en un lugar afectan ambos
3. **Consistencia Garantizada**: Imposible que sean diferentes
4. **Extensibilidad**: Fácil agregar nuevas opciones de renderizado
5. **Reutilización**: Mismo componente para cualquier lugar que necesite mostrar resources

## Uso en Desarrollo

### Para agregar resources en nuevos componentes:

```typescript
import { ResourceTemplate } from '../ui/ResourceTemplate.js';

// En render method
const resourceHTML = ResourceTemplate.renderResourceItem(resourceId, {
  showActions: false,
  showSendToChat: true,
  compact: true,
});
```

### Para enviar al chat desde cualquier lugar:

```typescript
await ResourceTemplate.sendResourceToChat(resourceId, 'Nombre Origen');
```

## Archivos Modificados

- ✅ `src/ui/ResourceTemplate.ts` (NUEVO)
- ✅ `src/ui/CustomInfoDialog.ts` (ACTUALIZADO)
- ✅ `src/dialogs/GMWarehouseDialog.ts` (ACTUALIZADO)
- ✅ `src/styles/custom-info-dialog.css` (ESTILOS CHAT)
- ✅ `src/styles/gm-warehouse.css` (BOTÓN WAREHOUSE)

## Testing

Para probar que funciona correctamente:

1. **Guild Info**: Abrir una organización → Verificar botón "Enviar al Chat" en resources
2. **Warehouse**: Abrir GM Warehouse → Verificar botón "Enviar al Chat" en templates
3. **Chat**: Verificar que los resources enviados se ven idénticos a guild info
4. **Consistencia**: Cambiar CSS y verificar que afecta ambos lugares
