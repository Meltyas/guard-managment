# Integración de Chat Estilo Daggerheart

## Resumen

Se ha integrado el estilo visual de Daggerheart en los mensajes de chat para recursos y reputaciones. Esta implementación adapta la estructura HTML del sistema base de Daggerheart para mantener consistencia visual sin crear archivos CSS adicionales.

## Implementación

### Estructura HTML Daggerheart (Adaptada)

Los mensajes de chat ahora utilizan la siguiente estructura HTML, adaptada del sistema Daggerheart pero con los tags en el footer:

```html
<div class="message-content">
  <div class="daggerheart chat domain-card">
    <img class="card-img" src="..." />
    <details class="domain-card-move" open>
      <summary class="domain-card-header">
        <div class="domain-label">
          <h2 class="title">Título</h2>
        </div>
        <i class="fa-solid fa-chevron-down"></i>
      </summary>
      <div class="description"><p>Descripción...</p></div>
    </details>
    <footer class="ability-card-footer">
      <ul class="tags">
        <li class="tag">Etiqueta 1</li>
        <li class="tag">Etiqueta 2</li>
      </ul>
    </footer>
  </div>
</div>
```

### ResourceTemplate.ts

El método `generateResourceChatHTML()` ha sido modificado para generar HTML con la estructura de Daggerheart, pero con los tags en el footer:

```typescript
// Use Daggerheart structure but with our resource content
return `
  <div class="message-content">
    <div class="daggerheart chat domain-card">
      <img class="card-img" src="${resourceData.image || 'icons/commodities/metal/ingot-stack-silver.webp'}">
      <details class="domain-card-move" open>
        <summary class="domain-card-header">
          <div class="domain-label">
            <h2 class="title">${resourceData.name}</h2>
          </div>
          <i class="fa-solid fa-chevron-down"></i>
        </summary>
        <div class="description">
          ${resourceData.description ? `<p>${resourceData.description.trim()}</p>` : ''}
        </div>
      </details>
      <footer class="ability-card-footer">
        <ul class="tags">
              <li class="tag">Recurso</li>
              <li class="tag">Cantidad: ${resourceData.quantity}</li>
            </ul>
          </div>
          <i class="fa-solid fa-chevron-down"></i>
        </summary>
        <div class="description">
          ${resourceData.description ? `<p>${resourceData.description.trim()}</p>` : ''}
        </div>
      </details>
      <footer class="ability-card-footer">
        <button class="ability-use-button" id="resource-${resourceId}">
          Usar Recurso
        </button>
      </footer>
    </div>
  </div>
`;
```

### ReputationTemplate.ts

El método `generateReputationChatHTML()` también ha sido modificado:

```typescript
// Use Daggerheart structure but with our reputation content
return `
  <div class="message-content">
    <div class="daggerheart chat domain-card">
      <img class="card-img" src="${reputationData.image || 'icons/skills/social/diplomacy-handshake-yellow.webp'}">
      <details class="domain-card-move" open>
        <summary class="domain-card-header">
          <div class="domain-label">
            <h2 class="title">${reputationData.name}</h2>
            <ul class="tags">
              <li class="tag">Reputación</li>
              <li class="tag">Nivel: ${levelLabel}</li>
            </ul>
          </div>
          <i class="fa-solid fa-chevron-down"></i>
        </summary>
        <div class="description">
          ${reputationData.description ? `<p>${reputationData.description.trim()}</p>` : ''}
        </div>
      </details>
      <footer class="ability-card-footer">
        <button class="ability-use-button" id="reputation-${reputationId}">
          Usar Reputación
        </button>
      </footer>
    </div>
  </div>
`;
```

## Ventajas de la Implementación

1. **Consistencia Visual**: Los mensajes de chat ahora se verán consistentes con el sistema Daggerheart
2. **Sin Archivos CSS Adicionales**: No se requieren archivos CSS personalizados
3. **Imágenes por Defecto**: Se proporcionan imágenes por defecto cuando un recurso o reputación no tiene imagen
4. **Estructura Expandible/Colapsable**: Los usuarios pueden expandir/colapsar detalles para ver la descripción
5. **Tags en Footer**: Mejor visualización de la información clave en el footer

## Funcionalidades Futuras

- Añadir animaciones o efectos visuales al interactuar con recursos/reputaciones desde el chat
- Expandir el sistema a otras entidades como patrullas y organizaciones
- Permitir arrastrar y soltar recursos/reputaciones desde el chat a otras interfaces
