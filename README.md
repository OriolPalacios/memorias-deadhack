# DeadHack — NASA Space Apps 2026

Repositorio compartido del equipo DeadHack para **Interplanetary Survival Guide: Martian Map**.

- `memorias/`: contexto persistente y protocolo de coordinación de agentes.
- Código del producto: se desarrollará **fuera** de `memorias/`, en carpetas que se definirán cuando se acuerde la arquitectura.
- GitHub Issues: asignaciones y estados vivos.
- Pull Requests: entregas, revisión y registro de integraciones.

**Inicio rápido:** leer [memorias/README.md](memorias/README.md) y [memorias/PROTOCOLO.md](memorias/PROTOCOLO.md).

## MVP en definición: «Una parada más»

Copiloto para preparar una caminata en Jezero, explorar un terreno 3D y decidir si una parada científica adicional conserva el margen de regreso.

**Demo:** 15 de noviembre de 2026, 10:00 p. m., Perú (`America/Lima`, UTC−05:00). Equipo: 3 personas.

- [Spec y criterios de aceptación](docs/SPEC.md): borrador para revisión, todavía sin implementación.
- [Arquitectura y evaluación de Three.js](docs/ARCHITECTURE.md).
- [Recursos del reto y procedencia de los datos](docs/RESOURCES.md).
- [Decisiones y preguntas abiertas](docs/DECISIONS.md).
- [Plan de trabajo hasta la demo](docs/DELIVERY.md).
- [Harness: agentes, skills, workflows y arranque](harness/README.md).
- [Asignación humana editable](harness/team.json): Lucian atiende datos y contratos; Oriol, experiencia, dominio y demo.

El harness complementa el protocolo de `memorias/`; GitHub Issues y PRs conservan la autoridad sobre tareas, propietarios y estado. Trabajo de definición: [Issue #2](https://github.com/OriolPalacios/memorias-deadhack/issues/2).

> Importante: estos archivos no ejecutan agentes ni sincronizan automáticamente sesiones de ChatGPT y Claude. Cada colaborador debe dar acceso al repositorio a su agente y comenzar desde un Issue.
