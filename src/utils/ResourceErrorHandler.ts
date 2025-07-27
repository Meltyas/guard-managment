/**
 * Resource Error Handler
 * Provides consistent error handling across all resource operations
 */

export class ResourceErrorHandler {
  /**
   * Wrap async operations with consistent error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string,
    userMessage?: string,
    showSuccessNotification: boolean = false,
    successMessage?: string
  ): Promise<T | null> {
    try {
      const result = await operation();

      if (showSuccessNotification && successMessage && ui?.notifications) {
        ui.notifications.info(successMessage);
      }

      return result;
    } catch (error) {
      console.error(`${context}:`, error);

      const errorMessage = userMessage || this.getDefaultErrorMessage(context);
      if (ui?.notifications) {
        ui.notifications.error(errorMessage);
      }

      return null;
    }
  }

  /**
   * Handle resource operation errors with specific context
   */
  static async handleResourceOperation<T>(
    operation: () => Promise<T>,
    operationType: 'create' | 'read' | 'update' | 'delete',
    resourceName?: string
  ): Promise<T | null> {
    const context = `ResourceErrorHandler | ${operationType.toUpperCase()} operation`;
    const resourceLabel = resourceName ? `"${resourceName}"` : 'recurso';

    const userMessages = {
      create: `Error al crear el ${resourceLabel}`,
      read: `Error al cargar el ${resourceLabel}`,
      update: `Error al actualizar el ${resourceLabel}`,
      delete: `Error al eliminar el ${resourceLabel}`,
    };

    const successMessages = {
      create: `${resourceLabel} creado exitosamente`,
      read: `${resourceLabel} cargado`,
      update: `${resourceLabel} actualizado exitosamente`,
      delete: `${resourceLabel} eliminado exitosamente`,
    };

    return this.withErrorHandling(
      operation,
      context,
      userMessages[operationType],
      operationType !== 'read', // Don't show success for read operations
      successMessages[operationType]
    );
  }

  /**
   * Handle dialog operations with specific error handling
   */
  static async handleDialogOperation<T>(
    operation: () => Promise<T>,
    dialogType: string,
    action: string = 'operation'
  ): Promise<T | null> {
    const context = `ResourceErrorHandler | ${dialogType} Dialog ${action}`;
    const userMessage = `Error en el diálogo de ${dialogType.toLowerCase()}`;

    return this.withErrorHandling(operation, context, userMessage);
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(
    field: string,
    value: any,
    requirement: string,
    form?: HTMLFormElement
  ): void {
    const message = `Campo "${field}": ${requirement}`;

    console.error(`ResourceErrorHandler | Validation error: ${message}`, {
      field,
      value,
      requirement,
    });

    if (ui?.notifications) {
      ui.notifications.warn(message);
    }

    // Highlight the field if form is provided
    if (form) {
      this.highlightField(form, field);
    }
  }

  /**
   * Handle permission errors
   */
  static handlePermissionError(operation: string, resourceType: string = 'recurso'): void {
    const message = `No tienes permisos para ${operation} este ${resourceType}`;

    console.error(`ResourceErrorHandler | Permission error: ${message}`);

    if (ui?.notifications) {
      ui.notifications.warn(message);
    }
  }

  /**
   * Handle network/connection errors
   */
  static handleConnectionError(operation: string): void {
    const message = `Error de conexión durante: ${operation}`;

    console.error(`ResourceErrorHandler | Connection error: ${message}`);

    if (ui?.notifications) {
      ui.notifications.error(message);
    }
  }

  /**
   * Log structured error information for debugging
   */
  static logError(context: string, error: Error, additionalData?: Record<string, any>): void {
    const errorInfo = {
      context,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    console.error('ResourceErrorHandler | Structured Error:', errorInfo);
  }

  /**
   * Get default error message based on context
   */
  private static getDefaultErrorMessage(context: string): string {
    if (context.includes('create') || context.includes('CREATE')) {
      return 'Error al crear el elemento';
    }
    if (context.includes('update') || context.includes('UPDATE')) {
      return 'Error al actualizar el elemento';
    }
    if (context.includes('delete') || context.includes('DELETE')) {
      return 'Error al eliminar el elemento';
    }
    if (context.includes('read') || context.includes('READ')) {
      return 'Error al cargar los datos';
    }

    return 'Ha ocurrido un error inesperado';
  }

  /**
   * Highlight form field with error styling
   */
  private static highlightField(form: HTMLFormElement, fieldName: string): void {
    const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`) as HTMLElement;

    if (field) {
      field.classList.add('error');
      field.style.borderColor = '#ff6b6b';

      // Remove highlight after 3 seconds
      setTimeout(() => {
        field.classList.remove('error');
        field.style.borderColor = '';
      }, 3000);
    }
  }

  /**
   * Create a user-friendly error message from technical error
   */
  static createUserFriendlyMessage(error: Error, operation: string): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return `Error de conexión durante ${operation}. Verifica tu conexión a internet.`;
    }

    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return `No tienes permisos para realizar esta operación: ${operation}`;
    }

    if (errorMessage.includes('not found')) {
      return `El elemento solicitado no fue encontrado durante ${operation}`;
    }

    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return `Los datos proporcionados no son válidos para ${operation}`;
    }

    // Generic fallback
    return `Error durante ${operation}. Consulta la consola para más detalles.`;
  }
}
