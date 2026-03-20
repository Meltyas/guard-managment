# Migration Plan: Actor Flags → Game Settings

## Objetivo
Migrar todo el almacenamiento de datos de actor flags a `game.settings` para evitar conflictos con validación de Daggerheart y mejorar sincronización automática.

## Managers a Migrar

### ✅ OfficerManager - COMPLETADO
- **Estado**: Ya migrado a `game.settings`
- **Setting**: `'guard-management', 'officers'`
- **onChange**: Recarga datos automáticamente

### 🔄 PatrolManager - EN PROCESO
**Cambios necesarios**:

1. **Eliminar métodos basados en actores**:
   - `findOrgActor()` - Ya no necesario
   - `persistToActor()` → `persistToSettings()`
   - `loadFromActor()` → `loadFromSettings()`

2. **Actualizar queueSave()**:
   ```typescript
   private queueSave(): void {
     if (this.saveTimer) clearTimeout(this.saveTimer);
     this.saveTimer = setTimeout(() => {
       this.saveTimer = null;
       this.persistToSettings().catch((e) =>
         console.warn('PatrolManager | persistToSettings failed:', e)
       );
     }, this.saveDelay);
   }
   ```

3. **Nuevo persistToSettings()**:
   ```typescript
   private async persistToSettings(): Promise<void> {
     const user = game?.user as any;
     if (!user?.isGM) {
       console.warn('PatrolManager | Only GM can save patrols');
       return;
     }

     const data = this.getAll();
     await game?.settings?.set('guard-management', 'patrols', data);
     console.log(`PatrolManager | Saved ${data.length} patrols to settings`);
   }
   ```

4. **Nuevo loadFromSettings()**:
   ```typescript
   public async loadFromSettings(): Promise<void> {
     const stored = game?.settings?.get('guard-management', 'patrols') as any[];
     if (Array.isArray(stored)) {
       this.patrols.clear();
       for (const p of stored) {
         // Deserializar fechas
         if (p.createdAt && typeof p.createdAt === 'string') 
           p.createdAt = new Date(p.createdAt);
         if (p.updatedAt && typeof p.updatedAt === 'string') 
           p.updatedAt = new Date(p.updatedAt);
         
         this.patrols.set(p.id, p);
       }
       console.log(`PatrolManager | Loaded ${stored.length} patrols from settings`);
     }
   }
   ```

5. **Actualizar initialize()**:
   ```typescript
   async initialize() {
     await this.loadFromSettings();
   }
   ```

6. **Eliminar lógica de retry**: Ya no es necesaria sin actores

### 🔄 GuardOrganizationManager - PENDIENTE
**Cambios necesarios**:

1. **Actualizar saveToActorFallback()**:
   - Renombrar a `saveToSettings()`
   - Eliminar lógica de actor
   - Usar `game.settings.set('guard-management', 'guardOrganization', this.organization)`

2. **Actualizar loadFromActorFallback()**:
   - Renombrar a `loadFromSettings()`
   - Cargar desde `game.settings.get('guard-management', 'guardOrganization')`

3. **Verificar dependencias**:
   - PatrolManager debe estar migrado primero
   - Eliminar llamadas a `persistToActor()` de PatrolManager

## Settings Requeridos

```typescript
// settings.ts - Ya agregados

// Patrols
game?.settings?.register('guard-management', 'patrols', {
  name: 'Patrols Data',
  scope: 'world',
  config: false,
  type: Array,
  default: [],
  onChange: (value) => {
    const gm = (window as any).GuardManagement;
    if (gm?.patrolManager) {
      gm.patrolManager.loadFromSettings?.();
    }
  },
});

// Guard Organization  
game?.settings?.register('guard-management', 'guardOrganization', {
  name: 'Guard Organization Data',
  scope: 'world',
  config: false,
  type: Object,
  default: null,
  onChange: (value) => {
    const gm = (window as any).GuardManagement;
    if (gm?.guardOrganizationManager) {
      gm.guardOrganizationManager.loadFromSettings?.();
    }
  },
});
```

## Beneficios

1. **✅ Sin conflictos con Daggerheart**: No más errores de validación
2. **✅ Sincronización automática**: `onChange` sincroniza entre GM y Players
3. **✅ Mismo patrón**: Consistente con OfficerManager (ya funcionando)
4. **✅ Simplicidad**: Sin retry logic, sin findOrgActor, sin creación de actores
5. **✅ Compatibilidad**: Mismo patrón que Party Resources (probado y funcional)

## Orden de Implementación

1. ✅ Officers - Completado
2. ✅ Patrols - Completado
3. ⬜ GuardOrganization - Pendiente (usa settings pero también tiene fallback a actor)

## Testing

Después de cada migración:
1. GM crea/edita entidad → Verifica que persiste
2. Player abre interfaz → Verifica sincronización automática
3. F5 en ambos lados → Verifica que datos persisten
4. Múltiples tabs como GM → Verifica sincronización entre tabs
