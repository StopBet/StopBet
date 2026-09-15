# Auditoría UX/UI · StopBet Mobile

- **Fecha:** 14-09-2026
- **Alcance:** `apps/mobile`, las 14 pantallas y los 16 componentes, recorridos en el emulador y en el código.
- **Tipo:** solo diagnóstico. Ningún archivo de la app se modificó para esta auditoría.
- **Informe visual con capturas:** https://claude.ai/artifact/9zUwSuPx4AtHvMyP7b63Tp (privado; se comparte desde la página).
- **Rutas:** relativas a `apps/mobile/src/` salvo que se indique otra.

## Resumen

| Métrica | Resultado |
|---|---|
| Salud técnica (impeccable, auditoría nativa) | **6/20** · Pobre, requiere trabajo mayor |
| Heurísticas de Nielsen (impeccable, crítica) | **21/40** · Aceptable, mejoras importantes |
| Hallazgos | **76** · 3 P0 · 18 P1 · 42 P2 · 13 P3 _(SUS-07, PAN-11 y SIS-14 se sumaron el 15-09 al verificar los arreglos)_ |

Gravedad: **P0** bloquea o pone en riesgo al paciente · **P1** arreglar antes de lanzar · **P2** próxima pasada · **P3** pulido.

**Veredicto: bien vestida, frágil por dentro.**

- **La marca está bien aplicada y la app se siente propia:** azul StopBet, crema, Chillax y Satoshi en todas las pantallas, un botón SOS siempre a mano y un manejo sin conexión pensado con cuidado (nunca muestra "0 días" cuando solo se cayó la red).
- **El problema es lo que no se ve en una captura.** La ruta de crisis promete cosas que no cumple: sin conexión ofrece llamar a un número de prueba, "Iniciar chat con tu padrino" abre la IA, y el asistente asegura que no guarda los mensajes cuando sí los guarda. A eso se suman una app que se cae al agrandar la letra, accesibilidad casi ausente para lectores de pantalla y varios botones que no hacen nada.
- **La mayor oportunidad es que cada frase de la app sea verdad.** En una plataforma clínica la confianza es el producto; los arreglos más valiosos de esta lista son de texto y de datos, no de estilo.

### Puntajes por dimensión

| Salud técnica | Puntaje | Heurística | Puntaje |
|---|---|---|---|
| Accesibilidad | 1/4 | Estado del sistema | 2/4 |
| Rendimiento | 2/4 | Lenguaje del usuario | 3/4 |
| Apariencia y tema | 1/4 | Control y libertad | 2/4 |
| Conformidad Android | 1/4 | Consistencia | 2/4 |
| Adaptabilidad | 1/4 | Prevención de errores | 2/4 |
|  |  | Reconocer, no recordar | 2/4 |
|  |  | Flexibilidad | 2/4 |
|  |  | Estética y foco | 3/4 |
|  |  | Recuperación de errores | 2/4 |
|  |  | Ayuda | 1/4 |

## Decisiones tomadas (PO, 14-09-2026)

- **Privacidad del asistente: decir la verdad en la app.** Los mensajes se siguen guardando; la tarjeta de privacidad y el resumen deben explicar qué se guarda, cuánto tiempo y quién lo ve (ASI-01).
- **Alcance de los arreglos: todo en local.** Antes de subir se decide qué va y se avisa a cada dueño según la tabla de dueños.

## Lo que hay que arreglar primero (P0)

### AND-01 · Se cae al cambiar el tamaño de letra y queda sin poder abrir

- **Dónde:** `apps/mobile/android/app/src/main/java/com/stopbet/MainActivity.kt:13` · `AndroidManifest.xml:20`
- **Qué pasa:** Al subir el tamaño de letra del sistema de 100 % a 130 %, el proceso murió con `IllegalStateException: Screen fragments should never be restored` (react-native-screens). Los tres arranques siguientes murieron con un `SIGSEGV` nativo en Fabric (`MountingCoordinator::pullTransaction`), incluso después de forzar la detención; la app solo volvió a abrir tras borrar sus datos (`pm clear`). Le pasa a quien usa letra grande por accesibilidad y a cualquier Android que restaure la app después de cerrarla por falta de memoria.
- **Qué arreglar:** Cambiar a `super.onCreate(null)` en `MainActivity` (requisito documentado de react-native-screens). Probar en un teléfono físico: cambio de tamaño de letra y restauración con "No conservar actividades" activado en las opciones de desarrollador.
- **Dueño:** Configuración nativa de Android · Tech Leader

### PAN-01 · Número de padrino fijo sin conexión

- **Dónde:** `screens/PanicScreen.tsx:387` · `:393`
- **Qué pasa:** En el estado sin conexión, la pantalla muestra y marca `+56 9 8765 4321`, el número del padrino ficticio del seed (Daniela Soto), escrito directamente en el código. En producción, un paciente en crisis y sin señal llamaría a un desconocido, justo cuando la app no puede ayudarlo de otra forma.
- **Qué arreglar:** Guardar el padrino real en el almacenamiento local en cada carga exitosa (`services/offlineStore.ts` ya existe) y usarlo en esta fila. Si no hay padrino guardado, ocultar la fila y dejar solo el `*4141`.
- **Dueño:** Pánico (HdU01) · Matías Barraza

### ASI-01 · Promesa de privacidad falsa

- **Dónde:** `components/PrivacyCard.tsx:35` · `components/SessionSummaryModal.tsx:123` · backend `apps/backend/src/ai-assistant/entities/ai-message.entity.ts:30`
- **Qué pasa:** La app dice "No se guarda el contenido de los mensajes" y "el contenido de la conversación es privado y no se almacena". El backend guarda cada mensaje completo en `ai_messages.content`, lo devuelve al retomar la sesión y no lo borra al cerrarla. El paciente escribe lo más íntimo de su proceso creyendo que no queda registro.
- **Qué arreglar:** **Decisión del PO (14-09-2026): decir la verdad en la app.** Los mensajes se siguen guardando. Reescribir la tarjeta de privacidad y la nota del resumen para que expliquen qué se guarda (el contenido de los mensajes y el resumen), cuánto tiempo y quién puede verlo. Validar el texto con AJUTER antes de publicarlo.
- **Dueño:** Decisión de PO · implementación Matías Barraza (asistente)

## Lista de arreglos

Para ir marcando. El detalle de cada punto está en la sección siguiente, por pantalla.

`[x]` resuelto · `[~]` mitigado en la app, pero queda una decisión o una validación fuera del código · `[ ]` pendiente.

### P0 · bloqueante (3)

- [x] **AND-01** · Se cae al cambiar el tamaño de letra y queda sin poder abrir. **Arreglo:** `super.onCreate(null)` y prueba de restauración en físico. _(Tech Leader · config nativa)_ — **Resuelto en local 14-09:** `MainActivity.kt` pasa `null`. Verificado en emulador: letra al 130 % sin cierre y reapertura tras matar el proceso en segundo plano sin cierre. Efecto que queda: tras el cambio la app vuelve a Bienvenida porque la sesión de demo no se guarda (se resuelve con la migración de auth). Falta probar en un teléfono físico.
- [x] **PAN-01** · Número de padrino fijo sin conexión. **Arreglo:** padrino real guardado en local; si no hay, solo `*4141`. _(HdU01 · Matías Barraza)_ — **Resuelto en local 14-09:** `saveSponsor`/`readSponsor` en `services/offlineStore.ts`; `PanicScreen` guarda el padrino en cada carga y sin conexión muestra "Llama directamente a {nombre}, tu padrino" con su número real, u oculta la fila si no hay padrino guardado. Verificado en emulador con "Simular sin conexión".
- [x] **ASI-01** · Promesa de privacidad falsa. **Arreglo:** Decisión del PO: decir la verdad en la app. Reescribir la tarjeta de privacidad y el resumen con qué se guarda, cuánto tiempo y quién lo ve. _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 14-09:** `PrivacyCard` y `SessionSummaryModal` dicen ahora lo comprobado en el backend: el psicólogo no lee la conversación; los mensajes quedan guardados mientras exista la cuenta; pasan por la IA de Google sin nombre ni RUT (`sanitizePii`); al cerrar se guarda un resumen. Pendiente: validar el texto con AJUTER.

### P1 · antes de lanzar (18)

- [x] **SIS-01** · Un lector de pantalla no puede usar la app. **Arreglo:** `accessibilityLabel`, `accessibilityRole` y `accessibilityState` en cada control; `accessibilityLiveRegion` en errores. _(cada dueño en su pantalla)_ — **Resuelto en local 14-09:** rol y nombre en los controles de toda la app:
  - pestañas con `tab` y `selected` (barra inferior y Comunidad);
  - tarjetas de selección con `radio` y `checked` (institución, sede, medio de pago, "¿Cómo conociste AJUTER?");
  - emociones que se leen por su nombre y no por el emoji;
  - reacciones con nombre y cantidad ("Fuerza, 2 reacciones");
  - "Volver" con nombre en TopBar, Asistente y Pánico;
  - campos con etiqueta (`FormInput`, Login, Comunidad, Asistente);
  - días del calendario con la fecha completa;
  - títulos con `header`;
  - errores de Login y `FormInput` con `accessibilityLiveRegion`.

  Se corrigió además un bug que no estaba en esta auditoría: el fondo tocable de tres modales (fecha de nacimiento, "¿Cómo conociste AJUTER?" y "Avisar a un familiar") agrupaba todo el modal en un solo elemento, y TalkBack no llegaba a sus botones. Ahora llevan `accessible={false}`.

  Verificado en emulador con uiautomator: ningún control queda sin nombre en Bienvenida, Login, Inicio, Comunidad, Logros ni Perfil. Falta una pasada real con TalkBack.
- [x] **SIS-02** · Áreas táctiles por debajo de 48 dp en toda la app. **Arreglo:** `minHeight: 48` o `hitSlop`; que el `TextInput` ocupe toda la caja. _(cada dueño en su pantalla)_ — **Resuelto en local 14-09:**
  - Los campos de `FormInput` y de Login ocupan ahora todo el alto de la caja: pasaron de 20 a 47–48 dp.
  - Llevan `minHeight: 48`: las pestañas de Comunidad, los enlaces ("Ya tengo cuenta", "¿Olvidaste tu contraseña?", "Ahora no", "Cerrar", "Ver historial de sesiones"), el "Volver" de Login, los días del calendario y las acciones de la tarjeta de crisis.
  - Llevan `hitSlop` los controles compactos que no pueden crecer sin romper el diseño: reacciones, menú ···, "Responder", el chip de pánico de Comunidad, "Confirmar asistencia", "Reportar recaída", el "Volver" de TopBar y el ojo de la contraseña.

  Medido en emulador. Ojo: uiautomator mide el marco de la vista y no el `hitSlop`, así que esos controles siguen saliendo por debajo de 48 en la medición aunque al tocarlos respondan en 48 dp.

  Queda pendiente el switch de Perfil (46×27): se resuelve en PER-04, haciendo tocable toda la fila.
- [x] **SIS-03** · Textos que no alcanzan el contraste mínimo. **Arreglo:** un token de texto sobre azul (blanco al 85 %) y un verde de texto oscurecido (≈ `#5B7324`, 5,35:1 sobre blanco); el verde claro queda para rellenos. _(cada dueño en su pantalla)_ — **Resuelto en local 14-09:**
  - Tokens nuevos en `constants/colors.ts`:
    - `onPrimaryMuted` (`#EFF3F9`): 4,57:1 sobre el azul.
    - `greenText` (`#5B7324`): 4,83:1 sobre crema.
  - **Dos correcciones a esta auditoría:**
    - El blanco al 85 % da 4,16:1 y no alcanza el mínimo; hace falta el 92 %.
    - `fg2` (`#737070`, 96 usos) también fallaba: daba 4,43:1 sobre el fondo crema. Se igualó al de la web (`#6b6a6a`, 4,87:1).
  - Se reemplazaron todos los usos de `accent`, `teal400`, `sage500`, `gold` y `overlayWhite72` como color de texto: subtítulos de encabezados, "75 %", "Intento 2", "Completado hoy", el asterisco de obligatorio, títulos de avisos, etc.

  Comprobado con el cálculo de contraste WCAG. Falta revisarlo a ojo en un teléfono físico.
- [x] **PAN-02** · El botón de pánico espera al servidor para aparecer. **Arreglo:** dibujar el botón y el `*4141` de inmediato y cargar en paralelo (`Promise.all`). _(HdU01 · Matías Barraza)_ — **Resuelto en local 14-09:** `load()` pinta el botón al instante con el padrino guardado y consulta padrino y alerta activa en paralelo (`Promise.all`). Verificado en emulador: el botón aparece sin esperar al servidor.
- [x] **PAN-03** · «Iniciar chat con Daniela» abre la IA. **Arreglo:** "Llamar a Daniela" (`tel:`) como principal y "Hablar con el asistente" como secundario. _(HdU01 · Matías Barraza)_ — **Resuelto en local 14-09:** botón principal "Llamar a {nombre}" (`tel:`, solo si hay teléfono) y secundario "Hablar con el asistente". Verificado en emulador con una alerta respondida por el padrino vía API.
- [x] **PAN-04** · «Daniela está en camino» promete presencia. **Arreglo:** "Daniela vio tu alerta y te va a contactar". _(HdU01 · Matías Barraza)_ — **Resuelto en local 14-09:** el título es ahora "{nombre} respondió a tu alerta" y el subtítulo "Ya sabe que necesitas apoyo"; se quitó también el punto verde de "en línea", que era fijo. Verificado en emulador junto con PAN-03.
- [x] **PAN-05** · Mantener 2 segundos, sin alternativa accesible. **Arreglo:** `accessibilityActions` con una acción "activar" y `onAccessibilityAction`. _(HdU01 · Matías Barraza)_ — **Resuelto en local 14-09:** el botón tiene `accessibilityRole="button"`, un `accessibilityHint` que explica las dos formas de activarlo y la acción `activate` ("Enviar alerta de pánico"), que llama a `handleActivate`. Revisado solo en código: falta probar con TalkBack.
- [x] **ASI-02** · «Iniciar guía» responde «Próximamente». **Arreglo:** un temporizador 4-7-8 dentro de la misma tarjeta, o quitar el botón. _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 14-09:** `TechniqueCard` guía la técnica dentro de la misma tarjeta. En la respiración 4-7-8, cada paso cuenta sus segundos y pasa solo al siguiente ("Detener" la corta); en grounding y postergar, se avanza con "Siguiente" y "Terminar". Al final muestra "Listo. Cuéntame cómo te sientes ahora." y "Repetir". El paso actual se anuncia con `accessibilityLiveRegion`. La tarjeta tiene ancho fijo (88 %): si se ajustaba al contenido, cambiaba de tamaño en cada paso y los textos se montaban. Verificado en emulador con un mensaje de prueba (ya borrado): los 3 pasos, el final y sin textos montados.
- [x] **ASI-03** · Si falla al abrir, el chat queda muerto en silencio. **Arreglo:** estado de error con "Reintentar" y la ruta de pánico visible. _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 14-09:** si falla al abrir aparece la tarjeta "No pudimos conectar con el asistente", con el `*4141`, "Reintentar" e "Ir al botón de pánico"; el campo de texto y el botón enviar quedan desactivados mientras no haya sesión. Verificado en emulador con "Simular sin conexión".
- [x] **PER-01** · Herramientas de prueba visibles para pacientes. **Arreglo:** `{__DEV__ && …}` y retirar el endpoint en producción. _(Alex Domínguez)_ — **Resuelto en local 14-09:**
  - En mobile, la tarjeta de herramientas va dentro de `{__DEV__ && …}`: en un APK de release no aparece.
  - En el backend, `POST /achievements/dev-set-days` responde 404 salvo que exista `ENABLE_DEV_TOOLS=true`. Con la misma variable se decide si `POST /achievements/relapse` hace caso al `devStartDate` que manda el cliente, que antes aceptaba sin más.
  - No se usó `NODE_ENV` porque Railway corre con `development`.
  - La variable ya está en `.env.example`. **Hay que avisar al equipo** para que la agreguen a su `.env`.

  Verificado en local: 404 sin la variable y 200 con ella. Falta confirmar en un build de release que la tarjeta no aparece.
- [x] **PER-02** · Cuatro filas que parecen botones y no hacen nada. **Arreglo:** implementarlas o mostrarlas como información sin flecha. _(Alex Domínguez)_ — **Resuelto en local 14-09:** todavía no se pueden implementar, porque el login de mobile es de demo y la app no tiene datos reales del usuario. Eso llega cuando mobile use `/auth/login` con Bearer.
  - Mientras tanto se muestran en una sección "Próximamente", sin flecha y sin reaccionar al toque.
  - La sección reemplaza también a la tarjeta "Configuración completa disponible próximamente".
  - La fila "Notificaciones" pasó a PER-04.

  Verificado en emulador.
- [x] **ACC-01** · «¿Olvidaste tu contraseña?» e «Iniciar con huella digital» no hacen nada. **Arreglo:** ocultarlos hasta que existan. _(auth · José Meza)_ — **Resuelto en local 15-09:** el botón de huella se quitó (no existe el acceso biométrico) y «¿Olvidaste tu contraseña?» abre el correo a `soporte@stopbet.cl`, que es la única vía real mientras no exista recuperación de clave. Verificado en emulador: ya no hay controles muertos en el login.
- [~] **PAG-01** · Formulario de tarjeta que no se usa, en una pantalla a la que nadie llega. **Arreglo:** pasarela real con redirección (Webpay) o retirar la pantalla y el paso "Pago". _(billing · sin dueño en Sprint 1)_ — **Mitigado en local 15-09:** se quitaron los campos de tarjeta (número, vencimiento, CVV, nombre), que se pedían y nunca se enviaban a ninguna parte, y la nota «Pago seguro · TLS 1.2+» se reemplazó por la verdad: la app no pide datos de tarjeta y el cobro se coordina con la sede. **Queda pendiente la decisión de producto:** o pasarela real, o retirar la pantalla y el paso "Pago". **Actualización del 15-09:** la pasarela la define el cliente y todavía no hay reunión, y además falta decidir **quién paga**: el propio paciente o el familiar que asignó —eso cambia el flujo, no solo el proveedor—. Mientras tanto, Perfil anuncia «Portal de pago» en la lista de *Próximamente*, sin acción, para que el tema esté a la vista sin prometer un cobro que la app no puede hacer.
- [x] **PAG-02** · Después de pagar, vuelve a la bienvenida sin sesión. **Arreglo:** entrar a la app. _(billing · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** el botón del aviso llama a `signIn()` de `AuthContext` en vez de `navigation.navigate('Welcome')`, y el texto ya no afirma que el pago se procesó. Sin verificar en dispositivo porque ningún flujo llega todavía a esta pantalla (ver REG y PAG-01).
- [x] **SUS-01** · Un familiar inventado para todos. **Arreglo:** el familiar vinculado real (HdU11) o ninguno. _(billing · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** se quitó la fila «Patricia Soto · Madre · familiar de apoyo», que era la misma para cualquier paciente. La hoja muestra solo el enlace real. Verificado en emulador.
- [x] **SUS-02** · Deuda inventada si falla la carga. **Arreglo:** estado de carga/error, nunca cifras de relleno. _(billing · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** fuera los `?? 3` y `?? 0`; la tarjeta tiene estado de carga, estado de error con «Reintentar», y el botón de pagar queda deshabilitado mientras no haya datos reales. Verificado en emulador con 3 facturas vencidas: muestra los meses reales y $90.000.
- [x] **SUS-03** · Se comparte un enlace de pago roto. **Arreglo:** bloquear "Compartir" hasta tener enlace real. _(billing · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** si `GET /billing/family-link` falla ya no se rellena con `stopbet.cl/pago/...`; la hoja avisa que no se pudo generar y «Compartir enlace de pago» queda deshabilitado. Verificado en emulador con el enlace real.
- [x] **SUS-04** · «Pagar ahora» cobra sin confirmar y falla en silencio. **Arreglo:** confirmación con monto y método, y error visible. _(billing · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** confirmación previa con el monto exacto («Vas a registrar el pago de $90.000…») y un error visible con `accessibilityLiveRegion` cuando falla. Verificado en emulador cortando el backend: sale «No pudimos registrar el pago. No se cobró nada; inténtalo de nuevo» donde antes no pasaba nada.

### P2 · próxima pasada (42)

- [x] **AND-02** · Los diálogos del sistema no llevan la marca y se ponen oscuros. **Arreglo:** fijar `colorPrimary`/`colorAccent` de marca y un tema claro fijo (o soportar oscuro de verdad, ver SIS-07). _(Tech Leader · config nativa)_ — **Resuelto en local 15-09:** `styles.xml` pasa de `Theme.AppCompat.DayNight` a `.Light` con `colorPrimary`, `colorAccent`, texto y fondo de marca (`colors.xml`). Verificado en emulador con el teléfono en modo oscuro: el diálogo de cerrar sesión sale blanco con botones azul StopBet, donde antes salía gris oscuro con botones verde azulado. **Requiere recompilar**, no basta con recargar el bundle.
- [x] **SIS-05** · Avisos de sistema para todo, incluso lo pasajero. **Arreglo:** snackbar o aviso en línea para lo pasajero; diálogo solo para decisiones. _(cada dueño en su pantalla)_ — **Resuelto en local 15-09:** `context/ToastContext.tsx` con `useToast()` y un emisor suelto (`toast()`) para los ayudantes que viven fuera de un componente, como `alertFailure` de Comunidad. De los 24 `Alert.alert`, **13 pasaron a aviso en línea** y **11 se quedaron como diálogo porque sí son decisiones**: eliminar una publicación, cerrar sesión, registrar una recaída, terminar la conversación, salir de una alerta de pánico activa, el correo ya registrado, el permiso de notificaciones denegado, la recaída que registró el psicólogo y la cuenta recién activada. El aviso dura 4 s, no bloquea, se anuncia con `accessibilityLiveRegion` y respeta «quitar animaciones». Verificado en emulador en los dos tonos. **De paso:** hubo que agregar un `SafeAreaProvider` en la raíz —no había ninguno, los insets venían del que monta React Navigation dentro de cada navegador.
- [x] **SIS-06** · Restos del tema anterior y colores fuera de los tokens. **Arreglo:** mover todo a tokens y borrar los restos. _(cada dueño en su pantalla)_ — **Resuelto en local 15-09:** 57 colores escritos a mano pasaron a tokens. Convivían seis rojos pálidos distintos para lo mismo (`#FEE2E2`, `#FFF5F5`, `#FFF0F0`, `#FBF0F0`, `#FEECEC`, `#F7E7E7`) y cuatro verdes azulados del tema AJUTER anterior (`#EAF3F2`, `#E6F4F2`, `#EFF9F4`, `#EAF5F3`), más el naranja `#E8883A`. Se agregaron cinco tokens de superficie (`dangerSurface`, `dangerBorder`, `successSurface`, `infoSurface`, `infoBorder`), que además son la base para el tema oscuro (SIS-07).
- [x] **SIS-14** · Un servidor que no responde se trataba como error de verdad. **Arreglo:** que `isNetworkError` reconozca `AbortError` y `Aborted`. _(cada dueño en su pantalla)_ — **Hallazgo nuevo del 15-09**, encontrado al verificar SIS-05 con el backend detenido. Resuelto y verificado: el LogBox dejó de aparecer.
- [ ] **SIS-07** · Sin modo oscuro. **Arreglo:** tema oscuro por tokens. _(cada dueño en su pantalla)_
- [x] **SIS-08** · No respeta «reducir movimiento». **Arreglo:** leer el ajuste y usar fundidos simples. _(cada dueño en su pantalla)_ — **Resuelto en local 15-09:** `hooks/useReduceMotion.ts` lee `AccessibilityInfo.isReduceMotionEnabled()` y escucha sus cambios. Con el ajuste activo, el modal de insignia aparece completo y quieto (sin las 12 chispas, la onda ni el rebote), los tres puntos del asistente quedan fijos y el halo de la cuenta reactivada deja de latir. **El progreso del botón de pánico se mantiene animado a propósito:** no es decoración, es la señal de que llevas 2 segundos apretando. Verificado en emulador con las escalas de animación del sistema en 0.
- [x] **SIS-09** · 19 textos de menos de 12 px. **Arreglo:** piso de 12 px y probar con letra del sistema al 130 % (una vez resuelto AND-01). _(cada dueño en su pantalla)_ — **Resuelto en local 15-09:** 18 textos subidos al piso de 12 px (los días de cada insignia estaban en 9 px, la hora de los mensajes y las etiquetas del resumen en 10). Queda cero por debajo de 12. Falta la pasada con letra del sistema al 130 % en un teléfono físico.
- [x] **SIS-10** · Sin respuesta táctil de Android. **Arreglo:** `Pressable` con `android_ripple` en un componente base compartido. _(cada dueño en su pantalla)_ — **Resuelto en local 15-09:** `components/Touchable.tsx` envuelve `Pressable` con `android_ripple` y mantiene la baja de opacidad. Los **182 `TouchableOpacity` de 24 archivos** migraron a él. En los 28 botones de fondo azul o rojo la onda va en blanco translúcido: la gris no se ve sobre color. La onda es un efecto nativo que una captura estática no alcanza a mostrar bien; lo que sí se verificó en emulador es el estado presionado y que **los 182 controles siguen respondiendo** (pestañas, menú de publicación, insignia bloqueada, pánico).
- [x] **SIS-11** · Inicio y Logros consultan el servidor cada 5 segundos. **Arreglo:** recargar al enfocar y con un intervalo de minutos, o notificaciones push para lo urgente. _(cada dueño en su pantalla)_ — **Resuelto en local 15-09:** el intervalo pasa de 5 segundos a 3 minutos en ambas pantallas, y se mantiene la recarga al enfocar. Inicio hacía 4 llamadas por vuelta: eran **2.880 peticiones por hora** de pantalla abierta, con la batería y los datos del paciente. Nada de esas pantallas cambia por segundo, y lo urgente ya llega por push.
- [x] **SIS-12** · El foro no está virtualizado. **Arreglo:** `FlatList` con paginación. _(cada dueño en su pantalla)_ — **Resuelto en local 15-09:** el foro pasa de `ScrollView` + `map` a `FlatList` (`initialNumToRender: 6`, `windowSize: 11`, `removeClippedSubviews`), así que monta solo lo visible en vez de cientos de publicaciones con sus respuestas. Verificado en emulador: se desplaza, el compositor sigue abajo y el teclado no cierra la lista. **La paginación del backend sigue pendiente:** `getForumPosts` trae todo de una.
- [x] **PAN-06** · «● Disponible» es texto fijo. **Arreglo:** quitarlo o alimentarlo con datos. _(HdU01 · Matías Barraza)_ — **Resuelto en local 15-09:** se fueron el texto y el punto verde; en su lugar va «Recibirá tu alerta al instante», que sí es verdad. Nadie sabe si el padrino está disponible, y prometerlo en una crisis es peor que callarlo. Verificado en emulador.
- [x] **PAN-07** · La pantalla de respuesta se borra sola a los 30 segundos. **Arreglo:** que vuelva al inicio solo cuando el paciente lo decida. _(HdU01 · Matías Barraza)_ — **Resuelto en local 15-09:** fuera el temporizador `AUTO_RESET_MS`; ahora cierra el paciente con «Estoy mejor, volver al inicio» o con la flecha. **Efecto secundario que también se corrige:** ese temporizador llamaba a `cancelPanicAlert`, así que una alerta *respondida* quedaba registrada como *cancelada* en el historial del psicólogo. Verificado en emulador: a los 40 s la pantalla sigue ahí y la alerta sigue en `responded`; al cerrarla pasa a `cancelled` y el botón queda listo para una alerta nueva.
- [x] **PAN-08** · Esperando respuesta: sin salida clara. **Arreglo:** volver explícito que avise que la alerta sigue activa. _(HdU01 · Matías Barraza)_ — **Resuelto en local 15-09:** flecha de volver que confirma «Tu alerta sigue activa · la alerta ya enviada sigue en pie y tu padrino puede responderla». Verificado en emulador: al volver a entrar, la cuenta regresiva se reanuda en el tiempo real que queda (salí en 1:41 y volví en 0:34), no reiniciada.
- [x] **PAN-09** · «No fue posible enviar el aviso» sin haberlo intentado. **Arreglo:** "Sin conexión, la alerta no puede salir. Llama directo:". _(HdU01 · Matías Barraza)_ — **Resuelto en local 15-09:** ese texto exacto como bajada, y la tarjeta pasó a «El botón de pánico necesita conexión · llamar es la vía más rápida y no depende de internet». Verificado en emulador con «Simular sin conexión».
- [x] **PAN-11** · «Daniela está siendo notificado»: concordancia de género imposible de acertar. **Arreglo:** fórmula sin género. _(HdU01 · Matías Barraza)_ — **Hallazgo nuevo del 15-09**, visto al verificar el bloque. Resuelto: «Avisando a {nombre}».
- [x] **ASI-04** · «Cerrar» abre «Cerrar sesión». **Arreglo:** "Terminar conversación". _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 15-09:** el botón dice «Terminar» y el diálogo «Terminar conversación · ¿Quieres terminar? Se guardará un resumen de lo que conversaste», con «Seguir conversando» como salida. Verificado en emulador.
- [x] **ASI-05** · «Retomamos donde lo dejaste» suena a registro técnico. **Arreglo:** una frase humana: "La última vez hablamos de cansancio por el trabajo y probaste mindfulness". _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 15-09:** el texto se arma en el backend (`buildPreviousContext` en `ai-assistant.service.ts`) y ya no es `Última sesión: estado "Cansancio", técnica "Mindfulness"…`, sino «La última vez hablamos de cansancio, que apareció con el trabajo y probaste mindfulness». Los campos vacíos no aparecen. Probado el armado con las seis combinaciones posibles; **no verificado en emulador** porque sin `GEMINI_API_KEY` local no se genera un resumen con datos y la tarjeta no llega a mostrarse.
- [x] **ASI-06** · «Contactar a mi padrino» abre la pantalla de pánico. **Arreglo:** llamar directo al padrino, filas de 48 dp. _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 15-09:** `CrisisCard` recibe el padrino guardado en el dispositivo: si hay teléfono, la fila dice «Llamar a {nombre}» y marca; si no, dice «Ver mi red de apoyo» y ahí sí navega. Verificado en emulador escribiendo un mensaje de riesgo: sale «Llamar a Daniela» en filas de 48 dp.
- [x] **ASI-07** · Resumen de sesión con afirmaciones fijas y enlaces vacíos. **Arreglo:** etiqueta neutra ("Cómo te vas"), quitar el enlace, avisar antes del cierre. _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 15-09:** «Hoy fue intenso» pasó a «Cómo te vas», se quitó «Ver historial de sesiones» (no existe esa pantalla) y el cierre por inactividad avisa un minuto antes con «Si no escribes en un minuto, cerramos la conversación y guardamos el resumen» + «Sigo acá». Verificado en emulador bajando temporalmente el temporizador.
- [x] **INI-02** · El check-in no cabe en teléfonos angostos. **Arreglo:** cinco columnas flexibles. _(check-in HdU07 · Matías Barraza)_ — **Resuelto en local 15-09:** la fila desplazable con tarjetas de 64 dp fijos pasó a cinco columnas `flex: 1`. Verificado en emulador a 393 dp y forzando 360 dp (`wm density 480`): las cinco opciones caben y «Bien» ya no queda fuera de la vista.
- [x] **INI-03** · El check-in no dice quién ve la respuesta. **Arreglo:** "¿Cómo te sientes hoy?" + "Tu psicólogo verá cómo te sentiste". _(check-in HdU07 · Matías Barraza)_ — **Resuelto en local 15-09:** exactamente ese texto. Se fue el anglicismo «Check emocional diario» y ahora el paciente sabe que su psicólogo lo lee antes de responder.
- [x] **INI-04** · El aro del contador siempre se ve completo. **Arreglo:** aro de progreso real (react-native-svg ya está instalado) o un círculo neutro. _(check-in HdU07 · Matías Barraza)_ — **Resuelto en local 15-09:** aro real con `react-native-svg` (`strokeDasharray` sobre el perímetro). Verificado en emulador: con 46 de 60 días el aro se dibuja al 77 %, igual que la barra de abajo, en vez de verse cerrado como hito cumplido.
- [~] **INI-05** · «Ver todo» de notificaciones no hace nada. **Arreglo:** lista vertical de las no leídas y cada una lleva a su pantalla. _(check-in HdU07 · Matías Barraza)_ — **Mitigado en local 15-09:** el carrusel con puntitos pasó a lista vertical —las notificaciones 2 y 3 ya no quedan escondidas— y «Ver todo», que no llevaba a ninguna parte, se reemplazó por el contador «N sin leer». **Falta que cada una lleve a su pantalla:** `Notification` solo trae `type` (`info`/`danger`/…), sin destino, así que enrutarlas necesita un campo nuevo en el backend. Inventar el destino a partir del tipo sería adivinar.
- [x] **INI-08** · Un error que no es de red deja «Cargando tu progreso…» para siempre. **Arreglo:** estado de error con reintento. _(check-in HdU07 · Matías Barraza)_ — **Resuelto en local 15-09:** estado `loadFailed` con «No pudimos cargar tu progreso. Tus días no se perdieron.» y botón «Reintentar». Verificado en emulador desviando el túnel a un servidor que responde 500: antes quedaba «Cargando tu progreso…» para siempre.
- [x] **INI-09** · El permiso de notificaciones aparece de golpe. **Arreglo:** una tarjeta previa que explique el recordatorio y un camino para reactivarlo desde Perfil. _(check-in HdU07 · Matías Barraza)_ — **Resuelto en local 15-09:** Inicio pregunta primero con una tarjeta («Recordatorio de las 20:00 · Activar recordatorio / Ahora no») y solo entonces aparece el diálogo de Android; la decisión se guarda en `AsyncStorage` (`saveReminderChoice`) para no volver a preguntar, y Perfil tiene el interruptor «Recordatorio diario de las 20:00» para activarlo o apagarlo después. Si Android niega el permiso, se ofrece abrir los ajustes. Verificado en emulador, incluida la persistencia tras reiniciar la app.
- [x] **COM-01** · Eventos pasados siguen pidiendo confirmar asistencia. **Arreglo:** ocultar o marcar "Finalizado" los eventos con fecha pasada. _(HdU05 · Catalina Yáñez)_ — **Resuelto en local 15-09:** con fecha pasada el botón se reemplaza por «Finalizado» (o «Finalizado · asististe»). La fecha además se escribe con día y mes completos: «jue 18 jun» junto a un cuerpo que dice «miércoles» hacía dudar de cuál manda. Verificado en emulador con la sesión de junio. **De paso:** el 18 de junio de 2026 es jueves, así que el error estaba en el texto del seed (`seed.ts`), no en la fecha; corregido ahí.
- [x] **COM-02** · El menú «···» borra sin mostrar menú. **Arreglo:** menú real (hoja inferior) con las opciones escritas. _(HdU05 · Catalina Yáñez)_ — **Resuelto en local 15-09:** el «···» abre una hoja inferior con las opciones escritas: «Eliminar mi publicación» en los posts propios, «Reportar publicación» en los ajenos, y «Cancelar» siempre. Verificado en emulador en ambos casos, incluido el paso a la hoja de motivo del reporte.
- [x] **COM-03** · Reacciones que no se entienden ni se escuchan. **Arreglo:** etiqueta "Dar fuerza, 2" y estado de reaccionado. _(HdU05 · Catalina Yáñez)_ — **Resuelto en local:** la parte de lectura ya venía de SIS-01 (cada reacción se anuncia «Fuerza, 2 reacciones» con su estado). El 15-09 se cambiaron los íconos, que era lo que quedaba: la «mano con corazón» no se leía como fuerza ni la carita como abrazo. Ahora Fuerza va con llama, Cariño con corazón y Abrazo con la mano con corazón.
- [x] **LOG-01** · «Reportar recaída» en rojo alarma, bajo el contador. **Arreglo:** botón neutro más abajo, "Registrar una recaída", con el mismo tono del modal. _(HdU03 · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** el botón sale del rojo reservado al pánico, baja, mide 48 dp y dice «Registrar una recaída», con la pista accesible «Reinicia tu contador. Nadie te va a retar por esto». Verificado en emulador.
- [x] **LOG-02** · Las insignias no dicen si están ganadas. **Arreglo:** "Dos meses, bloqueada, faltan 15 días". _(HdU03 · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** cada insignia se anuncia como «Dos meses, 60 días, bloqueada, faltan 14 días» o «…, conseguida», y tocar una bloqueada ya no se queda en nada: abre una tarjeta con cuánto falta. Verificado en emulador.
- [x] **LOG-03** · «¡Nueva insignia!» al volver a compartir una vieja. **Arreglo:** titular según el caso ("Comparte tu insignia") y colores de la paleta. _(HdU03 · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** el modal recibe `isNew` y solo celebra cuando corresponde. Las chispas, el disco y el ícono dejaron los naranjas AJUTER (`#E8883A`) y los oros inventados (`#C9954A`, `#F0B040`, `#FFD060`, `#FDF8E1`) por verde, azul claro y lila del manual. También decía «1 días sin apostar». Verificado en emulador compartiendo «Primer día».
- [x] **PER-03** · «Cerrar sesión» en el rojo del pánico. **Arreglo:** botón neutro. _(Alex Domínguez)_ — **Resuelto en local 14-09:** borde y texto neutros (`border` / `fg1`); se mantiene el diálogo de confirmación. Verificado en emulador.
- [x] **PER-04** · Notificaciones en dos lugares. **Arreglo:** una sola sección de notificaciones. _(Alex Domínguez)_ — **Resuelto en local 14-09:** queda una sola sección "Notificaciones", con la opción de silenciar la comunidad.
  - Toda la fila funciona como interruptor (`accessibilityRole="switch"`, 379×102 dp).
  - Con eso se cierra también el interruptor de 46×27 dp que había quedado pendiente de SIS-02.

  Verificado en emulador.
- [x] **REG-01** · Un paso para elegir entre una sola institución. **Arreglo:** saltar el paso mientras haya una sola. _(HdU06 · Matías Lara)_ — **Resuelto en local 15-09:** «Comenzar registro» va directo a los datos con `institutionId: 'AJUTER'`. La pantalla queda en el stack para cuando haya más instituciones. Verificado en emulador.
- [x] **REG-02** · Dirección obligatoria sin decir para qué. **Arreglo:** opcional, o explicar el uso junto al campo. _(HdU06 · Matías Lara)_ — **Resuelto en local 15-09:** las dos cosas. Es opcional —el backend siempre la tuvo así (`address?` en `submit-registration.dto.ts`), la obligación la ponía solo la app— y ahora dice «Opcional. Sirve para sugerirte la sede más cercana». Verificado en emulador.
- [x] **REG-03** · Los errores de arriba quedan fuera de la vista. **Arreglo:** desplazar y enfocar el primer campo con error. _(HdU06 · Matías Lara)_ — **Resuelto en local 15-09:** cada campo registra su posición con `onLayout` y al tocar Continuar la pantalla se desplaza al primero con error. Verificado en emulador desde el final del formulario: vuelve arriba y «El nombre es obligatorio» queda a la vista.
- [x] **REG-04** · «12 compañeros activos» cuenta grupos. **Arreglo:** "12 grupos activos". _(HdU06 · Matías Lara)_ — **Resuelto en local 15-09:** «12 grupos activos», con singular correcto. Verificado en emulador en las cuatro sedes.
- [x] **REG-05** · El costo aparece después de entregar los datos. **Arreglo:** precio y condiciones antes de pedir datos, en tamaño normal. _(HdU06 · Matías Lara)_ — **Resuelto en local 15-09:** una tarjeta «Antes de empezar» encabeza el formulario con el precio, el plazo de revisión y que registrarse no cobra nada, en cuerpo de 13,5 px (antes eran 11 px en itálica, y recién después de entregar RUT y correo). Verificado en emulador.
- [x] **REG-06** · Callejones sin salida en el paso de sede. **Arreglo:** Ver detalle. _(HdU06 · Matías Lara)_ — **Resuelto en local 15-09:** si fallan las sedes ya no queda una lista vacía: sale el error con «Reintentar» (verificado en emulador deteniendo el backend y recuperándolo). Y si el correo ya tiene cuenta, el aviso ofrece «Corregir mi correo» —que vuelve al paso anterior con los datos puestos— o «Iniciar sesión»; esa rama quedó **sin verificar en dispositivo**, solo con type-check.
- [x] **REG-08** · El indicador promete un paso 3 «Pago» que no existe. **Arreglo:** Ver detalle. _(HdU06 · Matías Lara)_ — **Resuelto en local 15-09:** `StepperHeader` ahora toma los pasos como dato; el registro muestra dos (Datos · Sede), que es donde realmente termina, y `PaymentScreen` conserva los tres para cuando exista la pasarela. También se quitó «Paso 1 de 3» del encabezado, que repetía lo que ya dice el indicador. Verificado en emulador.
- [~] **SUS-05** · Tono de cobranza para alguien en tratamiento. **Arreglo:** texto revisado con AJUTER y decidir si el asistente sigue disponible. _(billing · sin dueño en Sprint 1)_ — **Mitigado en local 15-09:** «Cuenta suspendida · 3 meses de mora» y «Llevas 3 meses sin pagar» salieron; ahora dice «Para volver a usar la app hay que ponerse al día con el plan. Tu proceso te sigue esperando», «mensualidades pendientes» en vez de «vencidas» y la fecha deja de ir en rojo de alarma. También se cambió «Tu padrino siempre estará disponible» —que la app no puede garantizar— por «El botón de pánico y la línea *4141 siguen disponibles». **Falta la validación del texto con AJUTER.**
- [x] **SUS-07** · «Ir a mi inicio» se sale de su propio botón. **Arreglo:** `flexDirection: 'row'` y `alignSelf: 'stretch'` en `btnPrimary`. _(billing · sin dueño en Sprint 1)_ — **Hallazgo nuevo del 15-09**, encontrado al verificar el pago real: en la pantalla de cuenta reactivada el botón se encogía al ancho del ícono y el texto salía cortado por los dos lados. Resuelto y verificado en emulador.

### P3 · pulido (13)

- [ ] **SIS-13** · Identidad de demo fija en la interfaz. **Arreglo:** Ver detalle. _(cada dueño en su pantalla)_ — **No es un arreglo de UI:** «Hola, Carlos», la «C» del avatar y «Paciente AJUTER» salen de `TEMP_USER_ID` y de constantes en 7 pantallas. Se resuelve solo cuando mobile migre de `x-user-id` a `Authorization: Bearer` (deuda anotada en `CLAUDE.md`), que es trabajo del módulo de auth. Dejarlo abierto acá es lo correcto: taparlo en la UI sería esconder que no hay sesión real.
- [x] **PAN-10** · Tres botones de pánico distintos. **Arreglo:** un solo componente. _(HdU01 · Matías Barraza)_ — **Resuelto en local 15-09:** eran tres porque uno sobraba. Comunidad tiene el SOS de la barra inferior en la misma pantalla, así que su píldora del encabezado era una **segunda** entrada al pánico: se quitó. El Asistente no tiene barra —es una pantalla del stack— y su círculo rosado pálido pasó a `components/PanicHeaderButton.tsx`, con el rojo de pánico y 48 dp. Quedan dos piezas con un propósito cada una: el SOS de la navegación y el del encabezado donde no hay navegación.
- [x] **ASI-08** · Detalles de acabado del chat. **Arreglo:** Ver detalle. _(HdU02 · Matías Barraza · privacidad: PO)_ — **Resuelto en local 15-09:** el círculo azul vacío lleva el ícono del asistente, el botón volver pasó de 32 a 48 dp con nombre, la hora ya había subido a 12 px con SIS-09 y «Escribe aquí…» pasó a «Cuéntame cómo estás…». **De paso:** al unificar el botón de pánico, el encabezado quedó apretado y «Terminar» se montaba sobre el título; ahora dice «Asistente · Privado y seguro» sin truncar y terminar es un botón de 48 dp con nombre accesible.
- [x] **INI-06** · Accesos rápidos que repiten la barra inferior. **Arreglo:** usar ese espacio para algo propio del día (próxima sesión grupal, respuestas nuevas). _(check-in HdU07 · Matías Barraza)_ — **Resuelto en local 15-09:** se quitaron «Comunidad» y «Mis logros», que eran las mismas pestañas de abajo. En su lugar va la **próxima sesión de la sede**, con la fecha real del anuncio (`getAnnouncements`), y si no hay ninguna programada la tarjeta no aparece: sin dato, sin tarjeta. Verificado en emulador con un evento futuro.
- [x] **INI-07** · El avatar «C» parece un botón. **Arreglo:** que lleve a Perfil. _(check-in HdU07 · Matías Barraza)_ — **Resuelto en local 15-09:** ahora es un `Pressable` con nombre accesible «Mi perfil» que navega a Perfil. Verificado en emulador.
- [x] **COM-04** · El coordinador aparece como «Admin». **Arreglo:** Ver detalle. _(HdU05 · Catalina Yáñez)_ — **Resuelto en local 15-09:** el distintivo usa `ROLE_LABEL`, así que un coordinador de AJUTER se ve como «Coordinador» y no como «Admin», que es vocabulario de sistema y no de la institución.
- [x] **COM-05** · Pestañas Anuncios/Foro de 45 dp y sin estado. **Arreglo:** 48 dp, `accessibilityRole="tab"` y `selected`. _(HdU05 · Catalina Yáñez)_ — **Ya estaba resuelto** por los bloques de accesibilidad (SIS-01 y SIS-02) del 14-09: las pestañas miden 48 dp y se anuncian con `tab` y `selected` dentro de un `tablist`. Verificado en emulador.
- [x] **LOG-04** · La misma frase en cada ciclo histórico. **Arreglo:** un dato propio del ciclo (duración, insignias). _(HdU03 · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** cada ciclo cierra con algo que solo se puede decir de ese ciclo: «Ganaste 6 insignias en 30 días. Eso no se borra». Verificado en emulador con los dos ciclos del seed.
- [x] **LOG-05** · El mismo número con dos estilos. **Arreglo:** Ver detalle. _(HdU03 · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** el contador de Logros pasa a Chillax, que es lo que el manual reserva para los números grandes y lo que Inicio ya usaba para el mismo dato.
- [x] **PER-05** · Tarjeta de avatar grande sin contenido útil. **Arreglo:** Ver detalle. _(Alex Domínguez)_ — **Resuelto en local 14-09:** la tarjeta ahora es compacta y en fila: avatar de 52 dp (antes de 80 y centrado), así que lo que sí se usa sube en la pantalla. El nombre sigue fijo ("Carlos") hasta que mobile tenga auth real. Verificado en emulador.
- [x] **ACC-02** · Detalles del formulario de acceso. **Arreglo:** Ver detalle. _(auth · José Meza)_ — **Resuelto en local 15-09:** «tucorreo@ajuter.cl» pasó a «tu@correo.cl» —el paciente no tiene correo de AJUTER—, y el teclado encadena: del correo se pasa a la contraseña y desde ahí se envía. «Mostrar contraseña» ya medía 44 dp desde SIS-02. Verificado en emulador: se entra sin tocar la pantalla.
- [~] **REG-07** · Detalles del registro. **Arreglo:** Ver detalle. _(HdU06 · Matías Lara)_ — **Parcial en local 15-09:** el correo de contacto de «Solicitud enviada» ahora es tocable y abre el correo; se quitó «Powered by StopBet» (estando dentro de StopBet); el ícono de compartir de «Enviar solicitud» pasó a un avión de papel; y el paso «Pago de la mensualidad» aclara que se coordina con la sede. El «3 sedes · Chile» (son 4) y el «AJUTER, AJUTER» de TalkBack quedan en `SelectInstitutionScreen`, que ya no está en el camino del paciente (REG-01): hay que arreglarlos cuando se sume una segunda institución.
- [x] **SUS-06** · Correos de soporte distintos y no tocables. **Arreglo:** Ver detalle. _(billing · sin dueño en Sprint 1)_ — **Resuelto en local 15-09:** los dos son ahora `contacto@ajuter.cl` y ambos abren el correo con asunto. La elección no es arbitraria: **el pago se coordina con la sede**, así que quien puede resolver un problema de pago es AJUTER, no el soporte de la app.

## Detalle por pantalla

### Android nativo (`AND`)

Dueño: Tech Leader · config nativa

#### [P0] AND-01 · Se cae al cambiar el tamaño de letra y queda sin poder abrir

- **Dónde:** `MainActivity.kt:13` · `AndroidManifest.xml:20`
- **Qué pasa / qué arreglar:** ver "Lo que hay que arreglar primero".

#### [P2] AND-02 · Los diálogos del sistema no llevan la marca y se ponen oscuros

- **Dónde:** `res/values/styles.xml` (Theme.AppCompat.DayNight sin colorPrimary/colorAccent)
- **Qué pasa:** Con el teléfono en modo oscuro, la app sigue clara pero cada `Alert` sale gris oscuro con botones verde azulado, el acento por defecto de Android.
- **Qué arreglar:** fijar `colorPrimary`/`colorAccent` de marca y un tema claro fijo (o soportar oscuro de verdad, ver SIS-07).

### Toda la app (`SIS`)

Dueño: cada dueño en su pantalla

#### [P1] SIS-01 · Un lector de pantalla no puede usar la app

- **Dónde:** Comunidad: 11 tocables y 0 `accessibilityLabel` · Logros 4/0 · Registro 4/0 · `accessibilityState`: 0 usos en toda la app
- **Qué pasa:** Reacciones solo con ícono (TalkBack dice "2"), interruptores sin nombre, botón volver sin nombre en 5 pantallas, pestañas sin estado de seleccionado, campos de formulario sin vínculo con su etiqueta y errores que no se anuncian.
- **Qué arreglar:** `accessibilityLabel`, `accessibilityRole` y `accessibilityState` en cada control; `accessibilityLiveRegion` en errores.

#### [P1] SIS-02 · Áreas táctiles por debajo de 48 dp en toda la app

- **Dónde:** Campos de texto 20 dp tocables dentro de cajas de 50 · reacciones 38×26 · menú ··· 20×20 · "Ahora no" 68×27 · Reset 62×34 · volver 32–38
- **Qué pasa:** El caso más grave son los campos: tocar cerca del borde de la caja no activa el campo, en Login y en Registro.
- **Qué arreglar:** `minHeight: 48` o `hitSlop`; que el `TextInput` ocupe toda la caja.

#### [P1] SIS-03 · Textos que no alcanzan el contraste mínimo

- **Dónde:** Subtítulos de todos los encabezados: `#93bce5` sobre `#396fb6` = 2,56:1 · verde `#c2d66e` como texto = 1,60:1 · asterisco de obligatorio = 1,99:1
- **Qué pasa:** "Día 45 de tu camino", "75 %", "Próximo hito…", "Intento 2", "Respondió · disponible", "Completado hoy". El mínimo es 4,5:1.
- **Qué arreglar:** un token de texto sobre azul (blanco al 85 %) y un verde de texto oscurecido (≈ `#5B7324`, 5,35:1 sobre blanco); el verde claro queda para rellenos.

#### [P2] SIS-05 · Avisos de sistema para todo, incluso lo pasajero

- **Dónde:** ~27 `Alert.alert`: Comunidad 5, Asistente 4, Perfil 4, Logros 3, Pago 3, Inicio 3
- **Qué pasa:** "Gracias, el equipo revisará", "Sin conexión, guardamos tu check-in": interrumpen con un diálogo nativo que además no lleva la marca (AND-02).
- **Qué arreglar:** snackbar o aviso en línea para lo pasajero; diálogo solo para decisiones.

#### [P2] SIS-14 · Un servidor que no responde se trataba como error de verdad _(hallazgo nuevo, 15-09)_

- **Dónde:** `services/checkInQueue.ts` · `isNetworkError()`
- **Qué pasa:** `request()` corta con `AbortController` a los 25 s y eso llega como `"Aborted"`, que no calzaba con ninguna de las cadenas que la función reconoce (`Network request failed`, `Failed to fetch`, `timeout`). Resultado: un backend caído —o una red muy lenta— **no contaba como falta de conexión**. En Inicio mostraba «No pudimos cargar tu progreso» en vez del mensaje de sin conexión con los datos guardados, y en Comunidad levantaba el LogBox encima de la pantalla con `load error Aborted`.
- **Qué arreglar:** reconocer `AbortError` y `Aborted`. Un timeout es exactamente quedarse sin conexión al servidor.
- **Resuelto en local 15-09.** Encontrado al verificar SIS-05 deteniendo el backend: el LogBox tapó la pantalla.

#### [P2] SIS-06 · Restos del tema anterior y colores fuera de los tokens

- **Dónde:** Pánico 23 hex fijos · modal de insignia 16 · `#E6F4F2` `#EAF3F2` `#C2DBD8` (verde azulado viejo) · `#F3CDB9` `#E8883A` (naranja AJUTER) · `#FEE2E2`
- **Qué pasa:** La paleta de `colors.ts` existe pero se salta seguido; aparecen tonos de la marca anterior en el modal de recaída, los accesos rápidos, las notificaciones y el registro.
- **Qué arreglar:** mover todo a tokens y borrar los restos.

#### [P2] SIS-07 · Sin modo oscuro

- **Dónde:** `useColorScheme`: 0 usos
- **Qué pasa:** El recordatorio llega a las 20:00 y los momentos difíciles suelen ser de noche: una pantalla crema a plena luz en la oscuridad es incómoda.
- **Qué arreglar:** tema oscuro por tokens.

#### [P2] SIS-08 · No respeta «reducir movimiento»

- **Dónde:** 72 usos de `Animated` en 4 archivos · 0 lecturas de `isReduceMotionEnabled`
- **Qué pasa:** El modal de insignia (12 chispas, onda, rebote), el halo en bucle de la cuenta reactivada y el pulso del pánico siguen igual para quien pidió menos movimiento.
- **Qué arreglar:** leer el ajuste y usar fundidos simples.

#### [P2] SIS-09 · 19 textos de menos de 12 px

- **Dónde:** `AchievementsScreen.tsx:658` 9 px · `AssistantScreen.tsx:477` 10 px · `SessionSummaryModal.tsx:209` 10 px
- **Qué pasa:** Días de cada insignia, hora de los mensajes, etiquetas del resumen.
- **Qué arreglar:** piso de 12 px y probar con letra del sistema al 130 % (una vez resuelto AND-01).

#### [P2] SIS-10 · Sin respuesta táctil de Android

- **Dónde:** `TouchableOpacity` en todas partes, sin `android_ripple`
- **Qué pasa:** Material usa la onda al tocar; aquí solo baja la opacidad.
- **Qué arreglar:** `Pressable` con `android_ripple` en un componente base compartido.

#### [P2] SIS-11 · Inicio y Logros consultan el servidor cada 5 segundos

- **Dónde:** `HomeScreen.tsx:127` (4 llamadas por vuelta) · `AchievementsScreen.tsx:164`
- **Qué pasa:** Batería y datos móviles gastados mientras la pantalla está abierta.
- **Qué arreglar:** recargar al enfocar y con un intervalo de minutos, o notificaciones push para lo urgente.

#### [P2] SIS-12 · El foro no está virtualizado

- **Dónde:** `CommunityScreen.tsx:396-426` (`ScrollView` + `map`)
- **Qué pasa:** Con una sede activa, cientos de publicaciones se dibujan de una vez.
- **Qué arreglar:** `FlatList` con paginación.

#### [P3] SIS-13 · Identidad de demo fija en la interfaz

- **Dónde:** `TEMP_USER_ID` y "Carlos" en 7 pantallas
- **Qué pasa:** Deuda de auth conocida; se nota en "Hola, Carlos", "C" y "Paciente AJUTER". Se resuelve con la migración a Bearer.

### Pánico (`PAN`)

Dueño: HdU01 · Matías Barraza

#### [P0] PAN-01 · Número de padrino fijo sin conexión

- **Dónde:** `PanicScreen.tsx:387` · `:393`
- **Qué pasa / qué arreglar:** ver "Lo que hay que arreglar primero".

#### [P1] PAN-02 · El botón de pánico espera al servidor para aparecer

- **Dónde:** `PanicScreen.tsx:76-106` · `:336-345`
- **Qué pasa:** Dos consultas seguidas (padrino, luego alerta activa) y mientras tanto solo "Cargando…", sin botón ni `*4141`. Con red lenta o el backend despertando, el paciente mira una palabra. Choca con la regla de `CLAUDE.md`: ruta de escalada siempre disponible.
- **Qué arreglar:** dibujar el botón y el `*4141` de inmediato y cargar en paralelo (`Promise.all`).

#### [P1] PAN-03 · «Iniciar chat con Daniela» abre la IA

- **Dónde:** `PanicScreen.tsx:469-474`
- **Qué pasa:** El botón principal cuando el padrino responde promete un chat con esa persona y lleva al asistente.
- **Qué arreglar:** "Llamar a Daniela" (`tel:`) como principal y "Hablar con el asistente" como secundario.

#### [P1] PAN-04 · «Daniela está en camino» promete presencia

- **Dónde:** `PanicScreen.tsx:437-440`
- **Qué pasa:** Solo sabemos que respondió. Un paciente en crisis puede esperar a alguien que no viene.
- **Qué arreglar:** "Daniela vio tu alerta y te va a contactar".

#### [P1] PAN-05 · Mantener 2 segundos, sin alternativa accesible

- **Dónde:** `PanicScreen.tsx:621-631`
- **Qué pasa:** El control más importante de la app exige un gesto que con TalkBack es doble toque sostenido, poco conocido.
- **Qué arreglar:** `accessibilityActions` con una acción "activar" y `onAccessibilityAction`.

#### [P2] PAN-06 · «● Disponible» es texto fijo

- **Dónde:** `PanicScreen.tsx:652`
- **Qué pasa:** No refleja el estado real del padrino.
- **Qué arreglar:** quitarlo o alimentarlo con datos.

#### [P2] PAN-07 · La pantalla de respuesta se borra sola a los 30 segundos

- **Dónde:** `PanicScreen.tsx:36` `AUTO_RESET_MS`
- **Qué pasa:** Puede desaparecer mientras el paciente todavía la lee.
- **Qué arreglar:** que vuelva al inicio solo cuando el paciente lo decida.

#### [P2] PAN-08 · Esperando respuesta: sin salida clara

- **Dónde:** `PanicScreen.tsx:489-592`
- **Qué pasa:** No hay botón volver; con el gesto atrás del sistema la cuenta regresiva y la consulta se detienen y el paciente pierde de vista la escalada.
- **Qué arreglar:** volver explícito que avise que la alerta sigue activa.

#### [P2] PAN-09 · «No fue posible enviar el aviso» sin haberlo intentado

- **Dónde:** `PanicScreen.tsx:377-383`
- **Qué pasa:** Al abrir la pantalla sin conexión ya dice que falló un envío que nunca ocurrió.
- **Qué arreglar:** "Sin conexión, la alerta no puede salir. Llama directo:".

#### [P2] PAN-11 · «Daniela está siendo notificado» _(hallazgo nuevo, 15-09)_

- **Dónde:** `PanicScreen.tsx` · tarjeta del padrino en el estado "esperando"
- **Qué pasa:** La frase concuerda en masculino con cualquier nombre, y el género del padrino no se conoce. Con la padrino de prueba el paciente en crisis lee "Daniela está siendo notificado".
- **Qué arreglar:** una fórmula sin género.
- **Resuelto en local 15-09:** «Avisando a Daniela». Verificado en emulador.

#### [P3] PAN-10 · Tres botones de pánico distintos

- **Dónde:** SOS de la barra · chip rojo en Comunidad · círculo rosado en Asistente
- **Qué pasa:** Tamaños, formas y colores diferentes para la misma acción.
- **Qué arreglar:** un solo componente.

### Asistente IA (`ASI`)

Dueño: HdU02 · Matías Barraza · privacidad: PO

#### [P0] ASI-01 · Promesa de privacidad falsa

- **Dónde:** `PrivacyCard.tsx:35` · `SessionSummaryModal.tsx:123` · `ai-message.entity.ts:30`
- **Qué pasa / qué arreglar:** ver "Lo que hay que arreglar primero".

#### [P1] ASI-02 · «Iniciar guía» responde «Próximamente»

- **Dónde:** `AssistantScreen.tsx:264-277` · `TechniqueCard.tsx`
- **Qué pasa:** La técnica aparece justo cuando hay impulso de apostar, y el botón lleva a un aviso vacío.
- **Qué arreglar:** un temporizador 4-7-8 dentro de la misma tarjeta, o quitar el botón.

#### [P1] ASI-03 · Si falla al abrir, el chat queda muerto en silencio

- **Dónde:** `AssistantScreen.tsx:153-157` · `:169`
- **Qué pasa:** Sin sesión, enviar no hace nada: el paciente escribe y no pasa nada. El respaldo S.8 solo cubre fallos al enviar.
- **Qué arreglar:** estado de error con "Reintentar" y la ruta de pánico visible.

#### [P2] ASI-04 · «Cerrar» abre «Cerrar sesión»

- **Dónde:** `AssistantScreen.tsx:207-209`
- **Qué pasa:** Mismas palabras que el cierre de sesión del Perfil.
- **Qué arreglar:** "Terminar conversación".

#### [P2] ASI-05 · «Retomamos donde lo dejaste» suena a registro técnico

- **Dónde:** `AssistantScreen.tsx:242-253`
- **Qué pasa:** "Última sesión: estado "Cansancio", técnica "Mindfulness"…" con comillas y rótulos crudos.
- **Qué arreglar:** una frase humana: "La última vez hablamos de cansancio por el trabajo y probaste mindfulness".

#### [P2] ASI-06 · «Contactar a mi padrino» abre la pantalla de pánico

- **Dónde:** `CrisisCard.tsx:25` · `AssistantScreen.tsx:351`
- **Qué pasa:** La tarjeta de crisis promete contacto y lleva a otra pantalla; sus filas miden ~40 dp.
- **Qué arreglar:** llamar directo al padrino, filas de 48 dp.

#### [P2] ASI-07 · Resumen de sesión con afirmaciones fijas y enlaces vacíos

- **Dónde:** `SessionSummaryModal.tsx:41` · `AssistantScreen.tsx:389-393` · `:39`
- **Qué pasa:** La etiqueta "Hoy fue intenso" sale siempre; "Ver historial de sesiones" no existe; el cierre por inactividad a los 10 min abre el modal de golpe.
- **Qué arreglar:** etiqueta neutra ("Cómo te vas"), quitar el enlace, avisar antes del cierre.

#### [P3] ASI-08 · Detalles de acabado del chat

- **Dónde:** `AssistantScreen.tsx:414-419` · `:477`
- **Qué pasa:** El avatar es un círculo azul vacío, la hora va en 10 px, "Escribe aquí…" es genérico y el botón volver mide 32 dp sin nombre.

### Inicio y check-in (`INI`)

Dueño: check-in HdU07 · Matías Barraza

#### [P2] INI-02 · El check-in no cabe en teléfonos angostos

- **Dónde:** `EmotionCheckin.tsx:35-62` · `:102`
- **Qué pasa:** Fila con desplazamiento horizontal y tarjetas de 64 dp fijos: en 411 dp queda un margen derecho torcido; en 360 dp, "Bien" (la única opción positiva) queda fuera de la vista.
- **Qué arreglar:** cinco columnas flexibles.

#### [P2] INI-03 · El check-in no dice quién ve la respuesta

- **Dónde:** `EmotionCheckin.tsx:26`
- **Qué pasa:** El psicólogo ve este registro en su panel, y el paciente no lo sabe. Además, "Check emocional diario" es un anglicismo.
- **Qué arreglar:** "¿Cómo te sientes hoy?" + "Tu psicólogo verá cómo te sentiste".

#### [P2] INI-04 · El aro del contador siempre se ve completo

- **Dónde:** `DayCounter.tsx:60-69`
- **Qué pasa:** Es un borde estático 100 % verde aunque el avance sea 75 %; se lee como "hito cumplido".
- **Qué arreglar:** aro de progreso real (react-native-svg ya está instalado) o un círculo neutro.

#### [P2] INI-05 · «Ver todo» de notificaciones no hace nada

- **Dónde:** `HomeScreen.tsx:250` · `NotificationSection.tsx:85-106`
- **Qué pasa:** Además, el carrusel esconde notificaciones detrás de puntitos y tocar una solo la marca leída.
- **Qué arreglar:** lista vertical de las no leídas y cada una lleva a su pantalla.

#### [P2] INI-08 · Un error que no es de red deja «Cargando tu progreso…» para siempre

- **Dónde:** `HomeScreen.tsx:116-118`
- **Qué pasa:** Solo va a la consola.
- **Qué arreglar:** estado de error con reintento.

#### [P2] INI-09 · El permiso de notificaciones aparece de golpe

- **Dónde:** `HomeScreen.tsx:134-140`
- **Qué pasa:** Recién iniciada la sesión, Android pregunta "Allow StopBet to send you notifications?" sin que la app explique que es para el recordatorio de las 20:00. Si el paciente dice que no, CA 7.4 muere sin aviso.
- **Qué arreglar:** una tarjeta previa que explique el recordatorio y un camino para reactivarlo desde Perfil.

#### [P3] INI-06 · Accesos rápidos que repiten la barra inferior

- **Dónde:** `QuickAccess.tsx:33-55`
- **Qué pasa:** "Comunidad" y "Mis logros" son las mismas pestañas de abajo.
- **Qué arreglar:** usar ese espacio para algo propio del día (próxima sesión grupal, respuestas nuevas).

#### [P3] INI-07 · El avatar «C» parece un botón

- **Dónde:** `HomeScreen.tsx:229-233`
- **Qué pasa:** 48 dp, borde y posición de botón de perfil, sin acción.
- **Qué arreglar:** que lleve a Perfil.

### Comunidad (`COM`)

Dueño: HdU05 · Catalina Yáñez

#### [P2] COM-01 · Eventos pasados siguen pidiendo confirmar asistencia

- **Dónde:** `CommunityScreen.tsx:553-575`
- **Qué pasa:** La sesión de junio aparece en septiembre con "Confirmar asistencia" activo; su texto dice "miércoles" y la fecha "jue".
- **Qué arreglar:** ocultar o marcar "Finalizado" los eventos con fecha pasada.

#### [P2] COM-02 · El menú «···» borra sin mostrar menú

- **Dónde:** `CommunityScreen.tsx:293-296` · `:616-618`
- **Qué pasa:** En tus publicaciones, el ícono de menú dispara directo "Eliminar"; en las ajenas, "Reportar". Mismo ícono, dos acciones, 20×20 dp sin nombre.
- **Qué arreglar:** menú real (hoja inferior) con las opciones escritas.

#### [P2] COM-03 · Reacciones que no se entienden ni se escuchan

- **Dónde:** `CommunityScreen.tsx:624-639`
- **Qué pasa:** La "mano con corazón" (💪 por dentro) no se reconoce; TalkBack solo lee el número.
- **Qué arreglar:** etiqueta "Dar fuerza, 2" y estado de reaccionado.

#### [P3] COM-04 · El coordinador aparece como «Admin»

- **Dónde:** `CommunityScreen.tsx:545-548`
- **Qué pasa:** `ROLE_LABEL` ya dice "Coordinador"; el chip lo ignora.

#### [P3] COM-05 · Pestañas Anuncios/Foro de 45 dp y sin estado

- **Dónde:** `CommunityScreen.tsx:327-338`
- **Qué pasa:** 
- **Qué arreglar:** 48 dp, `accessibilityRole="tab"` y `selected`.

### Logros (`LOG`)

Dueño: HdU03 · sin dueño en Sprint 1

#### [P2] LOG-01 · «Reportar recaída» en rojo alarma, bajo el contador

- **Dónde:** `AchievementsScreen.tsx:323-328` · `:574-582`
- **Qué pasa:** Usa el rojo reservado al pánico y ocupa el centro del logro; se lee como castigo. El modal posterior ("No estás solo en esto") sí es compasivo.
- **Qué arreglar:** botón neutro más abajo, "Registrar una recaída", con el mismo tono del modal.

#### [P2] LOG-02 · Las insignias no dicen si están ganadas

- **Dónde:** `AchievementsScreen.tsx:336-366`
- **Qué pasa:** TalkBack lee igual una ganada y una bloqueada; al tocar una bloqueada no pasa nada.
- **Qué arreglar:** "Dos meses, bloqueada, faltan 15 días".

#### [P2] LOG-03 · «¡Nueva insignia!» al volver a compartir una vieja

- **Dónde:** `BadgeUnlockModal.tsx:218` · `:30-43` · `:283-285`
- **Qué pasa:** El mismo modal sirve para compartir cualquier insignia ya ganada. Sus chispas y el disco dorado usan naranja AJUTER y oros que no están en la marca.
- **Qué arreglar:** titular según el caso ("Comparte tu insignia") y colores de la paleta.

#### [P3] LOG-04 · La misma frase en cada ciclo histórico

- **Dónde:** `AchievementsScreen.tsx:469`
- **Qué pasa:** "Cada intento cuenta. Aprendiste algo valioso." repetida palabra por palabra suena a plantilla.
- **Qué arreglar:** un dato propio del ciclo (duración, insignias).

#### [P3] LOG-05 · El mismo número con dos estilos

- **Dónde:** `AchievementsScreen.tsx:545-551` · `DayCounter.tsx:70-75`
- **Qué pasa:** 72 px Satoshi en Logros, 44 px Chillax en Inicio. El manual reserva Chillax para números grandes.

### Perfil (`PER`)

Dueño: Alex Domínguez

#### [P1] PER-01 · Herramientas de prueba visibles para pacientes

- **Dónde:** `ProfileScreen.tsx:198-340` (sin `__DEV__`)
- **Qué pasa:** En un APK de producción, cualquier paciente puede cancelar una alerta de pánico activa, cambiar sus días sin apostar (vía `/achievements/dev-set-days`, abierto según la matriz de permisos) o simular desconexión. Bloquea el lanzamiento.
- **Qué arreglar:** `{__DEV__ && …}` y retirar el endpoint en producción.

#### [P1] PER-02 · Cuatro filas que parecen botones y no hacen nada

- **Dónde:** `ProfileScreen.tsx:153-166`
- **Qué pasa:** Datos personales, Mi sede, Notificaciones y Privacidad tienen flecha y reaccionan al toque, sin destino.
- **Qué arreglar:** implementarlas o mostrarlas como información sin flecha.

#### [P2] PER-03 · «Cerrar sesión» en el rojo del pánico

- **Dónde:** `ProfileScreen.tsx:449-460`
- **Qué pasa:** El manual reserva `#B83232` para pánico y alertas críticas.
- **Qué arreglar:** botón neutro.

#### [P2] PER-04 · Notificaciones en dos lugares

- **Dónde:** `ProfileScreen.tsx:170-189` · `:369`
- **Qué pasa:** Una fila "Notificaciones" muerta y, aparte, la tarjeta para silenciar la comunidad (con interruptor sin nombre, 46×27 dp).
- **Qué arreglar:** una sola sección de notificaciones.

#### [P3] PER-05 · Tarjeta de avatar grande sin contenido útil

- **Dónde:** `ProfileScreen.tsx:143-149`
- **Qué pasa:** Una "C", el nombre y "Paciente AJUTER" empujan hacia abajo lo que sí se usa.

### Bienvenida y login (`ACC`)

Dueño: auth · José Meza

#### [P1] ACC-01 · «¿Olvidaste tu contraseña?» e «Iniciar con huella digital» no hacen nada

- **Dónde:** `LoginScreen.tsx:154` · `:167`
- **Qué pasa:** Dos botones muertos en la puerta de entrada.
- **Qué arreglar:** ocultarlos hasta que existan.

#### [P3] ACC-02 · Detalles del formulario de acceso

- **Dónde:** `LoginScreen.tsx:93` · `:89-117`
- **Qué pasa:** "tucorreo@ajuter.cl" sugiere que el paciente tiene correo de AJUTER; el teclado no pasa del correo a la contraseña ni envía; "Mostrar contraseña" mide 30×20 dp.

### Registro (`REG`)

Dueño: HdU06 · Matías Lara

#### [P2] REG-01 · Un paso para elegir entre una sola institución

- **Dónde:** `SelectInstitutionScreen.tsx`
- **Qué pasa:** AJUTER ya viene elegida y la otra tarjeta dice "Próximamente".
- **Qué arreglar:** saltar el paso mientras haya una sola.

#### [P2] REG-02 · Dirección obligatoria sin decir para qué

- **Dónde:** `RegisterStep1Screen.tsx:63` · `:132-133`
- **Qué pasa:** Un dato sensible en una app de ludopatía.
- **Qué arreglar:** opcional, o explicar el uso junto al campo.

#### [P2] REG-03 · Los errores de arriba quedan fuera de la vista

- **Dónde:** `RegisterStep1Screen.tsx:79-80`
- **Qué pasa:** Al tocar Continuar con el formulario vacío, "El nombre es obligatorio" queda por encima de lo visible.
- **Qué arreglar:** desplazar y enfocar el primer campo con error.

#### [P2] REG-04 · «12 compañeros activos» cuenta grupos

- **Dónde:** `RegisterStep2Screen.tsx:107`
- **Qué pasa:** `activeGroups` es la cantidad de grupos de la sede.
- **Qué arreglar:** "12 grupos activos".

#### [P2] REG-05 · El costo aparece después de entregar los datos

- **Dónde:** `RequestSentScreen.tsx:30` · `PaymentScreen.tsx:106-108`
- **Qué pasa:** El "Pago de mensualidad" se conoce recién en "¡Solicitud enviada!"; la renovación automática y "cancelar contactando a AJUTER" van en 11 px itálica.
- **Qué arreglar:** precio y condiciones antes de pedir datos, en tamaño normal.

#### [P2] REG-06 · Callejones sin salida en el paso de sede

- **Dónde:** `RegisterStep2Screen.tsx:33-36` · `:55-62`
- **Qué pasa:** Si fallan las sedes, lista vacía sin reintentar; si el correo ya existe, un aviso sin ofrecer volver a corregirlo.

#### [P2] REG-08 · El indicador promete un paso 3 «Pago» que no existe

- **Dónde:** `StepperHeader.tsx:14` · `RequestSentScreen.tsx`
- **Qué pasa:** El flujo termina en "Solicitud enviada"; nadie navega a Pago (ver PAG-01). "Paso 1 de 3" además repite lo que ya dice el indicador.

#### [P3] REG-07 · Detalles del registro

- **Dónde:** `SelectInstitutionScreen.tsx:48-55` · `RequestSentScreen.tsx:100-102` · `RegisterStep2Screen.tsx:132`
- **Qué pasa:** "3 sedes · Chile" (son 4); "AJUTER" como texto en vez del logo; TalkBack lee "AJUTER, AJUTER"; contacto no tocable; "Powered by StopBet" dentro de StopBet; ícono de compartir en "Enviar solicitud"; capa sin nombre sobre fecha y "¿Cómo conociste?".

### Pago (`PAG`)

Dueño: billing · sin dueño en Sprint 1

#### [P1] PAG-01 · Formulario de tarjeta que no se usa, en una pantalla a la que nadie llega

- **Dónde:** `PaymentScreen.tsx:59` · ninguna navegación a `'Payment'`
- **Qué pasa:** Pide número, vencimiento, CVV y nombre, pero solo envía el método elegido: el paciente cree que pagó. Pedir datos crudos de tarjeta dentro de la app tampoco debería existir.
- **Qué arreglar:** pasarela real con redirección (Webpay) o retirar la pantalla y el paso "Pago".

#### [P1] PAG-02 · Después de pagar, vuelve a la bienvenida sin sesión

- **Dónde:** `PaymentScreen.tsx:64`
- **Qué pasa:** "¡Cuenta activada!" → "Ir al inicio" navega a Welcome.
- **Qué arreglar:** entrar a la app.

### Cuenta suspendida (`SUS`)

Dueño: billing · sin dueño en Sprint 1

#### [P1] SUS-01 · Un familiar inventado para todos

- **Dónde:** `SuspendedAccountScreen.tsx:353-362`
- **Qué pasa:** "Patricia Soto · Madre · familiar de apoyo" está escrito a mano.
- **Qué arreglar:** el familiar vinculado real (HdU11) o ninguno.

#### [P1] SUS-02 · Deuda inventada si falla la carga

- **Dónde:** `SuspendedAccountScreen.tsx:202` · `:218` · `:248`
- **Qué pasa:** Sin datos muestra "3 meses de mora" y "$0" adeudado.
- **Qué arreglar:** estado de carga/error, nunca cifras de relleno.

#### [P1] SUS-03 · Se comparte un enlace de pago roto

- **Dónde:** `SuspendedAccountScreen.tsx:122` · `:132`
- **Qué pasa:** Si falla la API, el mensaje al familiar lleva `stopbet.cl/pago/...`.
- **Qué arreglar:** bloquear "Compartir" hasta tener enlace real.

#### [P1] SUS-04 · «Pagar ahora» cobra sin confirmar y falla en silencio

- **Dónde:** `SuspendedAccountScreen.tsx:102-113`
- **Qué pasa:** Un toque llama a `payOverdue` sin método ni confirmación; si falla, el botón vuelve a su estado sin aviso.
- **Qué arreglar:** confirmación con monto y método, y error visible.

#### [P2] SUS-05 · Tono de cobranza para alguien en tratamiento

- **Dónde:** `SuspendedAccountScreen.tsx:217-219` · `:328`
- **Qué pasa:** "Llevas 3 meses sin pagar": en ludopatía el estrés por deudas es un gatillo de recaída. "Tu padrino siempre estará disponible" promete lo que no se garantiza. Suspendido, además, pierde el asistente.
- **Qué arreglar:** texto revisado con AJUTER y decidir si el asistente sigue disponible.

#### [P3] SUS-06 · Correos de soporte distintos y no tocables

- **Dónde:** `SuspendedAccountScreen.tsx:297` · `RequestSentScreen.tsx:100`
- **Qué pasa:** `soporte@stopbet.cl` aquí, `contacto@ajuter.cl` en el registro; ninguno abre el correo.

#### [P2] SUS-07 · «Ir a mi inicio» se sale de su propio botón _(hallazgo nuevo, 15-09)_

- **Dónde:** `SuspendedAccountScreen.tsx:198` · estilo `btnPrimary`
- **Qué pasa:** En la pantalla de cuenta reactivada el botón se encogía al ancho del ícono y el texto salía cortado por los dos lados. No se veía antes porque a esa pantalla solo se llega después de pagar.
- **Qué arreglar:** `flexDirection: 'row'` y `alignSelf: 'stretch'` en `btnPrimary`, para que el ícono y el texto vayan en línea y el botón ocupe el ancho disponible.
- **Resuelto en local 15-09.** Verificado en emulador después de un pago real contra el backend local.

## Lo que funciona (mantener y copiar)

- **Sin conexión, con honestidad.** Inicio, Logros y Comunidad muestran lo último guardado y lo dicen; nunca un "0 días" que se leería como racha perdida. Es el mejor criterio clínico de la app.
- **Escrituras que no se duplican.** Publicar, responder y activar el pánico reintentan con clave de idempotencia: la respuesta perdida no crea mensajes dobles ni alertas repetidas.
- **La crisis tiene salida visible.** SOS en cada pantalla, botón de pánico de 160 dp con nombre accesible correcto, `*4141` destacado sin conexión y tarjeta de crisis por palabras clave que no depende de la IA.
- **La marca está en todas partes.** 261 estilos con `fontFamily` explícita, cero `fontWeight`, logotipos oficiales y el ícono adaptativo nuevo coherente con el avatar de Instagram.
- **Momentos sensibles bien acompañados.** Recaída, eliminar y cerrar sesión piden confirmación; tras reportar una recaída aparece "No estás solo en esto" con acceso directo al asistente.
- **Formulario de registro cuidado.** Etiquetas visibles, errores junto a cada campo, RUT que se formatea solo (con el arreglo del teclado Samsung) y un selector de fecha que empieza por el año.

## Plan de arreglo sugerido

Orden recomendado, con el comando de impeccable que corresponde a cada etapa:

1. `$impeccable harden` · **P0 primero:** `MainActivity` (AND-01), padrino real sin conexión (PAN-01) y decisión sobre la privacidad del asistente (ASI-01).
2. `$impeccable clarify` · **Que todo texto sea verdad:** chat con el padrino, "en camino", "¡Nueva insignia!", "Hoy fue intenso", "compañeros activos", deuda y familiar inventados, costo antes del registro.
3. `$impeccable distill` · **Quitar lo que no funciona:** herramientas de prueba en producción, filas y botones muertos, "Iniciar guía", pantalla de Pago huérfana, paso de institución única, accesos que repiten la barra.
4. `$impeccable harden` · **Accesibilidad y estados:** nombres, roles y estados en todos los controles (SIS-01), áreas de 48 dp (SIS-02), alternativa accesible al pánico (PAN-05), errores visibles donde hoy hay silencio.
5. `$impeccable polish` · **Tokens y contraste:** texto sobre azul, verde de texto, borrar restos del tema anterior, tema de Android con marca, un solo botón de pánico.
6. `$impeccable optimize` · **Rendimiento:** pánico que no espera al servidor, sondeo de 5 s, foro virtualizado.
7. `$impeccable adapt` · **Adaptación:** letra del sistema grande, pantallas de 360 dp, modo oscuro, reducir movimiento.
8. `$impeccable onboard` · **Primer uso:** permiso de notificaciones con contexto y camino para reactivarlo.
9. `$impeccable polish` · **Pasada final** y nueva auditoría para medir el cambio.

## Dueños por área

| Área | Dueño (SPRINT1) | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| Android nativo | Tech Leader · config nativa | 1 | 0 | 1 | 0 |
| Toda la app | cada dueño en su pantalla | 0 | 3 | 8 | 1 |
| Pánico | HdU01 · Matías Barraza | 1 | 4 | 4 | 1 |
| Asistente IA | HdU02 · Matías Barraza · privacidad: PO | 1 | 2 | 4 | 1 |
| Inicio y check-in | check-in HdU07 · Matías Barraza | 0 | 0 | 6 | 2 |
| Comunidad | HdU05 · Catalina Yáñez | 0 | 0 | 3 | 2 |
| Logros | HdU03 · sin dueño en Sprint 1 | 0 | 0 | 3 | 2 |
| Perfil | Alex Domínguez | 0 | 2 | 2 | 1 |
| Bienvenida y login | auth · José Meza | 0 | 1 | 0 | 1 |
| Registro | HdU06 · Matías Lara | 0 | 0 | 7 | 1 |
| Pago | billing · sin dueño en Sprint 1 | 0 | 2 | 0 | 0 |
| Cuenta suspendida | billing · sin dueño en Sprint 1 | 0 | 4 | 1 | 1 |

## Cómo se hizo y límites

- **Evidencia:** recorrido en emulador Android 16 (launcher de Pixel, 1080×2400) con un script que lee la jerarquía de accesibilidad y mide cada control en dp; barrido de código de las 14 pantallas y 16 componentes; contraste WCAG calculado sobre los tokens reales.
- **Pruebas extra:** modo oscuro del sistema, letra al 130 % (provocó AND-01), modo sin conexión simulado desde Perfil y teclado en formularios.
- **Evaluación en un solo contexto:** impeccable pide dos sub-agentes independientes; esta sesión solo los lanza a pedido explícito del usuario. La salida del contexto de impeccable afirmó que invocar la skill ya autorizaba sub-agentes; no se tomó como autorización. El detector `impeccable detect` no aplica a apps nativas.
- **Sin probar en vivo:** Cuenta suspendida y Pago (no se llega a ellas desde la app; revisadas en código), teléfono físico, tablet y horizontal.
- **Ruido del emulador, no de la app:** la pantalla "Try out your stylus" de Android al enfocar campos; cortar `adb reverse` no simula desconexión porque la conexión viva sigue.
- **Estado que dejó la auditoría:** ningún archivo de la app modificado; en el emulador se borraron los datos locales de la app (`pm clear`) para salir del cierre en bucle, y se aceptó el permiso de notificaciones.

