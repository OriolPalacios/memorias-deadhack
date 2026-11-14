# Roles iniciales de los agentes (ajustables por Issue)

| Agente / suscripción | Enfoque sugerido | Entregas típicas | Revisión |
|---|---|---|---|
| ChatGPT Business (Codex/Work según disponibilidad) | Arquitectura, contratos, validación e integración | ADR, criterios de aceptación, revisión de PR | No fusionar su propio trabajo sin otra persona |
| ChatGPT Plus (Codex según disponibilidad) | UI, cartografía, experiencia de usuario | Visor, componentes, pruebas de interfaz | Contrato de datos proporcionado por el equipo |
| Claude Pro (Claude Code, si está habilitado) | Ingesta y transformación de datos | Scripts reproducibles, pruebas de datos, metadatos | Documentar fuente, unidades, CRS y limitaciones |

## Responsabilidades humanas
- Cada agente tiene un **operador humano** dueño de las decisiones, credenciales y tareas.
- Una persona del equipo integra cambios tras revisión. El propietario del repositorio decide protecciones y accesos.
- Cualquier persona puede proponer un cambio de rol; registrar la reasignación en el Issue.

## Qué NO implican los roles
No hay conexión directa entre modelos, memoria conversacional compartida, acceso automático a GitHub ni ejecución continua. La integración de cada suscripción debe ser habilitada por su operador. Los límites, herramientas y permisos reales dependen del plan.

## Uso eficiente de capacidad
Asignar a cada agente tareas autocontenidas, criterios objetivos y salidas reutilizables. Evitar repetir investigación profunda cuando ya hay fuentes enlazadas. Si una cuenta llega a su límite, un segundo agente retoma el Issue leyendo PR, comentario y handoff, no una conversación privada.
