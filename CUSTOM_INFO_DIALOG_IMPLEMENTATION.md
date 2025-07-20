# Diálogo de Información Personalizado (CustomInfoDialog)

## Implementación Completada

He creado un diálogo HTML personalizado completamente funcional que **NO usa** el sistema de diálogos de Foundry, siendo totalmente independiente y personalizable.

## ✨ Características Principales

### 🎯 Funcionalidad Core

- **Completamente Personalizado**: HTML, CSS y JavaScript puro
- **Movible**: Se puede arrastrar por toda la pantalla
- **Redimensionable**: Esquina inferior derecha para redimensionar
- **Responsive**: Tamaño mínimo y máximo configurables
- **Persistente**: Permanece abierto durante las operaciones de edición

### 🎨 Interfaz de Usuario

- **Header Draggable**: Barra superior para mover el diálogo
- **Botones de Control**:
  - Botón "Editar" (azul) con ícono de edición
  - Botón "Cerrar" (rojo) con ícono de X
- **Contenido Rico**: Información detallada de la organización con estilos personalizados
- **Animaciones**: Hover effects y transiciones suaves

### 🛠 Funcionalidades Técnicas

- **Event Management**: Manejo completo de eventos de mouse y teclado
- **Boundary Checking**: No se puede mover fuera de la pantalla
- **Memory Management**: Limpieza automática de event listeners
- **Callback System**: Callbacks para edición y cierre
- **Dynamic Updates**: Contenido y título actualizables en tiempo real

## 📁 Archivos Creados/Modificados

### 1. `src/ui/CustomInfoDialog.ts` (NUEVO)

```typescript
export class CustomInfoDialog {
  // Diálogo HTML personalizado movible y redimensionable
  // NO usa Dialog ni DialogV2 de Foundry
}
```

**Características**:

- Clase completamente independiente
- Sistema de drag & drop personalizado
- Resize handle en esquina inferior derecha
- Inyección de estilos CSS dinámicos
- Manejo de eventos completo

### 2. `GuardDialogManager.ts` (MODIFICADO)

```typescript
private customInfoDialog: CustomInfoDialog | null = null;

private async showOrganizationInfoDialog(organization: GuardOrganization) {
  // Usa CustomInfoDialog en lugar de DialogV2
  this.customInfoDialog = new CustomInfoDialog();
  // ...
}
```

**Cambios**:

- Importa `CustomInfoDialog`
- Reemplaza `DialogV2.wait()` con `CustomInfoDialog.show()`
- Mantiene referencia para updates dinámicos
- Cleanup automático en `cleanup()`

### 3. `GuardOrganizationDialog.ts` (LIMPIADO)

- Eliminadas modificaciones de "non-closing dialog"
- Vuelto a usar DialogV2 simple para edición
- DialogV2 se reserva SOLO para operaciones CRUD

## 🎯 Flujo de Usuario Actualizado

### Flujo Nuevo

1. **Ver Información**: Click en "Ver Organización" → CustomInfoDialog abierto
2. **Editar**: Click en botón "Editar" → DialogV2 para edición
3. **Actualización**: Después de editar → CustomInfoDialog se actualiza automáticamente
4. **Persistencia**: CustomInfoDialog permanece abierto durante toda la operación

### Flujo Técnico

```typescript
// 1. Mostrar información
customInfoDialog.show(title, content, {
  onEdit: async () => {
    // 2. Abrir edición (DialogV2)
    const updated = await showEditOrganizationDialog();

    // 3. Actualizar contenido sin cerrar
    if (updated) {
      customInfoDialog.updateTitle(newTitle);
      customInfoDialog.updateContent(newContent);
    }
  },
});
```

## 🎨 Estilos y Diseño

### Tema Visual

- **Colores**: Gradientes oscuros con acentos azules
- **Tipografía**: Roboto, colores contrastados
- **Animaciones**: Transiciones suaves, hover effects
- **Iconografía**: FontAwesome icons para acciones

### Layout Responsive

- **Grid System**: Información organizada en grids
- **Stat Boxes**: Estadísticas en cajas visuales destacadas
- **Info Sections**: Secciones claramente delimitadas
- **Metadata**: Información técnica en footer discreto

## 🔧 Configuración y Uso

### Uso Básico

```typescript
const dialog = new CustomInfoDialog();
dialog.show(title, content, {
  width: 600,
  height: 500,
  onEdit: () => {
    /* callback */
  },
  onClose: () => {
    /* callback */
  },
});
```

### Métodos Principales

- `show()`: Mostrar diálogo con opciones
- `updateContent()`: Actualizar contenido dinámicamente
- `updateTitle()`: Actualizar título
- `close()`: Cerrar y limpiar
- `isOpen()`: Check si está abierto

## 💡 Ventajas de esta Implementación

### 1. **Control Total**

- No dependemos de limitaciones de DialogV2
- Personalización completa de estilos y comportamiento
- Event handling optimizado

### 2. **UX Superior**

- Información siempre visible durante edición
- Updates dinámicos sin reabrir diálogos
- Interacción más natural y fluida

### 3. **Separación de Responsabilidades**

- CustomInfoDialog: Información y visualización
- DialogV2: Operaciones CRUD y formularios
- Cada uno optimizado para su propósito

### 4. **Performance**

- Event listeners optimizados
- Memory management automático
- CSS inyectado una sola vez

## 🚀 Resultado Final

Ahora tenemos:

- ✅ Diálogo de información **totalmente personalizado**
- ✅ **Movible y redimensionable**
- ✅ **Permanece abierto** durante edición
- ✅ **Actualización automática** del contenido
- ✅ DialogV2 **reservado solo para CRUD**
- ✅ **UX fluida** y profesional

El sistema funciona perfectamente y cumple todos los requisitos solicitados.
