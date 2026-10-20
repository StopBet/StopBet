import { estadoFinal, historialDemo, type DecisionDemo } from './family-demo-history';

const IDS = {
  activo: 'fam-activo',
  remoto: 'fam-remoto',
  extras: ['fam-1', 'fam-2', 'fam-3', 'fam-4', 'fam-5'],
};

describe('historial de decisiones del seed de familia (HDU 23 CA6)', () => {
  const historial = historialDemo(IDS);

  it('cubre a todos los familiares con vínculo activo del seed, y a ninguno más', () => {
    expect(Object.keys(historial).sort()).toEqual(
      [IDS.activo, IDS.remoto, ...IDS.extras].sort(),
    );
  });

  it('cada secuencia es posible con las reglas del sistema y deja el vínculo activo', () => {
    for (const decisiones of Object.values(historial)) {
      expect(estadoFinal(decisiones)).toBe('active');
    }
  });

  it('va de la decisión más vieja a la más nueva y nunca cae en el futuro', () => {
    for (const decisiones of Object.values(historial)) {
      decisiones.forEach((d) => expect(d.hoursAgo).toBeGreaterThan(0));
      const horas = decisiones.map((d) => d.hoursAgo);
      expect(horas).toEqual([...horas].sort((a, b) => b - a));
      expect(new Set(horas).size).toBe(horas.length);
    }
  });

  it('el último paso de cada vínculo es una confirmación, con su forma de verificación', () => {
    for (const decisiones of Object.values(historial)) {
      const ultima = decisiones[decisiones.length - 1];
      expect(ultima.verdict).toBe('confirmed');
      expect(ultima.verification).toBeDefined();
    }
  });

  it('solo las confirmaciones llevan verificación', () => {
    for (const d of Object.values(historial).flat()) {
      if (d.verdict !== 'confirmed') expect(d.verification).toBeUndefined();
    }
  });

  it('un psicólogo solo decide sobre pacientes de su sede', () => {
    // Tomás atiende solo Viña del Mar, donde vive el paciente de Elena; los demás pacientes son de Santiago.
    for (const [familiar, decisiones] of Object.entries(historial)) {
      for (const d of decisiones) {
        if (familiar === IDS.remoto) expect(d.by).not.toBe('valentina');
        else expect(d.by).not.toBe('tomas');
      }
    }
  });

  it('al menos un vínculo tiene un historial largo, para que el Historial muestre una línea de tiempo', () => {
    expect(Object.values(historial).some((d) => d.length >= 4)).toBe(true);
  });

  describe('estadoFinal', () => {
    const d = (verdict: DecisionDemo['verdict']): DecisionDemo => ({ verdict, by: 'miguel', hoursAgo: 1 });

    it('parte de «pendiente»', () => {
      expect(estadoFinal([])).toBe('pending');
    });

    it('sigue la misma máquina de estados que el servicio', () => {
      expect(estadoFinal([d('rejected')])).toBe('rejected');
      expect(estadoFinal([d('confirmed'), d('revoked')])).toBe('revoked');
      expect(estadoFinal([d('confirmed'), d('revoked'), d('reopened')])).toBe('pending');
    });

    it('rechaza una decisión que no se podría tomar desde el estado anterior', () => {
      expect(() => estadoFinal([d('revoked')])).toThrow('no se puede tomar desde «pending»');
      expect(() => estadoFinal([d('confirmed'), d('confirmed')])).toThrow();
      expect(() => estadoFinal([d('rejected'), d('confirmed')])).toThrow();
      expect(() => estadoFinal([d('reopened')])).toThrow();
    });
  });
});
