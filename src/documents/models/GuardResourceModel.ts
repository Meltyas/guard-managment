/**
 * DataModel for Guard Resource Item sub-type
 */

export class GuardResourceModel extends foundry.abstract.TypeDataModel {
  // Declare schema properties
  declare description: string;
  declare quantity: number;
  declare organizationId: string;
  declare version: number;

  // Derived properties
  declare isEmpty: boolean;
  declare isLow: boolean;

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      description: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
      }),

      quantity: new fields.NumberField({
        required: true,
        initial: 1,
        min: 0,
        integer: true,
      }),

      organizationId: new fields.StringField({
        required: true,
        blank: false,
        initial: '',
      }),

      version: new fields.NumberField({
        required: true,
        initial: 1,
        min: 1,
        integer: true,
      }),
    };
  }

  /**
   * Prepare base data for the resource
   */
  prepareBaseData() {
    // Ensure quantity is never negative
    if (this.quantity < 0) this.quantity = 0;
  }

  /**
   * Prepare derived data for the resource
   */
  prepareDerivedData() {
    // Calculate any derived properties
    this.isEmpty = this.quantity === 0;
    this.isLow = this.quantity <= 5; // Consider low when 5 or fewer
  }

  /**
   * Get the organization this resource belongs to
   */
  getOrganization() {
    if (!game?.actors) return null;
    return game.actors.get(this.organizationId);
  }

  /**
   * Consume a quantity of this resource
   */
  async consume(amount: number) {
    if (amount <= 0) return false;
    if (this.quantity < amount) return false;

    const newQuantity = Math.max(0, this.quantity - amount);

    await this.parent.update({
      'system.quantity': newQuantity,
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Add to the resource quantity
   */
  async add(amount: number) {
    if (amount <= 0) return false;

    await this.parent.update({
      'system.quantity': this.quantity + amount,
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Set the resource quantity directly
   */
  async setQuantity(newQuantity: number) {
    if (newQuantity < 0) return false;

    await this.parent.update({
      'system.quantity': newQuantity,
      'system.version': this.version + 1,
    });

    return true;
  }

  /**
   * Transfer resources to another organization
   */
  async transferTo(targetOrganizationId: string, amount: number) {
    if (amount <= 0 || this.quantity < amount) return false;

    // Consume from this resource
    const success = await this.consume(amount);
    if (!success) return false;

    // TODO: Create or add to resource in target organization
    // This would require creating a new resource item or updating existing one
    // For now, we'll just log the transfer intent
    console.log(
      `Transferred ${amount} ${this.parent.name} to organization ${targetOrganizationId}`
    );

    return true;
  }
}
