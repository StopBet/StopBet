# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ── Reglas para R8 (minifyEnabled true) ─────────────────────────────────────
#
# R8 renombra clases, y el nombre de un método JNI lleva dentro el paquete y la clase Java
# (`Java_com_swmansion_rnscreens_NativeProxy_initHybrid`): si la clase cambia de nombre, el
# símbolo que busca la librería nativa deja de existir. Eso **no se detecta compilando**,
# solo al abrir el APK, así que estas reglas van puestas de entrada.
#
# Agregadas el 22-09-2026 al activar la minificación. No están verificadas contra un fallo
# real: el crash que se vio ese día en el emulador era otra cosa (el APK no traía la
# librería de `react-native-screens` para x86_64). Se dejan porque son la recomendación
# estándar para JNI y no cuestan tamaño apreciable.

# Toda clase con métodos nativos conserva su nombre y el de esos métodos.
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# El puente C++ de React Native (fbjni) y lo que cuelga de él.
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-screens y react-native-pager-view: la navegación entera pasa por acá.
-keep class com.swmansion.** { *; }

# Los DTO de la API se serializan por reflexión con sus nombres de campo.
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}
