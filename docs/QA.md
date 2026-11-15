# QA mínimo del MVP

**Responsable de revisión del orquestador:** GPT-6.1 Terra, esfuerzo `max`, independiente del autor de la implementación. Este documento es un plan de pruebas, no resultados ejecutados.

## Casos con evidencia

| Caso | Requisito | Resultado esperado |
|---|---|---|
| QA-01 · Terreno | MVP-01 | En el commit candidato, orbitar cambia la perspectiva de un relieve derivado de DEM; fuente, exageración y NoData coinciden con manifiesto. Captura inicial y orbital. |
| QA-02 · Registro espacial | MVP-01/03 | Dos puntos de control, rutas y POI coinciden dentro del recorte; si hay textura orbital, también está alineada. Sin ella, el color de elevación tiene leyenda. Documentar tolerancia según resolución, no una exactitud inventada. |
| QA-03 · Antes de salir | MVP-02 | Comparar/seleccionar ambas rutas cambia resumen y geometría. No hay consumo durante la planificación. |
| QA-04 · Cuenta de referencia | MVP-04/05 | 120−35−20=65; extra 65−15−35=15; directa 65−30=35; reserva 20; recomendar regresar. |
| QA-05 · Umbrales | MVP-05/06 | Con reserva 20, previsto 20 cumple al límite y 19 incumple. Previsto 0 es `exhausted`, con déficit de presupuesto 0 y de reserva 20. Coste ausente produce `unknown` solo para esa opción; sin opciones conocidas que cumplan y con algún desconocido, no se recomienda una acción. |
| QA-06 · Déficit | MVP-05/06 | Disponible 65, coste 70 y reserva 20 producen previsto −5, `exhausted`, delta de reserva −25, déficit de presupuesto 5 y de reserva 25; no se trunca a cero. Con ambas opciones conocidas bajo reserva (p. ej. previstos 19 y 18), razón `reserve_unmet` y `recommendedOptionId = null`; no elegir por menor déficit. |
| QA-07 · Eventos | MVP-04/08 | Doble clic/repetición no consume dos veces; las transiciones inválidas no modifican estado; FPS/espera real no cambian el presupuesto. |
| QA-08 · Decisión humana | MVP-06 | Se puede inspeccionar cada alternativa y completar tanto el regreso directo como la elección extra, con consecuencia consistente. |
| QA-09 · Datos y contexto | MVP-03/07 | Foto con fecha/crédito; base/rutas/posición simuladas identificadas. Contexto MEDA lleva lugar/fecha; RAD opcional permanece en Gale y fuera de la autonomía. |
| QA-10 · Reinicio y recursos | MVP-08/09 | Reiniciar produce el estado inicial. Bloquear solicitudes externas a NASA no rompe la demo servida localmente; ausencia de asset/WebGL produce un mensaje útil. |
| QA-11 · Usabilidad real | MVP-10 | En Chrome del equipo de demo, controles HTML accesibles, texto legible, cámara recuperable, sin errores de consola que rompan el flujo. Registrar navegador/viewport y tiempos observados. |
| QA-12 · Precedencia | MVP-05/06 | Con 65 disponibles y reserva 20, directa 50 frente a extra 5+30 recomienda extra (30 frente a 15). Si extra cumple y directa es desconocida, solo la extra lleva cifra y se recomienda. Si directa cumple y extra es desconocida, se recomienda regresar con incertidumbre visible. |
| QA-13 · Segunda ruta | MVP-02/05 | Ruta B consume 45+20 antes de decidir: quedan 55; directa deja 25 y extra 5. Total principal 95, recomendación regresar. |
| QA-14 · Capa térmica | MVP-11 | Activar, variar opacidad y desactivar la capa mantiene geometría/ruta/autonomía. Comprobar registro con el recorte y metadatos/leyenda del producto; un mosaico IR no se rotula como temperatura actual. NoData y cobertura parcial se distinguen de valores científicos. |

Pruebas unitarias del dominio deben cubrir fronteras, ausentes y transiciones, no replicar la implementación. La inspección visual y la prueba de registro espacial requieren evidencia propia: tests unitarios verdes no las sustituyen.

## Evidencia y reporte

Usar [la plantilla de reporte](../harness/templates/REPORT.md): Issue, rama y commit exacto; spec/contratos revisados; comandos y resultados observados; casos y capturas; defectos reproducibles ordenados; pruebas no ejecutadas. Las capturas son del navegador, no imágenes generadas. El revisor trabaja sobre un checkout aislado del candidato, nunca sobre el árbol donde Gemini sigue escribiendo.

Veredictos: **PASS** si los criterios revisados pasan con evidencia; **FIX REQUIRED** para defectos; **BLOCKED** para una dependencia que impide probar. Un agente debe distinguir «no probado» de «falló». Tras una corrección se vuelve a verificar el candidato nuevo, los casos afectados y un recorrido completo si cambió la integración.

La aceptación humana del producto, la revisión arquitectónica de Sol y el QA de Terra son responsabilidades diferentes. El merge y la publicación siguen el protocolo de memoria y las autorizaciones del operador.
