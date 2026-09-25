package com.stopbet

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
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
import java.util.concurrent.TimeUnit
import okhttp3.ConnectionPool

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
          .connectionPool(ConnectionPool(5, 30L, TimeUnit.SECONDS))
          .build()
    }

    crearCanalesDeNotificacion()

    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }

  // El backend manda sus push con un `channelId` explícito (`recordatorios` para el aviso
  // de check-in y el de insignia nueva, `panic_alerts` para la escalada del pánico). Si el
  // canal no existe en el dispositivo, FCM no falla: entrega por su canal de respaldo, que
  // tiene importancia media — la notificación queda guardada en la barra y solo se ve al
  // desplegarla. Para HDU3 CA1 eso es la diferencia entre que la felicitación aparezca
  // sobre la pantalla o que el paciente no se entere hasta que abra la app.
  //
  // Crear un canal es idempotente mientras no cambie el id, pero Android ignora cualquier
  // cambio de importancia posterior: si alguna vez hay que subirla, el id tiene que ser
  // nuevo. Los canales existen desde Android 8 y el `minSdkVersion` del proyecto es 24.
  private fun crearCanalesDeNotificacion() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = getSystemService(NotificationManager::class.java) ?: return

    manager.createNotificationChannel(
        NotificationChannel(
            "recordatorios",
            "Recordatorios y logros",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = "Tu check-in diario y las insignias que vas ganando."
        }
    )

    manager.createNotificationChannel(
        NotificationChannel(
            "panic_alerts",
            "Alertas de pánico",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = "Avisos urgentes de tu red de apoyo."
        }
    )
  }
}
