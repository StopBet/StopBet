import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Puente al `VpnService` del PoC del SPIKE 2 (CA2). Solo Android: en iOS el módulo no existe
 * y `get` devuelve null.
 */
export interface Spec extends TurboModule {
  /** Muestra el diálogo del sistema la primera vez; después resuelve `true` sin mostrar nada. */
  requestPermission(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Abre Ajustes › VPN: el único lugar desde donde el paciente apaga el bloqueo. */
  openVpnSettings(): Promise<void>;
  getStatus(): Promise<{
    active: boolean;
    /** Lo que el paciente quiere: sigue en true si el sistema mató el servicio, false si lo apagó. */
    enabled: boolean;
    /** El consentimiento de VPN sigue vigente: se puede encender sin mostrar el diálogo. */
    hasPermission: boolean;
    domainCount: number;
    blockedCount: number;
    recentBlocked: string[];
    /** Epoch en ms del último apagado hecho fuera de la app; 0 si nunca pasó. */
    lastRevokedAt: number;
    /**
     * Servidor del DNS privado en modo estricto de la red física; vacío si no hay. Con uno
     * configurado Android cifra las consultas hacia él y no pasan por el filtro.
     */
    privateDnsServer: string;
  }>;
}

export default TurboModuleRegistry.get<Spec>('NativeBlocking');
