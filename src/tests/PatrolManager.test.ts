import { describe, expect, it } from 'vitest';
import { PatrolManager } from '../managers/PatrolManager';
import type { Patrol, PatrolEffectInstance, PatrolOfficer, PatrolSoldier } from '../types/entities';
import { classifyLastOrderAge } from '../utils/patrol-helpers';

describe('PatrolManager', () => {
  it('creates a patrol with baseStats and no officer', () => {
    const pm = new PatrolManager();
    const organizationId = 'org-123';
    const patrolData = {
      name: 'Patrulla Alfa',
      organizationId,
      baseStats: { robustismo: 5, analitica: 4, subterfugio: 3, elocuencia: 2 },
    } as any;

    const patrol: Patrol = pm.createPatrol(patrolData);
    expect(patrol.name).toBe('Patrulla Alfa');
    expect(patrol.baseStats.robustismo).toBe(5);
    expect(patrol.officer).toBeNull();
    expect(Array.isArray(patrol.soldiers)).toBe(true);
  });

  it('classifies lastOrder age states', () => {
    const now = Date.now();
    expect(classifyLastOrderAge({ issuedAt: now - 2 * 24 * 60 * 60 * 1000 })).toBe('normal');
    expect(classifyLastOrderAge({ issuedAt: now - 8 * 24 * 60 * 60 * 1000 })).toBe('warning');
    expect(classifyLastOrderAge({ issuedAt: now - 31 * 24 * 60 * 60 * 1000 })).toBe('danger');
  });

  it('assigns an officer', () => {
    const pm = new PatrolManager();
    const p = pm.createPatrol({
      name: 'Bravo',
      organizationId: 'org',
      baseStats: { robustismo: 1, analitica: 1, subterfugio: 1, elocuencia: 1 },
    } as any);
    const officer: PatrolOfficer = { actorId: 'A1', name: 'Capitán', img: 'officer.png' };
    pm.assignOfficer(p.id, officer);
    const updated = pm.getPatrol(p.id)!;
    expect(updated.officer?.actorId).toBe('A1');
  });

  it('adds soldiers (allowing duplicates)', () => {
    const pm = new PatrolManager();
    const p = pm.createPatrol({
      name: 'Gamma',
      organizationId: 'org',
      baseStats: { robustismo: 0, analitica: 0, subterfugio: 0, elocuencia: 0 },
    } as any);
    const soldier: PatrolSoldier = {
      actorId: 'S1',
      name: 'Soldado',
      img: 's.png',
      referenceType: 'linked',
      addedAt: Date.now(),
    };
    pm.addSoldier(p.id, soldier);
    pm.addSoldier(p.id, soldier); // duplicate allowed
    const updated = pm.getPatrol(p.id)!;
    expect(updated.soldiers.length).toBe(2);
  });

  it('adds an effect and recalculates derived stats', () => {
    const pm = new PatrolManager();
    const p = pm.createPatrol({
      name: 'Delta',
      organizationId: 'org',
      baseStats: { robustismo: 2, analitica: 1, subterfugio: 1, elocuencia: 1 },
    } as any);
    const effect: PatrolEffectInstance = {
      id: 'eff1',
      sourceType: 'manual',
      label: 'Refuerzo',
      modifiers: { robustismo: 3 },
    };
    pm.addEffect(p.id, effect);
    pm.recalcDerived(p.id); // no org mods
    const updated = pm.getPatrol(p.id)!;
    expect(updated.derivedStats?.robustismo).toBe(5); // 2 base + 3 effect
  });

  it('updates lastOrder and tracks classification', () => {
    const pm = new PatrolManager();
    const p = pm.createPatrol({
      name: 'Epsilon',
      organizationId: 'org',
      baseStats: { robustismo: 0, analitica: 0, subterfugio: 0, elocuencia: 0 },
    } as any);
    pm.updateLastOrder(p.id, 'Mantener posición');
    const updated = pm.getPatrol(p.id)!;
    expect(updated.lastOrder?.text).toBe('Mantener posición');
    const cls = classifyLastOrderAge({ issuedAt: updated.lastOrder!.issuedAt });
    expect(['normal', 'warning', 'danger']).toContain(cls);
  });
});
