/**
 * Custom Item class for Guard Management items
 * This prevents Daggerheart's DHItem from trying to process our custom types
 */

export class GuardItem extends Item {
  /**
   * Override _preCreate to bypass Daggerheart validation
   */
  protected async _preCreate(
    data: any,
    options: any,
    user: any
  ): Promise<boolean | void> {
    // Skip Daggerheart's validation for Guard Management types
    if (this.type.startsWith('guard-management.')) {
      console.log(`GuardItem | Bypassing Daggerheart validation for ${this.type}`);
      
      // Call the base Item class _preCreate (not Daggerheart's)
      return await super._preCreate(data, options, user);
    }
    
    // For non-Guard Management types, fall back to default behavior
    return await super._preCreate(data, options, user);
  }

  /**
   * Override prepareDerivedData to prevent Daggerheart errors
   */
  prepareDerivedData(): void {
    if (this.type.startsWith('guard-management.')) {
      // For Guard Management types, just prepare base data
      super.prepareDerivedData();
    } else {
      // For other types, use default preparation
      super.prepareDerivedData();
    }
  }
}
