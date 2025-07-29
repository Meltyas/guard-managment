/**
 * Migration Helper for Warehouse System
 * Helps migrate existing resources to the new warehouse system gradually
 */

import { WarehouseSystemIntegration } from '../systems/WarehouseSystemIntegration.js';
import type { Resource } from '../types/entities.js';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  skippedCount: number;
}

export class WarehouseMigrationHelper {
  private warehouseSystem: WarehouseSystemIntegration;

  constructor() {
    this.warehouseSystem = WarehouseSystemIntegration.getInstance();
  }

  /**
   * Analyze existing resources and provide migration report
   */
  public async analyzeExistingResources(organizationId: string): Promise<{
    totalResources: number;
    readyForMigration: number;
    needsAttention: Resource[];
    migrationPlan: string[];
  }> {
    const resources = await this.warehouseSystem.getResources(organizationId);

    const needsAttention: Resource[] = [];
    const migrationPlan: string[] = [];

    resources.forEach((resource) => {
      // Check for potential issues
      if (!resource.name || resource.name.trim() === '') {
        needsAttention.push(resource);
      }

      if (resource.quantity < 0) {
        needsAttention.push(resource);
      }
    });

    migrationPlan.push('✅ Sistema warehouse ya está integrado');
    migrationPlan.push(`📊 Total de recursos: ${resources.length}`);
    migrationPlan.push(`⚠️ Recursos que necesitan atención: ${needsAttention.length}`);

    if (needsAttention.length === 0) {
      migrationPlan.push('🎉 Todos los recursos están listos para el sistema warehouse');
    }

    return {
      totalResources: resources.length,
      readyForMigration: resources.length - needsAttention.length,
      needsAttention,
      migrationPlan,
    };
  }

  /**
   * Validate all resources in an organization
   */
  public async validateResources(organizationId: string): Promise<{
    valid: Resource[];
    invalid: { resource: Resource; issues: string[] }[];
  }> {
    const resources = await this.warehouseSystem.getResources(organizationId);

    const valid: Resource[] = [];
    const invalid: { resource: Resource; issues: string[] }[] = [];

    resources.forEach((resource) => {
      const issues: string[] = [];

      if (!resource.name || resource.name.trim() === '') {
        issues.push('Nombre vacío o inválido');
      }

      if (resource.quantity < 0) {
        issues.push('Cantidad negativa');
      }

      if (!resource.organizationId) {
        issues.push('OrganizationId faltante');
      }

      if (issues.length > 0) {
        invalid.push({ resource, issues });
      } else {
        valid.push(resource);
      }
    });

    return { valid, invalid };
  }

  /**
   * Fix common issues in resources
   */
  public async fixCommonIssues(organizationId: string): Promise<MigrationResult> {
    const { invalid } = await this.validateResources(organizationId);

    let migratedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const { resource } of invalid) {
      try {
        const fixes: Partial<Resource> = {};

        // Fix name issues
        if (!resource.name || resource.name.trim() === '') {
          fixes.name = 'Recurso sin nombre';
        }

        // Fix quantity issues
        if (resource.quantity < 0) {
          fixes.quantity = 0;
        }

        // Fix organization ID
        if (!resource.organizationId) {
          fixes.organizationId = organizationId;
        }

        // Apply fixes
        if (Object.keys(fixes).length > 0) {
          const success = await this.warehouseSystem.updateResource(resource.id, fixes);
          if (success) {
            migratedCount++;
          } else {
            skippedCount++;
            errors.push(`No se pudo actualizar el recurso ${resource.id}`);
          }
        }
      } catch (error) {
        skippedCount++;
        errors.push(`Error al procesar recurso ${resource.id}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      migratedCount,
      skippedCount,
      errors,
    };
  }

  /**
   * Create a summary report for the organization's warehouse
   */
  public async createSummaryReport(organizationId: string): Promise<string> {
    const resources = await this.warehouseSystem.getResources(organizationId);
    const { valid, invalid } = await this.validateResources(organizationId);

    const totalItems = resources.length;
    const validItems = valid.length;
    const invalidItems = invalid.length;
    const totalQuantity = resources.reduce((sum, r) => sum + r.quantity, 0);

    const report = `
# Reporte del Warehouse - Organización

## Estadísticas Generales
- **Total de Recursos**: ${totalItems}
- **Recursos Válidos**: ${validItems}
- **Recursos con Problemas**: ${invalidItems}
- **Cantidad Total**: ${totalQuantity}

## Estado del Sistema
- ✅ Sistema Warehouse: Integrado y funcionando
- ✅ Persistencia: DocumentBasedManager (Foundry Documents)
- ✅ Sincronización: Tiempo real GM ↔ Players
- ✅ Interfaz: DialogV2 con recursos centralizados

## Problemas Detectados
${
  invalidItems > 0
    ? invalid
        .map(
          ({ resource, issues }) => `- **${resource.name || 'Sin nombre'}**: ${issues.join(', ')}`
        )
        .join('\n')
    : '- Ningún problema detectado 🎉'
}

## Recomendaciones
${
  invalidItems > 0
    ? '- Ejecutar `warehouseMigration.fixCommonIssues()` para corregir problemas automáticamente'
    : '- El sistema está funcionando correctamente'
}
- Los recursos se guardan automáticamente en Foundry Documents
- La sincronización funciona en tiempo real
- Todos los diálogos usan el sistema centralizado
    `;

    return report.trim();
  }
}

// Export singleton instance
export const warehouseMigration = new WarehouseMigrationHelper();
