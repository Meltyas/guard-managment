/**
 * SentenceConfigManager - Manages sentence configuration per offense type
 * Stores in game.settings, reads Daggerheart currency labels
 */

import type { OffenseType, SentenceConfig, SentenceEntry } from '../types/crimes';
import { DEFAULT_SENTENCE_CONFIG, OFFENSE_LABELS } from '../types/crimes';

export interface CurrencyLabel {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
}

export class SentenceConfigManager {
  private config: SentenceConfig = { ...DEFAULT_SENTENCE_CONFIG };

  public async initialize(): Promise<void> {
    await this.loadFromSettings();
  }

  /**
   * Load config from world settings (public for onChange callback)
   */
  public async loadFromSettings(): Promise<void> {
    try {
      const stored = game?.settings?.get(
        'guard-management',
        'sentenceConfig' as any
      ) as SentenceConfig | null;
      if (stored && typeof stored === 'object') {
        // Merge with defaults to ensure all keys exist
        this.config = { ...DEFAULT_SENTENCE_CONFIG, ...stored };
        console.log('SentenceConfigManager | Loaded config from settings');
      }
    } catch (e) {
      console.warn('SentenceConfigManager | loadFromSettings failed:', e);
    }
  }

  /**
   * Save config to world settings
   */
  private async _saveToSettingsAsync(): Promise<void> {
    try {
      if (!game?.ready) return;
      await game?.settings?.set('guard-management', 'sentenceConfig' as any, this.config);
      console.log('SentenceConfigManager | Saved config to settings');
    } catch (error) {
      console.error('SentenceConfigManager | Error saving config:', error);
    }
  }

  /**
   * Get full config
   */
  public getConfig(): SentenceConfig {
    return { ...this.config };
  }

  /**
   * Get sentence for a specific offense type
   */
  public getForType(type: OffenseType): SentenceEntry {
    return this.config[type] || DEFAULT_SENTENCE_CONFIG[type];
  }

  /**
   * Update config (partial update supported)
   */
  public async updateConfig(updates: Partial<SentenceConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this._saveToSettingsAsync();
  }

  /**
   * Get Daggerheart currency labels from homebrew settings
   */
  public getCurrencyLabels(): CurrencyLabel[] {
    try {
      const dhConfig = (globalThis as any).CONFIG?.DH;
      if (!dhConfig) {
        return this.getDefaultCurrencyLabels();
      }

      const homebrewKey = dhConfig.SETTINGS?.gameSettings?.Homebrew;
      if (!homebrewKey) {
        return this.getDefaultCurrencyLabels();
      }

      const homebrew = game?.settings?.get(dhConfig.id, homebrewKey) as any;
      if (!homebrew?.currency) {
        return this.getDefaultCurrencyLabels();
      }

      const currency = homebrew.currency;
      const keys = ['coins', 'handfuls', 'bags', 'chests'] as const;
      return keys.map((key) => ({
        key,
        label: currency[key]?.label || key,
        icon: currency[key]?.icon || '',
        enabled: currency[key]?.enabled ?? true,
      }));
    } catch {
      return this.getDefaultCurrencyLabels();
    }
  }

  /**
   * Get currency title (e.g. "Gold")
   */
  public getCurrencyTitle(): string {
    try {
      const dhConfig = (globalThis as any).CONFIG?.DH;
      if (!dhConfig) return 'Oro';

      const homebrewKey = dhConfig.SETTINGS?.gameSettings?.Homebrew;
      if (!homebrewKey) return 'Oro';

      const homebrew = game?.settings?.get(dhConfig.id, homebrewKey) as any;
      return homebrew?.currency?.title || 'Oro';
    } catch {
      return 'Oro';
    }
  }

  /**
   * Default currency labels if Daggerheart is not available
   */
  private getDefaultCurrencyLabels(): CurrencyLabel[] {
    return [
      { key: 'coins', label: 'Coins', icon: 'fa-solid fa-coin-front', enabled: true },
      { key: 'handfuls', label: 'Handfuls', icon: 'fa-solid fa-coins', enabled: true },
      { key: 'bags', label: 'Bags', icon: 'fa-solid fa-sack', enabled: true },
      { key: 'chests', label: 'Chests', icon: 'fa-solid fa-treasure-chest', enabled: true },
    ];
  }

  /**
   * Format a sentence entry as human-readable Spanish text
   */
  public formatSentence(type: OffenseType): string {
    const entry = this.getForType(type);
    const label = OFFENSE_LABELS[type];
    const currencyLabels = this.getCurrencyLabels();

    let turnsText = '';
    if (entry.turns === 'execution') {
      turnsText = 'Ejecución';
    } else if (entry.turns === 'permanent') {
      turnsText = 'Permanente';
    } else if (entry.turns > 0) {
      turnsText = `${entry.turns} turno${entry.turns !== 1 ? 's' : ''} de prisión`;
    }

    // Build fine text
    const fineParts: string[] = [];
    const fineKeys = ['coins', 'handfuls', 'bags', 'chests'] as const;
    for (const key of fineKeys) {
      const amount = entry.fine[key];
      if (amount > 0) {
        const currLabel = currencyLabels.find((c) => c.key === key);
        if (currLabel?.enabled) {
          fineParts.push(`${amount} ${currLabel.label}`);
        }
      }
    }
    const fineText = fineParts.join(', ');

    if (turnsText && fineText) {
      return `${label}: ${turnsText} + ${fineText}`;
    } else if (turnsText) {
      return `${label}: ${turnsText}`;
    } else if (fineText) {
      return `${label}: Solo multa de ${fineText}`;
    }
    return `${label}: Sin sentencia definida`;
  }
}
