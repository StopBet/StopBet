package com.stopbet.blocking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * PoC del SPIKE 2 (CA2) — método A: `VpnService` solo DNS.
 *
 * La interfaz enruta hacia la app **únicamente** la IP del DNS falso; todo el resto del tráfico
 * del paciente sale directo a internet sin pasar por acá. De cada consulta solo se mira el
 * nombre: si está en la lista se responde NXDOMAIN, si no se reenvía al DNS real de la red.
 */
class BlockingVpnService : VpnService() {

  companion object {
    const val ACTION_START = "com.stopbet.blocking.START"
    const val ACTION_STOP = "com.stopbet.blocking.STOP"
    private const val TAG = "STOPBET_BLOCK"
    private const val CHANNEL_ID = "bloqueo"
    private const val NOTIFICATION_ID = 4711

    // Rango de documentación (RFC 5737): nunca choca con una red real.
    private const val TUN_ADDRESS = "192.0.2.1"
    private const val FAKE_DNS = "192.0.2.53"
    private const val FALLBACK_DNS = "8.8.8.8"

    @Volatile private var running: BlockingVpnService? = null

    /**
     * El paciente marcó StopBet como "VPN siempre activa" en Ajustes. Apagarla desde la app no
     * sirve: Android vuelve a arrancar el servicio al instante. Antes de Android 10 no hay cómo
     * saberlo y se asume que no.
     */
    fun isAlwaysOn(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && running?.isAlwaysOn == true

    /**
     * Además de siempre activa, "Bloquear conexiones sin VPN": con el servicio apagado Android
     * corta todo el tráfico del teléfono, no solo los sitios de apuestas.
     */
    fun isLockdown(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && running?.isLockdownEnabled == true
  }

  private var tun: ParcelFileDescriptor? = null
  private var reader: Thread? = null
  private var pool: ExecutorService? = null

  override fun onCreate() {
    super.onCreate()
    running = this
  }

  override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      // La app ya lo rechaza en BlockingModule.stop(); esto cubre cualquier otro emisor del intent.
      if (isAlwaysOn()) {
        Log.w(TAG, "STOP ignorado: StopBet es la VPN siempre activa (lockdown=${isLockdown()})")
        return START_STICKY
      }
      shutdown()
      BlockingState.setEnabled(this, false)
      BlockingState.setActive(this, false, "detenida desde la app")
      stopForegroundCompat()
      stopSelf()
      return START_NOT_STICKY
    }
    // Cualquier otra acción es arranque: la de la app, o la del sistema cuando el paciente
    // activó "VPN siempre activa" (llega con la acción android.net.VpnService, sin extras).
    startForegroundCompat()
    BlockingState.setEnabled(this, true)
    if (tun == null) establish()
    return START_STICKY
  }

  /**
   * El paciente apagó la VPN desde el sistema, u otra app de VPN tomó el lugar. Cuando llega,
   * la interfaz ya está caída; y puede no llegar por el hilo principal.
   */
  override fun onRevoke() {
    Log.w(TAG, "onRevoke: el bloqueo fue desactivado fuera de la app")
    BlockingState.markRevoked(this)
    shutdown()
    stopForegroundCompat()
    super.onRevoke()
  }

  override fun onDestroy() {
    shutdown()
    if (running === this) running = null
    super.onDestroy()
  }

  private fun establish() {
    val builder = Builder()
        .setSession("StopBet — bloqueo de apuestas")
        .addAddress(TUN_ADDRESS, 24)
        .addDnsServer(FAKE_DNS)
        .addRoute(FAKE_DNS, 32)
        .setBlocking(true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) builder.setMetered(false)

    val iface = builder.establish()
    if (iface == null) {
      // Solo pasa si se perdió el consentimiento entre prepare() y este punto.
      Log.e(TAG, "establish() devolvió null: la app ya no es la VPN preparada")
      BlockingState.setActive(this, false, "sin consentimiento")
      stopForegroundCompat()
      stopSelf()
      return
    }
    tun = iface
    pool = Executors.newFixedThreadPool(8)
    reader = Thread({ readLoop(iface) }, "stopbet-dns").also { it.start() }
    BlockingState.setActive(this, true, "activada")
    Log.i(TAG, "Bloqueo activo con ${DomainList.size} dominios")
  }

  private fun readLoop(iface: ParcelFileDescriptor) {
    val input = FileInputStream(iface.fileDescriptor)
    val output = FileOutputStream(iface.fileDescriptor)
    val buffer = ByteArray(32767)
    try {
      while (!Thread.currentThread().isInterrupted) {
        val length = input.read(buffer)
        if (length <= 0) continue
        val query = DnsQuery.parse(buffer, length) ?: continue

        if (DomainList.isBlocked(query.name)) {
          BlockingState.recordBlocked(query.name)
          Log.i(TAG, "BLOQUEADO ${query.name}")
          write(output, query.wrapResponse(query.nxdomain()))
        } else {
          pool?.execute { forward(query, output) }
        }
      }
    } catch (e: Exception) {
      // Cerrar la interfaz desde shutdown() corta el read() con una excepción: es la salida normal.
      Log.i(TAG, "Lectura terminada: ${e.javaClass.simpleName}")
    }
  }

  private fun forward(query: DnsQuery, output: FileOutputStream) {
    try {
      DatagramSocket().use { socket ->
        // Sin protect() el socket volvería a entrar por la propia VPN y se enlazaría consigo mismo.
        protect(socket)
        socket.soTimeout = 5000
        val upstream = upstreamDns()
        socket.send(DatagramPacket(query.dnsPayload, query.dnsPayload.size, upstream, 53))
        val response = ByteArray(4096)
        val packet = DatagramPacket(response, response.size)
        socket.receive(packet)
        write(output, query.wrapResponse(response.copyOf(packet.length)))
      }
    } catch (e: Exception) {
      // Sin respuesta la app que preguntó reintenta sola; no hay nada que devolverle.
      Log.w(TAG, "No se pudo resolver ${query.name}: ${e.javaClass.simpleName}")
    }
  }

  private fun write(output: FileOutputStream, packet: ByteArray) {
    synchronized(output) { output.write(packet) }
  }

  /**
   * El DNS de la red física (wifi o datos), no el de la VPN, que es este mismo servicio. Se
   * consulta en cada reenvío porque cambia al pasar de wifi a datos.
   */
  @Suppress("DEPRECATION") // allNetworks: la alternativa exige un callback para una consulta puntual
  private fun upstreamDns(): InetAddress {
    val cm = getSystemService(ConnectivityManager::class.java)
    for (network in cm.allNetworks) {
      val caps = cm.getNetworkCapabilities(network) ?: continue
      if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) continue
      if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) continue
      val dns = cm.getLinkProperties(network)?.dnsServers?.firstOrNull { it is Inet4Address }
      if (dns != null) return dns
    }
    return InetAddress.getByName(FALLBACK_DNS)
  }

  private fun shutdown() {
    reader?.interrupt()
    reader = null
    pool?.shutdownNow()
    pool = null
    try {
      tun?.close()
    } catch (_: Exception) {
    }
    tun = null
  }

  private fun startForegroundCompat() {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Bloqueo de apuestas", NotificationManager.IMPORTANCE_LOW))
    }
    val notification =
        Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle("Bloqueo de apuestas activo")
            .setContentText("StopBet filtra los sitios de apuestas en este teléfono")
            .setOngoing(true)
            .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // Tipo obligatorio con targetSdk 34+. systemExempted está permitido para apps de VPN.
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun stopForegroundCompat() {
    stopForeground(STOP_FOREGROUND_REMOVE)
  }
}

/**
 * Estado del bloqueo. `enabled` es lo que el paciente **quiere** y sobrevive al cierre de la app
 * y al reinicio: la app y el arranque del teléfono lo usan para volver a levantarlo solo. El
 * apagado desde Ajustes lo pone en `false`, y entonces nadie lo vuelve a encender sin preguntar.
 */
object BlockingState {
  private const val PREFS = "stopbet_blocking"
  private const val MAX_RECENT = 10

  @Volatile var active = false
    private set
  @Volatile var blockedCount = 0
    private set
  private val recent = ArrayDeque<String>()

  fun setActive(context: Context, value: Boolean, reason: String) {
    active = value
    if (value) blockedCount = 0
    Log.i("STOPBET_BLOCK", "estado=${if (value) "activo" else "inactivo"} ($reason)")
  }

  fun setEnabled(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean("enabled", value).apply()
  }

  fun isEnabled(context: Context): Boolean = prefs(context).getBoolean("enabled", false)

  fun markRevoked(context: Context) {
    active = false
    prefs(context).edit()
        .putLong("lastRevokedAt", System.currentTimeMillis())
        .putBoolean("enabled", false)
        .apply()
  }

  fun lastRevokedAt(context: Context): Long = prefs(context).getLong("lastRevokedAt", 0L)

  @Synchronized
  fun recordBlocked(name: String) {
    blockedCount++
    recent.remove(name)
    recent.addFirst(name)
    while (recent.size > MAX_RECENT) recent.removeLast()
  }

  @Synchronized fun recentBlocked(): List<String> = recent.toList()

  private fun prefs(context: Context) =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
