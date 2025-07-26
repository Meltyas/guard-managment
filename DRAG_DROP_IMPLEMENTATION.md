# Drag & Drop de Recursos - Implementación Completa

## 🎯 Funcionalidad Implementada

Se ha implementado la funcionalidad completa de **drag & drop** para los recursos del módulo Guard Management. Ahora puedes arrastrar recursos desde el GM Warehouse y soltarlos en las organizaciones de guardias.

## ✨ Características

### 🏪 GM Warehouse (Origen)

- Los recursos del warehouse son **arrastrables** (`draggable="true"`)
- **Feedback visual** al iniciar el drag (opacidad reducida)
- **Tooltip** informativo al hacer hover
- **Datos de drag** incluyen toda la información del recurso

### 🏛️ Organizaciones (Destino)

- **Zona de drop** en la sección de recursos
- **Feedback visual** durante el drag over (borde verde punteado)
- **Mensaje de confirmación** al hacer drop
- **Validación** para evitar duplicados
- **Actualización automática** de la UI

### 📱 UI/UX

- **Estilos CSS** específicos para drag & drop
- **Animaciones suaves** para feedback visual
- **Mensajes de estado** con notificaciones de Foundry
- **Refresh automático** de la lista de recursos

## 🚀 Cómo Usar

1. **Abrir el GM Warehouse**

   ```javascript
   // En la consola de Foundry
   const warehouse = new GuardManagement.dialogs.GMWarehouseDialog();
   warehouse.show();
   ```

2. **Abrir una Organización**

   ```javascript
   // Abrir dialog de edición de organización
   GuardManagement.guardDialogManager.showManageOrganizationsDialog();
   ```

3. **Drag & Drop**
   - Arrastra cualquier recurso del warehouse
   - Suéltalo en la zona de recursos de la organización
   - El recurso aparecerá automáticamente en la lista

## 🔧 Implementación Técnica

### Estructura de Datos

```typescript
// Datos del drag
{
  type: 'guard-resource',
  resourceId: 'resource-uuid',
  resourceData: {
    id: 'resource-uuid',
    name: 'Nombre del Recurso',
    description: 'Descripción',
    quantity: 25,
    version: 1
  }
}
```

### Flujo de Asignación

1. **Drag Start**: Se capturan los datos del recurso
2. **Drag Over**: Se valida la zona de drop
3. **Drop**: Se asigna el recurso a la organización
4. **Update**: Se actualiza el documento de la organización
5. **Refresh**: Se actualiza la UI automáticamente

### Gestión de Estado

- **Recursos Compartidos**: Los recursos permanecen en el warehouse
- **Referencias**: Las organizaciones solo guardan IDs de recursos asignados
- **Sincronización**: Usa `DocumentBasedManager` para persistencia
- **Eventos**: Emite eventos personalizados para actualizaciones

## 📋 Métodos Principales

### GMWarehouseDialog

- `handleResourceDragStart()`: Inicia el drag con datos del recurso
- `handleResourceDragEnd()`: Restaura el estado visual

### GuardOrganizationDialog

- `handleDragOver()`: Previene comportamiento por defecto
- `handleDragEnter()`: Agrega feedback visual
- `handleDragLeave()`: Remueve feedback visual
- `handleDrop()`: Procesa el drop y asigna el recurso
- `assignResourceToOrganization()`: Lógica de asignación
- `refreshResourcesList()`: Actualiza la UI

### GuardOrganizationModel

- `addResource(resourceId)`: Agrega recurso a la organización
- `removeResource(resourceId)`: Remueve recurso de la organización

## 🎨 Estilos CSS

```css
/* Elementos arrastrables */
.resource-template[draggable='true'] {
  cursor: grab;
  transition: transform 0.2s ease;
}

/* Zonas de drop */
.drop-zone.drag-over {
  background-color: rgba(76, 175, 80, 0.1);
  border: 2px dashed #4caf50;
}

/* Feedback visual */
.drop-zone.drag-over::before {
  content: 'Suelta aquí para asignar el recurso';
  /* ... más estilos ... */
}
```

## 🧪 Testing

### Script de Prueba

Ejecuta en la consola de Foundry:

```javascript
// Cargar el script de prueba
await import('./test-drag-drop.js');

// Configurar entorno de prueba
testDragDropFeature();

// Monitorear eventos
setupDragDropMonitoring();

// Inspeccionar estado
inspectDragDropState();
```

### Casos de Prueba

1. **Drag & Drop Básico**
   - Arrastra un recurso del warehouse
   - Suéltalo en una organización
   - Verifica que aparece en la lista

2. **Prevención de Duplicados**
   - Intenta asignar el mismo recurso dos veces
   - Debe mostrar mensaje de advertencia

3. **Feedback Visual**
   - Verifica la opacidad durante el drag
   - Confirma el highlight de la zona de drop

4. **Actualización de UI**
   - La lista se actualiza automáticamente
   - Los botones de acción funcionan correctamente

## 🔮 Funcionalidades Adicionales

### Eventos Personalizados

```javascript
// Escuchar asignaciones de recursos
window.addEventListener('guard-resource-assigned', (event) => {
  console.log('Recurso asignado:', event.detail);
});
```

### Métodos de Gestión

```javascript
const gm = GuardManagement;

// Obtener recursos de una organización
const orgResources = gm.documentManager.getResourcesForOrganization(orgId);

// Obtener todos los recursos
const allResources = gm.documentManager.getGuardResources();

// Remover recurso de organización
await organization.system.removeResource(resourceId);
```

## ✅ Estado del Proyecto

- ✅ **Drag & Drop**: Completamente funcional
- ✅ **Estilos CSS**: Implementados y responsive
- ✅ **Validaciones**: Prevención de duplicados
- ✅ **UI Updates**: Refresh automático
- ✅ **Event System**: Eventos personalizados
- ✅ **Testing**: Scripts de prueba disponibles
- ✅ **Documentation**: Documentación completa

## 🐛 Troubleshooting

### Problema: No aparecen elementos draggables

**Solución**: Verificar que el GM Warehouse tiene recursos creados

### Problema: Drop no funciona

**Solución**: Asegurar que la organización está abierta en modo edición

### Problema: UI no se actualiza

**Solución**: Verificar que `setupResourceEventListeners()` se ejecuta

### Problema: Errores en consola

**Solución**: Verificar que `GuardManagement.documentManager` está disponible

---

**Estado**: ✅ **COMPLETADO Y FUNCIONAL**

El sistema de drag & drop está completamente implementado y listo para uso en producción.
