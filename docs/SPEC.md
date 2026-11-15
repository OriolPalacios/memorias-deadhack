# DeadHack MVP — Una parada más

**Revisión:** 0.3 · **Estado:** aprobado por el usuario · **Fecha:** 2026-11-15.
**Tarea de definición:** [Issue #2](https://github.com/OriolPalacios/memorias-deadhack/issues/2).
**Demo:** 2026-11-15, 22:00, `America/Lima` (UTC−05:00). Equipo: 3 personas.

El usuario aprobó explícitamente este spec, React, TypeScript, Vite, React Three Fiber y cámara orbital el 15-11-2026. El hosting se decidirá después y no bloquea el desarrollo local. Esta aprobación fija alcance y arquitectura de aplicación; los contratos de datos y de cada tarea se cierran por separado. La integración al repositorio sigue [el protocolo compartido](../memorias/PROTOCOLO.md).

## Problema y propuesta

Una astronauta necesita elegir una ruta científica antes de salir y decidir durante la caminata cuánto explorar conservando autonomía para volver. El MVP combina contexto real de Marte con una misión simulada cuya recomendación puede explicarse y comprobarse.

La experiencia se concentra en un recorte de Jezero, con **terreno 3D real derivado de elevación**, dos rutas prefijadas, una observación principal y una parada opcional. El objetivo principal es observar rocas sedimentarias en Enchanted Lake, documentadas por Perseverance. Su ubicación precisa dentro del recorte sigue pendiente de comprobar: la foto por sí sola no proporciona la georreferenciación necesaria. Véase [RESOURCES.md](RESOURCES.md).

## Flujo de la demo

1. **Preparar:** explorar la escena 3D, identificar la base simulada y el objetivo científico; comparar dos rutas por propósito, tiempo simulado de ida/observación/regreso y reserva prevista.
2. **Elegir y salir:** seleccionar una ruta e iniciar la misión; el marcador progresa mediante pasos controlados de simulación, con una animación breve opcional.
3. **Observar:** llegar a la parada principal, abrir la imagen de Perseverance con fecha y crédito, y completar la observación prevista.
4. **Decidir:** comparar «otra parada» con «regresar», ver el presupuesto al llegar a la base y leer la razón de la recomendación.
5. **Cerrar:** elegir una acción, mostrar el resultado simulado y poder reiniciar el mismo escenario.

Interfaz del MVP: español, escritorio y navegador Chrome reciente. Un panel HTML contiene todos los controles y la explicación, de modo que la acción no dependa exclusivamente de seleccionar objetos en 3D.

## Requisitos y aceptación

| ID | Comportamiento verificable |
|---|---|
| MVP-01 | La vista inicial muestra una malla con alturas procedentes de un DTM/DEM identificado, textura orbital si está disponible o color de elevación con leyenda, cámara orbital y botón para restablecer la vista. El relieve cambia realmente al orbitar. La ortoimagen es opcional; la elevación real es obligatoria. |
| MVP-02 | Antes de salir se comparan dos rutas curadas, con identificadores distintos, geometría visible, objetivo y tiempos explícitamente simulados. Elegir una actualiza el resumen y el recorrido. |
| MVP-03 | Las paradas muestran evidencia científica y procedencia. La parada principal utiliza una imagen real de Perseverance con fecha, crédito y enlace. La parada opcional y la base se rotulan como simuladas. |
| MVP-04 | La simulación avanza por eventos discretos y estados válidos. El reloj real y los FPS no alteran el consumo de autonomía; repetir un evento ya aplicado no descuenta dos veces. |
| MVP-05 | El caso de referencia produce 65 min disponibles en la decisión, 15 min al volver tras la parada extra y 35 min al volver directo, frente a una reserva de 20 min; recomienda regresar y explica esos números. |
| MVP-06 | La persona puede comparar las dos opciones y decidir; elegir la opción bajo reserva muestra su consecuencia simulada y no se etiqueta como una opción que cumple la reserva. |
| MVP-07 | Se pueden inspeccionar las capas de terreno/imagen, las rutas y los puntos científicos, con leyenda y fuentes. La ficha de contexto histórico tiene lugar y fecha; no modifica automáticamente el presupuesto. |
| MVP-08 | Reiniciar restablece ruta, fase, autonomía y observaciones del escenario. El flujo principal funciona con recursos locales servidos por la app, sin consultas a NASA durante la demo. |
| MVP-09 | Faltantes de elevación, textura o tiempos se comunican. Sin WebGL se muestra una explicación y la información textual; ese fallback no cuenta como aceptación del terreno 3D. |
| MVP-10 | La evidencia de QA identifica revisión/commit candidato, navegador, pasos, resultados y capturas reales del terreno y de la decisión; se valida la versión que se va a presentar. |
| MVP-11 | Una capa térmica se puede activar sobre el terreno, ajustar en opacidad y desactivar sin cambiar rutas ni autonomía. Tiene fuente/producto, leyenda, cobertura, resolución y contexto de adquisición disponible. Se identifica si el producto es diurno/nocturno o un mosaico; no se presenta como temperatura actual de la astronauta. La inclusión fue solicitada por el usuario; el producto exacto sigue en el frente de datos. |

## Modelo mínimo de autonomía

Se usa **un solo presupuesto en minutos de autonomía simulada**. El equipo puede explicarlo como oxígeno equivalente únicamente bajo el supuesto visible de consumo constante. No son litros, presión de tanque ni una predicción fisiológica. Los tiempos son parámetros de escenario; no se deducen de la longitud de una curva 3D ni de fotografías.

```text
disponible = presupuesto_inicial − tiempo_consumido
previsto_en_base(opción) = disponible − coste_pendiente(opción)
cumple_reserva(opción) = previsto_en_base(opción) >= reserva
```

Caso de referencia, después de la observación principal:

| Concepto | Minutos simulados |
|---|---:|
| Presupuesto inicial | 120 |
| Ida ya realizada | 35 |
| Observación ya realizada | 20 |
| Disponible en el punto de decisión | 65 |
| Reserva objetivo | 20 |
| Llegar y observar la parada extra, desde este punto | 15 |
| Regreso desde la parada extra | 35 |
| Regreso directo desde la parada principal | 30 |
| Previsto en base con parada extra | 15 |
| Previsto en base con regreso directo | 35 |

Los 15 min de la parada extra incluyen su tramo de acceso y observación; no se vuelven a descontar en el regreso. La diferencia entre 35 min de ida y 30 de vuelta es una hipótesis del escenario.

Tiempos de ambas rutas del spec aprobado, igualmente simulados:

| Ruta | Ida | Observación principal | Regreso directo | Total principal | Previsto en base (120 iniciales) |
|---|---:|---:|---:|---:|---:|
| A · Trayecto breve simulado | 35 | 20 | 30 | 85 | 35 |
| B · Reconocimiento extendido simulado | 45 | 20 | 30 | 95 | 25 |

Ambas llegan al mismo objetivo principal y utilizan el mismo regreso directo. B representa una variante didáctica de recorrido más largo, sin atribuirle un descubrimiento científico adicional. Sus geometrías siguen pendientes del recorte; aceptar tiempos no prueba transitabilidad. Tras B quedan 55 min: extra 5 y vuelta directa 25, por lo que también corresponde regresar.

### Clasificación y recomendación

Los costes y presupuestos deben ser finitos y no negativos; la reserva es estrictamente positiva. Datos ausentes o inválidos producen `unknown` y una razón, sin sustituirlos por cero. Para una opción con evaluación conocida:

| Estado de opción | Condición sobre `previsto_en_base` |
|---|---|
| `exhausted` | menor o igual que 0 |
| `below_reserve` | mayor que 0 y menor que la reserva |
| `meets_reserve` | mayor o igual que la reserva |

`reserveDeltaMin = previsto_en_base − reserva` es firmado. `reserveDeficitMin = max(0, −reserveDeltaMin)` mide lo que falta para la reserva; `budgetDeficitMin = max(0, −previsto_en_base)` mide lo que falta para completar el trayecto. Ejemplo: previsto −5 y reserva 20 significa déficit de presupuesto 5 y déficit de reserva 25. En `unknown` estos campos derivados son `null`. La igualdad exacta con la reserva cumple y se muestra «en el límite».

La recomendación usa esta **precedencia**, sin asumir que el llamado regreso directo sea siempre el de menor coste:

| Prioridad | Condición | Resultado |
|---|---|---|
| 1 | La opción extra está en `meets_reserve`. | Recomendar extra, mostrando su margen; la otra opción conserva su estado, incluso si es desconocida. |
| 2 | Extra no cumple o es desconocida; regreso directo está en `meets_reserve`. | Recomendar regresar; si falta la extra, mostrar esa incertidumbre. |
| 3 | Ninguna opción conocida cumple y alguna está en `unknown`. | `recommendedOptionId = null`; razón `insufficient_data`. |
| 4 | Las dos son conocidas y ninguna cumple. | `recommendedOptionId = null`; razón `reserve_unmet`, con déficits visibles. No se elige automáticamente la de menor déficit. La persona puede inspeccionar y elegir una consecuencia simulada. |

Nunca se asigna una cifra a la opción desconocida. Esta precedencia resuelve también un caso de QA con 65 disponibles, reserva 20, directa de coste 50 y extra de coste 5+30: la extra llega con 30 y la directa con 15; corresponde la prioridad 1.

## Alcance para la demo

Incluye una escena pequeña, una malla preparada previamente, dos rutas de escenario, dos alternativas en el punto de decisión, foto/contexto científico, capa térmica, fuentes, reinicio y QA del flujo completo. El usuario confirmó recomendaciones deterministas explicadas, sin chat libre; no se necesita una llamada a un LLM durante la demo. La ortoimagen orbital y una superposición geológica son adicionales si los productos están preparados; la ficha histórica MEDA permanece como contexto.

Se difieren globo planetario, rutas dibujadas libremente, búsqueda automática de caminos, física de trajes, multijugador, cuentas, backend, chat abierto, VR/AR y navegación en primera persona. La cámara orbital satisface la interacción 3D inicial. Cambiar estos límites exige revisar tiempo y contrato.

## Integridad científica y de presentación

El relieve deriva de datos de elevación; una imagen sombreada no se usa como altura. Se registran CRS marciano, unidades, cobertura y transformación. La exageración vertical, si existe, se indica y no interviene en cálculos físicos. Los píxeles sin datos se enmascaran.

La posición, base, rutas, segunda parada y autonomía son simuladas. Las observaciones históricas se presentan con su lugar/fecha; datos de Gale no se muestran como mediciones de Jezero. El producto es una demostración de apoyo a decisiones con supuestos, sin certificación de una EVA real.

## Condición para iniciar implementación

El alcance y la base técnica ya están aprobados. Cada tarea de código debe tener Issue, worktree propio y contrato de su ámbito. El bootstrap de la app y el dominio pueden avanzar con sus interfaces acordadas mientras Lucian cierra datos/contratos en [Issue #6](https://github.com/OriolPalacios/memorias-deadhack/issues/6). Integrar el terreno y las capas reales requiere recorte/cobertura, georreferenciación y geometrías A/B verificables. No se vuelve a pedir aprobación del spec para resolver nombres de campos, versiones de paquetes compatibles u otros detalles técnicos dentro de este alcance. El hosting queda aplazado por indicación del usuario.
