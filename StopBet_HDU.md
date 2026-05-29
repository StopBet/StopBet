**![](data:image/jpeg;base64...)**

**STOPBET**

Historias de Usuario

GPI-2026-1 | GRUPO-04 | Campus Casa Central

|  |  |  |
| --- | --- | --- |
| **Nombre** | **Rol en equipo** | **Celular** |
| Alex Domínguez Montiel | Product Owner | +56 9 6339 3232 |
| José Meza Pontigo | Scrum Master | +56 9 5510 0195 |
| Matías Lara Plaza | Tech Leader | +56 9 5700 9580 |
| Catalina Yañez Ardissoni | UI/UX | +56 9 9992 1522 |
| Eduardo Pacheco Brito | Testing | +56 9 3254 7161 |
| Matías Barraza Huerta | Marketing | +56 9 4574 1717 |

27-05-2026

**1. Resumen del Proyecto**

**Situación y problema**

La ludopatía es una adicción reconocida clínicamente al mismo nivel que las adicciones a sustancias. En Chile, se estima que el 8,3% de la población presenta conductas de juego problemático, y el país se encuentra entre los 10 con mayor crecimiento en apuestas online a nivel mundial. El problema se agrava porque las apuestas ya no se limitan a un casino físico, sino que están disponibles las 24 horas en el celular, con publicidad constante en televisión, redes sociales y patrocinios deportivos.

AJUTER (Asociación de Jugadores en Rehabilitación), nuestro cliente, es la principal institución chilena dedicada a crear comunidad y contención para pacientes ludópatas. Cuentan con más de 120 pacientes activos en 3 sedes (Santiago, Viña del Mar y Concepción) y 11 años de experiencia. Sin embargo, su actual modelo de rehabilitación deja a los pacientes sin apoyo entre sesiones, que es precisamente cuando ocurren la mayoría de las recaídas. Estudios muestran que el período crítico son las primeras 30 semanas de rehabilitación, y que las recaídas no dependen de la edad ni el género, sino de factores conductuales y emocionales (ansiedad, soledad, enojo, cansancio).

**Solución propuesta**

StopBet es una aplicación móvil de acompañamiento para la rehabilitación de la ludopatía. Implementa la metodología JITAI (Intervenciones Adaptativas Justo a Tiempo), probada en Australia y Nueva Zelanda, que detecta momentos de vulnerabilidad y actúa en tiempo real con técnicas psicológicas validadas. Sus funcionalidades principales son: botón de pánico que alerta a la comunidad, asistente virtual IA disponible 24/7, bloqueo de URLs de apuestas, tracker de logros y gamificación, y un dashboard clínico para psicólogos.

**Clientes y usuarios**

El cliente directo es AJUTER (contacto: Miguel Ángel Lara, director técnico). Los usuarios son pacientes en rehabilitación por ludopatía de entre 18 y 40 años (este rango fue previamente validado tanto por estudios como por nuestro cliente), psicólogos de la asociación que gestionan el proceso terapéutico y padrinos que apoyan a los nuevos usuarios.

**Innovación y diferenciación**

A diferencia de otras aplicaciones como Gamban (solo bloquea URLs), QuitBet (gamificación financiera con efecto boomerang) o Reset (sin presencia local en Chile), StopBet combina la contención emocional IA en tiempo real, bloqueo de sitios, vínculo clínico verificado con AJUTER, gamificación no financiera, red de apoyo comunitaria y un dashboard para optimizar la gestión clínica.

**2. Cliente - Actores (Usuarios) del Sistema**

**Cliente**

|  |  |
| --- | --- |
| **Nombre** | AJUTER |
| **Experiencia en el área** | Asociación con 11 años trabajando en conductas adictivas, específicamente ludopatía. Siendo la principal asociación de jugadores en rehabilitación de Chile, actualmente cuenta con 3 sedes activas y más de 120 pacientes. |
| **E-mail / Contacto** | ajuter@gmail.com |

***Observación:*** *Según lo conversado actualmente con el cliente, el código fuente es nuestro, nosotros les estamos vendiendo un servicio (SaaS).*

**Actores / Usuarios del Sistema**

|  |  |  |  |
| --- | --- | --- | --- |
| **Rol** | Paciente en rehabilitación | | |
| **Descripción** | Usuario principal de la app móvil. Recibe apoyo emocional, activa el botón de pánico, interactúa con el asistente IA, realiza check-ins emocionales diarios, visualiza sus logros y participa en la comunidad. | | |
| **Manejo de tecnologías** | 3 / 5  Usuarios entre 18-40 años con manejo básico-intermedio de smartphones. Pueden tener dificultades en momentos de crisis emocional. | **Conocimiento del contexto** | 5 / 5  Viven el problema, conocen los detonantes y el proceso de rehabilitación en detalle. |
| **Justificación:** | Al ser el usuario directamente afectado por la ludopatía, su motivación para usar la app es alta. Su conocimiento del contexto es perfecto (son los pacientes), aunque su manejo tecnológico varía. El diseño debe ser simple e intuitivo, especialmente el botón de pánico. | | |

|  |  |  |  |
| --- | --- | --- | --- |
| **Rol** | Psicólogo de AJUTER | | |
| **Descripción** | Accede al dashboard clínico para monitorear el progreso y estado de sus pacientes, exportar reportes y gestionar la información administrativa de la asociación. | | |
| **Manejo de tecnologías** | 3 / 5  Profesionales con manejo moderado de herramientas digitales. Acostumbrados a sistemas de gestión básicos (formularios, Excel). | **Conocimiento del contexto** | 5 / 5  Expertos en el proceso terapéutico de la ludopatía y la metodología de AJUTER. Su criterio clínico es la fuente primaria para validar las respuestas del asistente IA. |
| **Justificación:** | Su participación es clave para la validación clínica continua y para que el dashboard realmente reduzca las 7.5 horas semanales de tareas administrativas repetitivas que actualmente invierten. | | |

|  |  |  |  |
| --- | --- | --- | --- |
| **Rol** | Padrino / Referente de apoyo | | |
| **Descripción** | Miembro de la comunidad AJUTER que actúa como red de contención del paciente, es decir recibe las alertas del botón de pánico. | | |
| **Manejo de tecnologías** | 2 / 5  Adultos con manejo básico de smartphones. | **Conocimiento del contexto** | 4 / 5  Han pasado por el proceso de rehabilitación y conocen los momentos críticos desde la experiencia personal. |
| **Justificación:** | Su rol es fundamental porque la contención humana entre pares es la primera línea de respuesta del Botón de Pánico en momentos de crisis, actuando la IA únicamente como protocolo de respaldo. | | |

|  |  |  |  |
| --- | --- | --- | --- |
| **Rol** | Familiar del paciente | | |
| **Descripción** | Accede a una vista propia, gestiona el pago de la mensualidad, revisa y confirma su asistencia a sesiones grupales de familiares. | | |
| **Manejo de tecnologías** | 2 / 5  Adultos con manejo básico de smartphones. Suelen ser quienes tienen acceso a medios de pago cuando el paciente no dispone de ellos. | **Conocimiento del contexto** | 2 / 5  Conocen el problema desde una perspectiva externa y emocional, pero no han vivido el proceso de rehabilitación directamente. |
| **Justificación:** | Su inclusión responde a una necesidad concreta, muchos pacientes no tienen acceso a tarjetas de crédito/débito. El familiar asume el rol de gestor económico del tratamiento. Además, la participación familiar es un factor reconocido en la recuperación de adicciones. | | |

**3. Historias de Usuario del Sistema**

**Funcionalidades identificadas**

A partir del problema anteriormente descrito y validado con AJUTER, se definieron las siguientes funcionalidades principales del sistema:

* F1 - Botón de Pánico y escalamiento a IA: Mecanismo de alerta inmediata ante una crisis.
* F2 - Asistente Virtual IA 24/7: Contención emocional inteligente basada en JITAI.
* F3 - Bloqueo de URLs de apuestas: Filtrado DNS configurable por padrinos.
* F4 - Tracker de Logros y Gamificación: Refuerzo positivo del progreso del paciente.
* F5 - Dashboard Clínico para Psicólogos: Panel web de métricas y gestión administrativa.
* F6 - Registro e Ingreso de Pacientes y Familiares: Onboarding vinculado a la sede de AJUTER.
* F7 - Check Emocional Diario: Registro de estado anímico para detección de patrones de riesgo.
* F8 - Comunidad y Red de Apoyo: Espacio de interacción entre miembros de la misma sede.
* F9 - Vista del Familiar: Acceso a sesiones grupales y pago de mensualidad.

|  |  |  |
| --- | --- | --- |
| **ID** | **C** | **Descripción** |
| **HdU01** | **I** | **Como** paciente en rehabilitación, **Quiero** activar un botón de pánico desde la app **para** recibir apoyo de mi padrino o la comunidad AJUTER en un momento de crisis. |
| **HdU02** | **I** | **Como** paciente en rehabilitación, **Quiero** conversar con un asistente virtual con IA disponible las 24 horas **para** recibir contención emocional personalizada cuando no hay personas disponibles. |
| **HdU03** | **D** | **Como** paciente en rehabilitación, **Quiero** visualizar mis logros y días sin apostar **para** reforzar mi motivación y percepción de autoeficacia durante el proceso. |
| **HdU04** | **E** | **Como** psicólogo de AJUTER, **Quiero** visualizar las métricas de mis pacientes **para** realizar seguimiento de su proceso de rehabilitación. |
| **HdU05** | **E** | **Como** paciente en rehabilitación, **Quiero** acceder a un espacio de comunidad **para** conectarme con otros miembros de mi sede de AJUTER y sentir acompañamiento entre sesiones. |
| **HdU06** | **E** | **Como** paciente de AJUTER, **Quiero** completar mi registro en la aplicación **Para** acceder a las herramientas de apoyo y personalizar mi experiencia dentro de la plataforma. |
| **HdU07** | **E** | **Como** paciente en rehabilitación, **Quiero** registrar mi estado emocional diario en la app **para** que el sistema detecte patrones de riesgo y pueda intervenir oportunamente. |
| **HdU08** | **D** | **Como** paciente en rehabilitación, **Quiero** activar el bloqueo de acceso a sitios y aplicaciones de apuestas en mis dispositivos **para** evitar ingresar a plataformas de riesgo en momentos de impulso. |
| **HdU09** | **D** | **Como** psicólogo de AJUTER, **Quiero** revisar el estado de pago de mis pacientes **Para** mantener un registro ordenado de las cuotas al día y las pendientes. |
| **HdU10** | **O** | **Como** paciente, **Quiero** que el asistente virtual conserve el historial de mis conversaciones, **Para** que recuerde las técnicas que me ayudaron en momentos de crisis. |
| **HdU11** | **E** | **Como** familiar de un paciente, **Quiero** acceder a una vista propia en la app **Para** ver las sesiones grupales a las que debo unirme. |
| **HdU12** | **D** | **Como** familiar de un paciente, **Quiero** realizar el pago de la mensualidad de AJUTER desde la app **Para** gestionar la mensualidad del tratamiento sin depender del acceso del paciente a medios de pago. |

**4. Tecnología y Atributos de Calidad**

**Atributos de Calidad (SMART)**

|  |  |  |
| --- | --- | --- |
| **Atributo** | **Meta** | **Mecanismo de verificación** |
| **Disponibilidad** | El sistema debe estar disponible el 99.5% del tiempo mensual (máx. ~3.6 horas de downtime/mes), especialmente en horario nocturno (00:00–06:00). | Monitoreo con herramientas como UptimeRobot o Railway Metrics. Se generarán alertas automáticas ante caídas y se llevará un registro mensual de uptime. |
| **Tiempo de respuesta** | El asistente IA debe responder en menos de 5 segundos el 95% de las veces. Las notificaciones push (botón de pánico) deben llegar en menos de 10 segundos. | Pruebas de carga con herramientas como k6 o Artillery. Logs de latencia en el backend con dashboards de monitoreo (ej. Firebase Performance o Datadog). |
| **Seguridad y Privacidad** | Todos los datos sensibles deben estar cifrados en tránsito (TLS 1.2+) y en reposo (AES-256). Solo el terapeuta asignado puede acceder a los datos emocionales del paciente. | Auditorías de seguridad con OWASP Top 10 como guía. Revisión de permisos de acceso por rol. Pruebas de penetración básicas antes del despliegue del MVP. |
| **Usabilidad** | El 80% de los usuarios nuevos debe completar el flujo de crisis (botón de pánico → asistente) sin ayuda externa en su primera sesión de onboarding. | Pruebas de usabilidad con al menos 5 usuarios de AJUTER usando protocolos de think-aloud. Se medirá la tasa de completación del flujo y el número de errores cometidos. |

**Stack tecnológico**

|  |  |  |
| --- | --- | --- |
| **Capa** | **Tecnología** | **Justificación** |
| **Frontend Mobile** | React Native CLI | React Native CLI permite desarrollo multiplataforma desde una única base de código TypeScript, aprovechando el conocimiento previo del equipo. A diferencia de Expo, habilita acceso directo a VPNService de Android para filtrado DNS on-device, garantizando el bloqueo de sitios de apuestas sin comprometer la privacidad clínica. El MVP priorizará Android, sistema operativo del **77.16%** de los dispositivos móviles en Chile (Statcounter, marzo 2026). |
| **Backend** | Node.js + NestJS + LangChain.js | NestJS provee una arquitectura modular y tipada sobre Node.js que garantiza consistencia en un equipo de 6 personas con lógica clínica compleja. Su sistema de guards permite restringir endpoints por rol (paciente, psicólogo, padrino, familiar) de forma declarativa, reduciendo errores de autorización en datos sensibles. LangChain.js abstrae el proveedor LLM, permitiendo operar con Gemini Flash en el MVP y migrar a modelos self-hosted ante requerimientos futuros de privacidad o escala. |
| **Base de Datos** | PostgreSQL con JSONB | PostgreSQL gestiona los datos clínicos estructurados de StopBet mediante un modelo relacional que garantiza integridad referencial entre pacientes, sesiones y eventos terapéuticos. Las columnas JSONB permiten almacenar datos de estructura variable como conversaciones con el asistente IA y logs del motor JITAI, sin sacrificar la consistencia clínica ni agregar la complejidad operacional de una segunda tecnología de base de datos. |
| **IA / Asistente Virtual** | Gemini Flash / GPT-4o mini + LangChain.js | El asistente virtual opera mediante un LLM externo de bajo costo orquestado por LangChain.js, que gestiona la memoria conversacional persistente en PostgreSQL y abstrae el proveedor mediante una interfaz intercambiable, permitiendo migrar a modelos self-hosted como Llama 3 vía Groq ante requerimientos futuros de privacidad. El comportamiento clínico del asistente se controla mediante un system prompt validado por AJUTER, definiendo límites terapéuticos, técnicas permitidas y protocolos de escalada al botón de pánico. |
| **Notificaciones Push** | Firebase Cloud Messaging (FCM) | FCM es el estándar para notificaciones push en aplicaciones móviles, soportando Android e iOS de forma gratuita y sin límite de envíos. Se integra nativamente con React Native y permite al backend NestJS disparar notificaciones proactivas del motor JITAI directamente al dispositivo del paciente, incluso con la aplicación cerrada, garantizando la contención en momentos críticos nocturnos. |
| **Dashboard Web** | React + Vite + TypeScript + Tailwind CSS + Recharts | React con Vite permite desarrollar el dashboard web del terapeuta reutilizando el conocimiento del equipo del frontend móvil, compartiendo tipos TypeScript con el backend y reduciendo errores en la manipulación de datos clínicos sensibles. Tailwind CSS agiliza el desarrollo de una interfaz responsive optimizada para escritorio. Recharts provee visualizaciones declarativas para las métricas del motor JITAI sin configuración adicional. |
| **Infraestructura** | Railway (backend + PostgreSQL) + Vercel (dashboard web) + Cloudflare R2 (archivos) | Railway despliega el backend NestJS y PostgreSQL con configuración mínima dentro del presupuesto disponible, conectando directamente con el repositorio GitHub para despliegues automáticos en cada push. El dashboard React se despliega gratuitamente en Vercel como sitio estático. Cloudflare R2 almacena archivos como reportes PDF y fotos de perfil sin costos de egress, con API compatible con S3. Las tres plataformas proveen HTTPS automático y eliminan la necesidad de configuración manual de infraestructura. |
| **Comunidad** | Socket.io sobre Node.js | Socket.io implementa comunicación bidireccional en tiempo real mediante WebSockets sobre el servidor NestJS existente, **sin costo adicional ni infraestructura separada**. Soporta simultáneamente canales comunitarios por sede AJUTER y chats privados entre paciente y padrino mediante un sistema de salas, permitiendo que tras activar el botón de pánico el paciente reciba contención humana inmediata. Si el padrino no responde, el asistente virtual toma el control automáticamente. |

**5. Propuesta de Prototipo Mínimo Viable (PMV)**

**Selección de historias para el PMV**

Para el PMV se priorizaron las HdU 01, 02, 03, 04 y 05, estimadas mediante Planning Poker con una capacidad de 18 SP (1 SP = 6 hrs), cubriendo el flujo crítico de valor: contención en crisis, seguimiento clínico y comunidad de apoyo. Las HdU 02, 04 y 05 se implementan parcialmente en este sprint (5, 3 y 5 SP respectivamente), priorizando los criterios que desbloquean el flujo principal y dejando funcionalidad avanzada para sprints siguientes.

***Disclaimer:*** *En los puntos de historia, algunos tienen un paréntesis, significa que esa historia no se realizará al 100%, ej: 5 (13), significa que se utilizarán 5 de los 13 SP destinados a esa HdU. Además, los criterios de aceptación que están en el informe son únicamente los del mvp, para el desarrollo final se consideraran más criterios de aceptación que los aquí mostrados.*

**Historias de Usuario**

|  |  |
| --- | --- |
| **Nombre Historia:** | **HdU01 - Botón de Pánico** |
| **Categoría Historia:** | **Importante Puntos de Historia 3 (5)** |
| **Descripción:** | **Como** paciente en rehabilitación, **Quiero** activar un botón de pánico desde la app **Para** recibir apoyo de mi padrino o la comunidad AJUTER en un momento de crisis. |
| **Detalle:** | Al presionar el botón, se notifica con alerta a los padrinos asignados. Si en 3minutos nadie responde, el sistema escala al asistente virtual IA. |
| **Criterios de Aceptación:** | **Dado** que el paciente siente el impulso de apostar y tiene conexión a internet, **Cuando** presiona el botón de pánico, **Entonces** el sistema envía un aviso con alerta sonora y visual al padrino asignado en menos de 10 segundos, mostrando el mensaje: **Alerta: El paciente [Nombre] requiere contención inmediata por riesgo de recaída".** |
|  | **Dado** que el paciente ha emitido una alerta de pánico y tiene conexión a internet, **Cuando** el paciente no recibe una respuesta de ningún padrino en 3 minutos, **Entonces** el sistema conecta automáticamente al paciente con el asistente virtual en menos de 5 segundos. |
|  | **Dado** que el paciente se encuentra en la aplicación móvil, **Cuando** el paciente activa el botón de pánico y la alerta es emitida, **Entonces** el sistema guarda un registro del evento con la fecha, la hora exacta y el paciente, para que esta información pueda ser procesada o manipulada para los fines que se estimen convenientes (ej: visualizarlo en el dashboard clínico, entrenamiento de modelos ML, entre otros.) |
|  | **Dado** que el paciente siente el impulso de apostar, pero no tiene conexión a internet, **Cuando** presiona el botón de pánico, **Entonces** la aplicación muestra un mensaje indicando que no fue posible enviar el aviso y le pide que vuelva a intentarlo cuando tenga conexión. |

|  |  |
| --- | --- |
| **Nombre Historia:** | **HdU02 - Asistente Virtual IA (Contención 24/7)** |
| **Categoría Historia:** | **Esencial Puntos de Historia: 5 (13)** |
| **Descripción:** | **Como** paciente en rehabilitación, **Quiero** conversar con un asistente virtual disponible las 24 horas **Para** recibir contención emocional personalizada cuando no hay personas disponibles. |
| **Detalle:** | El asistente aplica técnicas validadas por AJUTER (respiración, distracción cognitiva) y detecta patrones de riesgo para intervenir. |
| **Criterios de Aceptación:** | **Dado** que el paciente está en una conversación con el asistente, **Cuando** envía un mensaje describiendo estar en un momento de crisis, **Entonces** el asistente responde en menos de 10 segundos con una técnica de contención (como respiración controlada, distracción cognitiva u otra) seleccionada según el perfil del paciente y su historial de sesiones anteriores, no de forma aleatoria. |
|  | **Dado** que el paciente se encuentra en una sesión de chat activa con el asistente virtual**, Cuando** el usuario deja de interactuar con el chat (10 min inactividad), **Entonces** el sistema debe generar en la base de datos un resumen estructurado que contenga:   1. El estado anímico predominante detectado (ej: Ansiedad, Soledad, Ira o Cansancio). 2. El nivel de riesgo de recaída final de la sesión (Bajo, Medio, Alto). 3. La técnica de contención que fue aplicada por la IA (ej: respiración, distracción). 4. El detonante identificado durante la charla. |
|  | **Dado** que el paciente ya ha interactuado previamente con el asistente virtual, **Cuando** inicia una nueva sesión de chat, **Entonces** el sistema muestra una conversación contextualizada según su estado y registros de conversaciones anteriores. |

|  |  |
| --- | --- |
| **Nombre Historia:** | **HdU03 - Tracker de Logros y Gamificación** |
| **Categoría Historia:** | **Deseable Puntos de Historia: 2 (3)** |
| **Descripción:** | **Como** paciente en rehabilitación, **Quiero** visualizar mis logros y días sin apostar **Para** reforzar mi motivación y percepción de autoeficacia durante el proceso. |
| **Detalle:** | El sistema registra la fecha exacta de inicio de abstinencia al momento del registro. Otorga insignias visuales al alcanzar hitos en la semana 1, mes 1, mes 2 y 3 y luego periódicamente cada 30 días. Ante una recaída registrada, preserva el historial completo y reinicia el contador sin penalización. La fecha de inicio de abstinencia solo puede ser editada por el psicólogo tratante desde el dashboard clínico, para evitar manipulación del contador. |
| **Criterios de Aceptación:** | **Dado** que el paciente registró su fecha de inicio de abstinencia, **Cuando** alcanza un hito de progreso en el primer trimestre (1, 3, 7, 14, 21, 30, 45, 60, 75 o 90 días), **Entonces** el sistema debe:   1. Otorgar una insignia visual de "Resiliencia" y mostrar una animación de felicitación en la app. 2. Preguntar al paciente si quiere compartir un anuncio de felicitación en el foro de su sede (Comunidad) para activar el refuerzo positivo social. |
|  | **Dado** que el paciente tiene su fecha de inicio de abstinencia e historial de insignias registrados, **Cuando** el paciente navega hacia la sección de "Logros" en su perfil dentro de la aplicación móvil, **Entonces** el sistema debe mostrar:   1. Un contador principal con los días de abstinencia en curso. 2. Una galería visual con el listado de insignias ya obtenidas, ordenadas cronológicamente junto a su fecha exacta de obtención. 3. Un indicador del próximo hito a alcanzar (detallando los días restantes). |
|  | **Dado** que el paciente tiene un periodo de abstinencia activo registrado en el sistema, **Cuando** el paciente auto-reporta una crisis en la app móvil o el psicólogo registra una recaída desde el Dashboard Clínico, **Entonces** el sistema debe:   1. Se reinicia el contador principal desde cero, preservando intactas todas las insignias del historial previo en el perfil del paciente. 2. Desplegar un modal emergente en la app con un mensaje de contención empático, seleccionado aleatoriamente de una tabla de "Mensajes Validados" en la base de datos.(ej: *"Tu esfuerzo anterior no se borra, estamos aquí para retomar el camino"*). 3. Proveer en ese mismo modal un botón principal que redirija directamente al paciente a iniciar una sesión de desahogo con el Asistente Virtual IA. |
|  | **Dado** que el paciente tiene un historial con una o más recaídas pasadas, **Cuando** el paciente navega hacia la vista de su perfil de logros en la aplicación móvil, **Entonces** el sistema debe consultar el historial y mostrar:   1. El periodo de abstinencia actual destacado visualmente (contador). 2. Una sección separada con los ciclos históricos, donde cada tarjeta (o bloque) muestre su fecha de inicio, duración total y las insignias obtenidas en ese intento específico. |

|  |  |
| --- | --- |
| **Nombre Historia:** | **HdU04 - Dashboard Clínico para Psicólogos** |
| **Categoría Historia:** | **Importante Puntos de Historia: 3 (5)** |
| **Descripción:** | **Como** psicólogo de AJUTER, **Quiero** visualizar las métricas de mis pacientes **Para** realizar seguimiento de su proceso de rehabilitación. |
| **Criterios de Aceptación:** | **Dado** que el psicólogo inicia sesión correctamente, **Cuando** el psicólogo accede a la vista principal del panel de seguimiento**, Entonces** el sistema debe validar sus permisos y mostrar la lista de pacientes, mostrando como mínimo para cada uno:   1. Nombre completo del paciente. 2. La sede a la que pertenece |
|  | **Dado** que existe un evento de "botón de pánico", **Cuando** el psicólogo visualiza la interfaz del Dashboard Clínico, **Entonces** el sistema debe mostrar este evento, mostrando obligatoriamente:   1. El nombre del paciente afectado. 2. El tiempo cuando ocurrió la alerta. |
|  | **Dado** que el psicólogo se encuentra visualizando las métricas de un paciente en el Dashboard Clínico, **Cuando** este selecciona un rango de fechas y hace clic en la opción de exportar**, Entonces** el genera, en menos de 10 segundos, un documento PDF descargable que contenga como estructura base:   1. Los datos básicos del paciente y el rango de fechas consultado. 2. El gráfico de evolución anímica de ese periodo. 3. El conteo total de alertas de botón de pánico registradas. |

|  |  |
| --- | --- |
| **Nombre Historia:** | **HdU05 - Comunidad y Red de Apoyo** |
| **Categoría Historia:** | **Esencial Puntos de Historia: 5 (8)** |
| **Descripción:** | **Como** paciente en rehabilitación, **Quiero** acceder a un espacio de comunidad P**ara** conectarme con otros miembros de mi sede de AJUTER y sentir acompañamiento entre sesiones. |
| **Criterios de Aceptación:** | **Dado** que el paciente accede a la sección de comunidad, **Cuando** este busca su sede, **Entonces** visualiza un foro con mensajes de otros pacientes de su misma sede. |
|  | **Dado** que un paciente publica un mensaje de apoyo, **Cuando** otro usuario lo lee, **Entonces** puede reaccionar (ej: poner emojis) o responder si lo desea. |
|  | **Dado** que el contenido de la comunidad recibe 5 reportes, **Cuando** un moderador (psicólogo) revisa la denuncia, **Entonces** puede eliminar el mensaje desde el dashboard clínico. |
|  | **Dado** que el paciente no tiene conexión a internet, **Cuando** intenta acceder a la comunidad, **Entonces** puede visualizar los mensajes cargados previamente, pero no puede enviar nuevos mensajes. |