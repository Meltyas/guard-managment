/**
 * ChatService
 * Centralized chat message creation for guard-management.
 */
export interface ChatFlagsBase {
  type: string;
  [key: string]: any;
}

export class ChatService {
  static async post(html: string, flags: ChatFlagsBase, whisper?: string[]): Promise<void> {
    if (!html) return;
    try {
      const ctor: any = (globalThis as any).ChatMessage || ChatMessage;
      await ctor.create({
        content: html,
        whisper: whisper || [],
        flags: { 'guard-management': flags },
      });
    } catch (error) {
      console.error('ChatService | Error creating chat message:', error);
    }
  }
}
