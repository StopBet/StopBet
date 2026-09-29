package com.stopbet.blocking

import android.app.Activity
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.stopbet.specs.NativeBlockingSpec

class BlockingModule(private val context: ReactApplicationContext) : NativeBlockingSpec(context) {

  companion object {
    const val NAME = "NativeBlocking"
    private const val REQUEST_VPN = 4711
  }

  private var pendingPermission: Promise? = null

  private val activityListener =
      object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?,
        ) {
          if (requestCode != REQUEST_VPN) return
          pendingPermission?.resolve(resultCode == Activity.RESULT_OK)
          pendingPermission = null
        }
      }

  init {
    context.addActivityEventListener(activityListener)
  }

  override fun requestPermission(promise: Promise) {
    // Siempre se vuelve a llamar: el paciente pudo haber elegido otra app de VPN desde la última vez.
    val intent = VpnService.prepare(context) ?: return promise.resolve(true)
    val activity = context.currentActivity
        ?: return promise.reject("NO_ACTIVITY", "La app no está en primer plano")
    pendingPermission?.resolve(false)
    pendingPermission = promise
    activity.startActivityForResult(intent, REQUEST_VPN)
  }

  override fun start(promise: Promise) {
    if (VpnService.prepare(context) != null) {
      return promise.reject("NO_PERMISSION", "Falta el consentimiento de VPN")
    }
    val intent = Intent(context, BlockingVpnService::class.java).setAction(BlockingVpnService.ACTION_START)
    context.startForegroundService(intent)
    promise.resolve(null)
  }

  override fun stop(promise: Promise) {
    val intent = Intent(context, BlockingVpnService::class.java).setAction(BlockingVpnService.ACTION_STOP)
    context.startService(intent)
    promise.resolve(null)
  }

  override fun openVpnSettings(promise: Promise) {
    val intent = Intent(Settings.ACTION_VPN_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      // Algunas capas de fabricante no exponen esa pantalla suelta: se cae a Ajustes de red.
      context.startActivity(
          Intent(Settings.ACTION_WIRELESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    }
  }

  override fun getStatus(promise: Promise) {
    val recent = Arguments.createArray()
    BlockingState.recentBlocked().forEach { recent.pushString(it) }
    promise.resolve(
        Arguments.createMap().apply {
          putBoolean("active", BlockingState.active)
          putBoolean("enabled", BlockingState.isEnabled(context))
          putBoolean("hasPermission", VpnService.prepare(context) == null)
          putInt("domainCount", DomainList.size)
          putInt("blockedCount", BlockingState.blockedCount)
          putArray("recentBlocked", recent)
          putDouble("lastRevokedAt", BlockingState.lastRevokedAt(context).toDouble())
          putString("privateDnsServer", privateDnsServer())
        })
  }

  @Suppress("DEPRECATION") // allNetworks: ver BlockingVpnService.upstreamDns()
  private fun privateDnsServer(): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return ""
    val cm = context.getSystemService(ConnectivityManager::class.java)
    for (network in cm.allNetworks) {
      val caps = cm.getNetworkCapabilities(network) ?: continue
      if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue
      val name = cm.getLinkProperties(network)?.privateDnsServerName
      if (name != null) return name
    }
    return ""
  }
}
