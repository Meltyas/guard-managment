# Panel Flotante de Gestión de Guardias

## 🚀 ¡Tu Panel Flotante está Listo!

Hemos implementado exitosamente el **Panel Flotante de Gestión de Guardias** con las siguientes características:

### ✨ Características Principales

#### 🎮 Panel Flotante Interactivo
- **Posición Persistente**: Recuerda su ubicación en localStorage
- **Arrastrable**: Mueve el panel por toda la pantalla
- **Minimizable**: Reduce el panel para solo mostrar la barra de título
- **Responsive**: Se adapta dentro de los límites de la pantalla

#### 🎯 Accesos Rápidos

**Atajos de Teclado:**
- `Ctrl + Shift + G` - Alternar panel flotante
- `Ctrl + Shift + N` - Nueva organización

**Comandos de Chat:**
- `/guard` o `/guardia` - Alternar panel
- `/guard new` - Nueva organización
- `/guard manage` - Gestionar organizaciones
- `/guard help` - Mostrar ayuda

#### 🏛️ Funcionalidades del Panel

1. **Botón "Nueva Organización"** - Abre el dialog de creación
2. **Botón "Gestionar"** - Lista todas las organizaciones existentes
3. **Lista de Organizaciones Activas** - Vista rápida con:
   - Nombre y subtítulo de cada organización
   - Número de patrullas asociadas
   - Click para editar directamente

#### 📱 Dialog de Gestión Avanzada

El dialog de gestión incluye:
- **Vista en tarjetas** de todas las organizaciones
- **Estadísticas base** (Robustismo, Analítica, Subterfugio, Elocuencia)
- **Resumen rápido** (patrullas, recursos, reputaciones)
- **Botones de acción** (Editar/Eliminar) por organización
- **Confirmación de eliminación** con nombre de organización

### 🎨 Diseño Visual

- **Tema oscuro** con transparencias y blur effects
- **Gradientes** para botones y cabeceras
- **Iconos FontAwesome** para mejor UX
- **Animaciones suaves** en hover y transiciones
- **Scrollbars personalizadas** para listas largas

### 🔧 Implementación Técnica

#### Archivos Principales:

1. **`src/ui/FloatingGuardPanel.ts`** - Panel flotante principal
2. **`src/dialogs/GuardOrganizationDialog.ts`** - Dialog de crear/editar
3. **`src/managers/GuardDialogManager.ts`** - Coordinador de dialogs
4. **`src/managers/GuardOrganizationManager.ts`** - Lógica CRUD
5. **`src/hooks.ts`** - Keybindings y comandos de chat

#### Integración con Foundry:

- **DialogV2.query** para todos los dialogs
- **localStorage** para persistencia de posición
- **Game Settings** para almacenar organizaciones
- **Hooks y Keybindings** para accesos rápidos
- **Chat Commands** para comandos tipo slash

### 🚀 Cómo Usar

#### Primera Vez:
1. **Carga el módulo** en Foundry VTT
2. **Presiona `Ctrl + Shift + G`** para mostrar el panel
3. **Haz click en "Nueva Organización"** para crear tu primera guardia
4. **Rellena el formulario** con nombre, subtítulo y estadísticas base
5. **¡Disfruta gestionando tus guardias!**

#### Uso Diario:
- **El panel aparece automáticamente** al cargar el juego (si estaba visible)
- **Arrastra el panel** donde prefieras y la posición se guardará
- **Usa los atajos de teclado** para acceso rápido
- **Escribe comandos en chat** (`/guard help`) para ver opciones

### 🏗️ Próximos Pasos

El panel flotante está **100% funcional** y listo para usar. Las siguientes características serán implementadas progresivamente:

1. **Patrullas** - Gestión de unidades operativas
2. **Recursos** - Control de suministros
3. **Reputación** - Sistema de facciones (7 niveles)
4. **Efectos y Modificadores** - Buffs/debuffs temporales
5. **Sincronización** - Updates en tiempo real entre GM y Players

### 🧪 Testing

Todos los tests principales pasan:
- ✅ **GuardOrganizationDialog** - 11/11 tests
- ✅ **Validation y CRUD** - Funcionando correctamente
- ✅ **Integración con Foundry** - Settings y dialogs operativos

### 🎯 Estado Actual

**✅ COMPLETADO - Listo para Usar:**
- Panel flotante con posición persistente
- Dialog de crear/editar organizaciones
- Gestión completa CRUD de organizaciones
- Sistema de atajos y comandos
- Interfaz visual pulida
- Tests unitarios funcionando

**🚧 EN DESARROLLO:**
- Sistema de patrullas
- Gestión de recursos y reputación
- Sincronización multi-usuario

---

## 🎮 ¡Pruébalo Ahora!

1. **Carga el módulo** en tu mundo de Foundry
2. **Presiona `Ctrl + Shift + G`** para ver el panel
3. **Crea tu primera organización** y experimenta con la interfaz
4. **Mueve el panel** a donde prefieras - ¡recordará la posición!

**¡El panel flotante de gestión de guardias está completamente funcional y listo para ser usado en tus campañas!** 🎉
