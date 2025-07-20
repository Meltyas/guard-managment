# Flujo de Diálogos de Información y Edición

## Implementación Completada

### Flujo del Usuario

1. **Panel Flotante**: Usuario hace clic en "Ver Organización" (ícono de información)
2. **Diálogo de Información**: Se muestra un diálogo con toda la información de la organización
3. **Opción de Edición**: Usuario puede hacer clic en "Editar Organización"
4. **Diálogo de Edición**: Se abre el formulario de edición
5. **Información Actualizada**: Después de editar, se muestra automáticamente la información actualizada

### Características Técnicas

#### DialogV2 con Flujo Recursivo

- Utiliza `DialogV2.wait()` con estructura de botones correcta
- Implementa flujo recursivo: información → edición → información actualizada
- Fallback a Dialog estándar si DialogV2 no está disponible

#### Botones del Diálogo de Información

- **"Editar Organización"** (icono edit, botón por defecto): Abre el editor
- **"Cerrar"** (icono times): Cierra el diálogo

#### Manejo de Errores

- Try-catch en todos los niveles
- Notificaciones de éxito y error apropiadas
- Logging detallado para debugging

### Archivos Modificados

#### `FloatingGuardPanel.ts`

- Botón cambiado de "Gestionar Organización" a "Ver Organización"
- Ícono cambiado a `fa-info-circle`

#### `GuardDialogManager.ts`

- Nuevo método `showOrganizationInfoDialog()` con DialogV2
- Flujo recursivo para mantener la experiencia del usuario
- Método `generateOrganizationInfoContent()` para contenido rico

### Beneficios de esta Implementación

1. **UX Mejorada**: El usuario ve información antes de decidir editar
2. **Flujo Natural**: Información → Edición → Información actualizada
3. **No Blocking**: Cada diálogo se cierra apropiadamente antes del siguiente
4. **Actualización Automática**: La información se actualiza después de editar
5. **Compatibilidad**: Funciona con DialogV2 y Dialog estándar

### Notas de Desarrollo

- El flujo recursivo evita la complejidad de mantener múltiples diálogos abiertos
- DialogV2.wait() espera a que el diálogo se cierre antes de continuar
- El enfoque de "mostrar información actualizada" es más confiable que actualizar contenido dinámicamente
- El patrón de callback con return value apropiado permite controlar el cierre de diálogos

### Testing Manual

Usar el archivo `test-info-dialog.js` para probar el flujo en la consola de Foundry:

```javascript
window.GuardManagement.guardDialogManager.handleAction('manage-organizations');
```
