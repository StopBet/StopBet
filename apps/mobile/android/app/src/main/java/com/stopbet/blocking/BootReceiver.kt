package com.stopbet.blocking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.util.Log

/**
 * Vuelve a levantar el bloqueo al encender el teléfono, solo si el paciente lo tenía encendido
 * y el consentimiento de VPN sigue vigente. Sin esto, reiniciar el teléfono lo apaga en silencio.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    if (!BlockingState.isEnabled(context)) return
    if (VpnService.prepare(context) != null) {
      Log.w("STOPBET_BLOCK", "Arranque: el consentimiento de VPN ya no está, no se enciende")
      return
    }
    Log.i("STOPBET_BLOCK", "Arranque: reactivando el bloqueo")
    context.startForegroundService(
        Intent(context, BlockingVpnService::class.java).setAction(BlockingVpnService.ACTION_START))
  }
}
