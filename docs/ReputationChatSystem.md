# Sistema de Chat para Reputaciones

## Resumen

Se ha implementado la funcionalidad de "Enviar al Chat" para el sistema de Reputaciones, replicando exactamente la misma funcionalidad que tienen los Resources. El diseño HTML y CSS es idéntico entre Guild Info y Chat, garantizando consistencia visual completa.

## Arquitectura

### ReputationTemplate.ts

- **Ubicación**: `src/ui/ReputationTemplate.ts`
- **Función**: Componente centralizado que maneja todo el rendering de reputaciones
- **Métodos principales**:
  - `renderReputationItem()`: Render para UI (guild info, warehouse)
  - `generateReputationChatHTML()`: Render para chat (mismo diseño, HTML estático)
  - `sendReputationToChat()`: Función unificada para enviar al chat

### Opciones de Configuración

```typescript
interface ReputationTemplateOptions {
  showActions?: boolean; // Mostrar botones de editar/remover
  showSendToChat?: boolean; // Mostrar botón de enviar al chat
  compact?: boolean; // Versión compacta
  organizationId?: string; // ID de organización para contexto
}
```

## Implementación en Guild Info (CustomInfoDialog)

### Cambios Realizados

1. **Event Handler**: Agregado soporte para `data-reputation-id` en `.send-to-chat-btn`
2. **Método handleSendReputationToChat()**: Nuevo método para manejar envío de reputaciones
3. **Botón "Enviar al Chat"**: Ya existía automáticamente cuando `showSendToChat: true` en ReputationTemplate

### Configuración

```typescript
ReputationTemplate.renderReputationItem(reputationId, {
  showActions: true, // Botones editar/remover
  showSendToChat: true, // Botón enviar al chat
  organizationId: this.currentOrganization?.id || '',
});
```

### Event Handler

```typescript
// En el event handler de CustomInfoDialog
const sendToChatBtn = target.closest('.send-to-chat-btn') as HTMLElement;
if (sendToChatBtn) {
  const resourceId = sendToChatBtn.getAttribute('data-resource-id');
  const reputationId = sendToChatBtn.getAttribute('data-reputation-id');

  if (resourceId) {
    this.handleSendResourceToChat(resourceId, organizationId);
  } else if (reputationId) {
    this.handleSendReputationToChat(reputationId, organizationId);
  }
}
```

## Implementación en GM Warehouse (GMWarehouseDialog)

### Cambios Realizados

1. **Import del ReputationTemplate**: Se importó la nueva clase
2. **Implementación de handleSendReputationTemplateToChat()**: Método ya existía pero era placeholder
3. **Event Handler**: Ya existía y funcionaba correctamente

### Configuración

```typescript
// En el template HTML del warehouse (ya existía)
<button
  type="button"
  class="send-to-chat-template-btn"
  title="Enviar al chat"
  data-reputation-id="${reputationData.id}"
>
  <i class="fas fa-comment"></i>
</button>
```

### Implementación del método

```typescript
private async handleSendReputationTemplateToChat(reputationId: string): Promise<void> {
  await ReputationTemplate.sendReputationToChat(reputationId, 'GM Warehouse');
  // Notificación de éxito
}
```

## Chat Message Rendering

### HTML Exacto

El HTML generado para el chat es **idéntico** al usado en Guild Info:

- Misma estructura de divs
- Mismas clases CSS
- Misma información mostrada
- Mismo diseño visual
- Nombre de organización sin prefijo "Desde:"

### CSS Unificado

Los estilos CSS están en `custom-info-dialog.css` bajo la sección específica para reputaciones:

```css
.guard-reputation-chat {
  /* Mismos estilos base que .guard-resource-chat */
}

.guard-reputation-chat .reputation-item {
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
2. Se ejecuta `handleSendReputationToChat()`
3. Se llama a `ReputationTemplate.sendReputationToChat()`
4. Se genera HTML con `generateReputationChatHTML()`
5. Se crea ChatMessage con el HTML generado 💬

### Desde Warehouse

1. Usuario hace clic en botón "Enviar al Chat" 🔘
2. Se ejecuta `handleSendReputationTemplateToChat()`
3. Se llama a `ReputationTemplate.sendReputationToChat()` sin organización de origen
4. Mismo proceso de generación y envío 💬

## Ventajas del Sistema Unificado

1. **Cero Duplicación**: Un solo lugar define el diseño
2. **Mantenimiento Simplificado**: Cambios en un lugar afectan ambos
3. **Consistencia Garantizada**: Imposible que sean diferentes
4. **Extensibilidad**: Fácil agregar nuevas opciones de renderizado
5. **Reutilización**: Mismo componente para cualquier lugar que necesite mostrar reputaciones

## Uso en Desarrollo

### Para agregar reputaciones en nuevos componentes:

```typescript
import { ReputationTemplate } from '../ui/ReputationTemplate.js';

// En render method
const reputationHTML = ReputationTemplate.renderReputationItem(reputationId, {
  showActions: false,
  showSendToChat: true,
  compact: true,
});
```

### Para enviar al chat desde cualquier lugar:

```typescript
await ReputationTemplate.sendReputationToChat(reputationId, 'Nombre Origen');
```

## Archivos Modificados

- ✅ `src/ui/ReputationTemplate.ts` (YA EXISTÍA - sin cambios)
- ✅ `src/ui/CustomInfoDialog.ts` (ACTUALIZADO - event handler y método)
- ✅ `src/dialogs/GMWarehouseDialog.ts` (ACTUALIZADO - import y método)
- ✅ `src/styles/custom-info-dialog.css` (ACTUALIZADO - estilos chat)

## Testing

Para probar que funciona correctamente:

1. **Guild Info**: Abrir una organización → Verificar botón "Enviar al Chat" en reputaciones
2. **Warehouse**: Abrir GM Warehouse → Verificar botón "Enviar al Chat" en reputation templates
3. **Chat**: Verificar que las reputaciones enviadas se ven idénticas a guild info
4. **Consistencia**: Cambiar CSS y verificar que afecta ambos lugares

## Comparación con Resources

| Funcionalidad                     | Resources | Reputations |
| --------------------------------- | --------- | ----------- |
| **Send to Chat desde Guild Info** | ✅        | ✅          |
| **Send to Chat desde Warehouse**  | ✅        | ✅          |
| **HTML/CSS idéntico**             | ✅        | ✅          |
| **Event handling**                | ✅        | ✅          |
| **Notificaciones**                | ✅        | ✅          |
| **Organization context**          | ✅        | ✅          |

## Implementación Completa

**Esta implementación está COMPLETA y tiene paridad funcional 1:1 con el sistema de Resources para el chat.**

Todas las funcionalidades de chat que tiene el sistema de Resources han sido implementadas en el sistema de Reputation, garantizando:

1. **Consistencia Visual**: Diseño idéntico entre recursos y reputaciones
2. **Consistencia Funcional**: Mismos botones, mismo comportamiento
3. **Consistencia Técnica**: Mismo código base, misma arquitectura
4. **Facilidad de Mantenimiento**: Un cambio en CSS afecta ambos sistemas
