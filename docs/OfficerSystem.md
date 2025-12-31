# Sistema de Oficiales - Guard Management

## Descripción General

El sistema de oficiales permite crear y gestionar oficiales para las patrullas con las siguientes características:

- **Actor Asignado**: Cada oficial se vincula a un Actor de Foundry mediante drag & drop
- **Título Personalizado**: Ej: Capitán, Sargento, Comandante
- **Pros y Cons**: Listas de características positivas y negativas con texto rico
- **Drag & Drop**: Asignar oficiales a patrullas arrastrándolos desde el warehouse

## Arquitectura

### Componentes Principales

1. **OfficerManager** (`src/managers/OfficerManager.ts`)
   - Gestión CRUD de oficiales
   - Accesible vía `window.GuardManagement.officerManager`

2. **AddOrEditOfficerDialog** (`src/dialogs/AddOrEditOfficerDialog.ts`)
   - Dialog para crear/editar oficiales
   - Soporte para drag & drop de Actors
   - Gestión de pros y cons

3. **OfficerWarehouseDialog** (`src/dialogs/OfficerWarehouseDialog.ts`)
   - Almacén central de oficiales
   - Vista de todos los oficiales creados
   - Drag & drop para asignar a patrullas

### Tipos TypeScript

```typescript
// src/types/officer.ts
interface Officer extends BaseEntity {
  actorId: string;
  actorName: string;
  actorImg?: string;
  title: string;
  pros: OfficerTrait[];
  cons: OfficerTrait[];
  organizationId?: string;
}

interface OfficerTrait {
  id: string;
  title: string;
  description: string; // Rich text
  createdAt: Date;
}
```

### Integración con Patrols

```typescript
// src/types/entities.ts
interface Patrol extends BaseEntity {
  officerId: string | null; // Reference to Officer entity
  officer: PatrolOfficer | null; // Legacy actor-based
  // ... resto de campos
}
```

## Uso Programático

### Crear un Oficial

```typescript
const gm = window.GuardManagement;

// Mostrar dialog de creación
const newOfficer = await AddOrEditOfficerDialog.create();

// O crear directamente
const officer = gm.officerManager.create({
  actorId: 'actor-id',
  actorName: 'Nombre del Actor',
  actorImg: 'path/to/image.png',
  title: 'Capitán',
  pros: [
    { title: 'Valiente', description: 'Nunca se rinde en combate' },
    { title: 'Estratega', description: 'Planifica con cuidado' },
  ],
  cons: [{ title: 'Impulsivo', description: 'A veces actúa sin pensar' }],
});
```

### Editar un Oficial

```typescript
const gm = window.GuardManagement;
const officer = gm.officerManager.get('officer-id');

// Mostrar dialog de edición
const updated = await AddOrEditOfficerDialog.edit(officer);

// O actualizar directamente
gm.officerManager.update('officer-id', {
  title: 'Nuevo Título',
  pros: [...], // Array actualizado
  cons: [...]
});
```

### Asignar Oficial a Patrulla

```typescript
const gm = window.GuardManagement;
const patrolManager = gm.guardOrganizationManager.getPatrolManager();

// Asignar oficial por ID
patrolManager.assignOfficerById('patrol-id', 'officer-id');

// O remover oficial
patrolManager.assignOfficerById('patrol-id', null);
```

### Mostrar Warehouse de Oficiales

```typescript
// Mostrar warehouse
await OfficerWarehouseDialog.show();
```

## UI/UX

### Drag & Drop

El sistema soporta dos tipos de drag & drop:

1. **Actor → Officer Dialog**: Arrastra un Actor desde el sidebar al área de drop del dialog para asignarlo
2. **Officer → Patrol**: Arrastra un oficial desde el warehouse a la zona de oficial de una patrulla

### Estilos CSS

Todos los estilos están en `src/styles/officers.css`:

- `.officer-form`: Formulario principal
- `.officer-actor-dropzone`: Zona de drop para actors
- `.officer-traits-section`: Grid de pros/cons
- `.officer-warehouse-dialog`: Warehouse de oficiales
- `.officer-card`: Tarjeta individual de oficial

### Templates Handlebars

- `templates/dialogs/add-edit-officer.hbs`: Formulario principal
- `templates/dialogs/add-edit-trait.hbs`: Dialog para agregar pros/cons
- `templates/dialogs/officer-warehouse.hbs`: Vista del warehouse

## Internacionalización

Las traducciones están en:

- `lang/en.json`: Inglés
- `lang/es.json`: Español

Claves principales:

- `officer.title.label`
- `officer.pros.label`
- `officer.cons.label`
- `officer.create`
- `officer.warehouse`

## Persistencia

Los oficiales se almacenan en memoria en el `OfficerManager`. Para persistir:

1. Exportar: `gm.officerManager.export()`
2. Importar: `gm.officerManager.load(officers)`

**TODO**: Integrar con DocumentBasedManager para persistencia automática en Foundry.

## Ejemplos de Uso

### Ejemplo 1: Crear Oficial desde Código

```typescript
const gm = window.GuardManagement;

const officer = gm.officerManager.create({
  actorId: 'npc-captain-id',
  actorName: 'Capitán Marcus',
  actorImg: 'icons/svg/mystery-man.svg',
  title: 'Capitán de la Guardia',
  pros: [
    { title: 'Líder Natural', description: 'Inspira confianza en sus tropas' },
    { title: 'Veterano', description: '20 años de experiencia en combate' },
  ],
  cons: [{ title: 'Cicatrices', description: 'Las heridas del pasado le afectan' }],
  organizationId: 'org-id-123',
});

console.log('Officer created:', officer);
```

### Ejemplo 2: Workflow Completo UI

```typescript
// 1. Usuario abre el warehouse
await OfficerWarehouseDialog.show();

// 2. Usuario hace clic en "Nuevo Oficial"
// 3. Se abre AddOrEditOfficerDialog
// 4. Usuario arrastra un Actor al dialog
// 5. Usuario ingresa título
// 6. Usuario agrega pros y cons
// 7. Usuario guarda
// 8. El oficial aparece en el warehouse

// 9. Usuario arrastra el oficial a una patrulla
// 10. La patrulla muestra el oficial asignado con avatar y título
```

## Testing

### Tests Manuales

1. Crear oficial sin actor → debe dar error
2. Crear oficial con actor → debe funcionar
3. Agregar pros y cons → deben aparecer en la lista
4. Remover pros y cons → deben desaparecer
5. Editar oficial → los cambios deben persistir
6. Arrastrar oficial a patrulla → debe asignarse
7. Ver oficial en patrulla → debe mostrar avatar y título

### Tests Unitarios (TODO)

```typescript
// src/tests/managers/OfficerManager.test.ts
describe('OfficerManager', () => {
  it('should create officer', () => {
    // ...
  });

  it('should update officer', () => {
    // ...
  });

  it('should delete officer', () => {
    // ...
  });
});
```

## Roadmap

### Fase 1: MVP (Completado)

- ✅ Modelo de datos TypeScript
- ✅ OfficerManager CRUD
- ✅ AddOrEditOfficerDialog
- ✅ OfficerWarehouseDialog
- ✅ Integración con Patrols
- ✅ Drag & Drop
- ✅ Estilos CSS
- ✅ Traducciones

### Fase 2: Persistencia (TODO)

- ⬜ Integrar con DocumentBasedManager
- ⬜ Persistencia en Foundry Documents
- ⬜ Sincronización entre clientes

### Fase 3: Características Avanzadas (TODO)

- ⬜ Búsqueda y filtrado de oficiales
- ⬜ Categorías de oficiales
- ⬜ Templates de oficiales
- ⬜ Importar/exportar oficiales
- ⬜ Historia de cambios

### Fase 4: Efectos de Oficiales (TODO)

- ⬜ Los pros/cons afectan stats de patrulla
- ⬜ Sistema de bonificaciones
- ⬜ Progresión de oficiales
- ⬜ Experiencia y niveles

## Troubleshooting

### El oficial no se muestra en la patrulla

Verificar:

1. `patrol.officerId` tiene un valor válido
2. El oficial existe en `gm.officerManager.get(officerId)`
3. El componente PatrolsComponent está re-renderizando

### El drag & drop no funciona

Verificar:

1. El elemento tiene `draggable="true"`
2. Los event handlers están correctamente attached
3. El `dataTransfer` contiene el tipo correcto (`type: 'Officer'`)

### Los estilos no se aplican

Verificar:

1. `officers.css` está importado en `main.ts`
2. Las clases CSS coinciden con los templates
3. No hay conflictos con otros estilos

## Referencias

- [Foundry VTT V13 API](https://foundryvtt.com/api/)
- [DialogV2 Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.DialogV2.html)
- [Handlebars Templates](https://handlebarsjs.com/)
