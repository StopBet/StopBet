package com.stopbet

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Proxy
import java.util.concurrent.TimeUnit
import okhttp3.Call
import okhttp3.Connection
import okhttp3.ConnectionPool
import okhttp3.EventListener
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response

// Diagnóstico temporal (CA1/CA7 — escrituras que se pierden contra Railway): registra el
// ciclo de vida real de cada llamada HTTP para saber, con evidencia y no con suposiciones,
// si la conexión es nueva o reusada y en qué paso exacto se pierde la respuesta. Se puede
// quitar una vez identificada la causa raíz definitiva.
private object NetDiagnostics : EventListener() {
  private const val TAG = "STOPBET_NET"
  private fun ms() = System.currentTimeMillis()

  override fun callStart(call: Call) {
    Log.e(TAG, "[${call.hashCode()}] callStart ${call.request().method} ${call.request().url.encodedPath} t=${ms()}")
  }
  override fun dnsStart(call: Call, domainName: String) {
    Log.e(TAG, "[${call.hashCode()}] dnsStart $domainName t=${ms()}")
  }
  override fun dnsEnd(call: Call, domainName: String, inetAddressList: List<java.net.InetAddress>) {
    Log.e(TAG, "[${call.hashCode()}] dnsEnd $inetAddressList t=${ms()}")
  }
  override fun connectStart(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy) {
    Log.e(TAG, "[${call.hashCode()}] connectStart SOCKET NUEVO hacia $inetSocketAddress t=${ms()}")
  }
  override fun secureConnectStart(call: Call) {
    Log.e(TAG, "[${call.hashCode()}] secureConnectStart (TLS handshake) t=${ms()}")
  }
  override fun secureConnectEnd(call: Call, handshake: okhttp3.Handshake?) {
    Log.e(TAG, "[${call.hashCode()}] secureConnectEnd t=${ms()}")
  }
  override fun connectFailed(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy, protocol: Protocol?, ioe: IOException) {
    Log.e(TAG, "[${call.hashCode()}] connectFailed ${ioe.javaClass.simpleName}: ${ioe.message} t=${ms()}")
  }
  override fun connectEnd(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy, protocol: Protocol?) {
    Log.e(TAG, "[${call.hashCode()}] connectEnd protocolo=$protocol t=${ms()}")
  }
  override fun connectionAcquired(call: Call, connection: Connection) {
    // Sin connectStart/connectEnd previos para este mismo call = se reusó una conexión del
    // pool en vez de abrir un socket nuevo.
    Log.e(TAG, "[${call.hashCode()}] connectionAcquired conn=${System.identityHashCode(connection)} protocolo=${connection.protocol()} t=${ms()}")
  }
  override fun connectionReleased(call: Call, connection: Connection) {
    Log.e(TAG, "[${call.hashCode()}] connectionReleased conn=${System.identityHashCode(connection)} t=${ms()}")
  }
  override fun requestHeadersEnd(call: Call, request: Request) {
    Log.e(TAG, "[${call.hashCode()}] requestHeadersEnd t=${ms()}")
  }
  override fun requestBodyEnd(call: Call, byteCount: Long) {
    Log.e(TAG, "[${call.hashCode()}] requestBodyEnd bytes=$byteCount t=${ms()}")
  }
  override fun responseHeadersStart(call: Call) {
    Log.e(TAG, "[${call.hashCode()}] responseHeadersStart (empezó a leer la respuesta) t=${ms()}")
  }
  override fun responseHeadersEnd(call: Call, response: Response) {
    Log.e(TAG, "[${call.hashCode()}] responseHeadersEnd code=${response.code} t=${ms()}")
  }
  override fun callEnd(call: Call) {
    Log.e(TAG, "[${call.hashCode()}] callEnd OK t=${ms()}")
  }
  override fun callFailed(call: Call, ioe: IOException) {
    Log.e(TAG, "[${call.hashCode()}] callFailed ${ioe.javaClass.name}: ${ioe.message} t=${ms()}")
  }
}

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()

    // El proxy de Railway corta las conexiones inactivas a los 60 s con un RST (medido:
    // sobrevive a 58 s, muere a 60 s), sin avisarle al cliente. El pool por defecto de
    // OkHttp (5, 5 MINUTOS) las da por buenas mucho después de esa ventana, así que
    // reutiliza una conexión que el proxy ya mató — la petición se pierde y OkHttp nunca
    // reintenta un POST solo. Bajar el tiempo de vida del pool muy por debajo de los 60 s
    // hace que nunca exista una conexión zombi que reutilizar.
    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder(this)
          // Railway negocia h2 por ALPN; el backend local es HTTP/1.1 plano. Esa es la
          // única diferencia estructural entre "en local funciona" y "en Railway no":
          // sobre HTTP/2 las escrituras completan bien en OkHttp (201/409, callEnd OK)
          // pero la respuesta nunca llega a JS, que ve `Network request failed`. Las
          // lecturas se salvan porque el polling las repite cada 5 s; un POST no.
          // Forzar HTTP/1.1 deja al teléfono en el mismo transporte donde sí funciona.
          .protocols(listOf(Protocol.HTTP_1_1))
          .connectionPool(ConnectionPool(5, 30L, TimeUnit.SECONDS))
          .eventListener(NetDiagnostics)
          .build()
    }

    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
