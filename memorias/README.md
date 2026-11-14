# Memoria compartida de DeadHack

Esta carpeta es la **base de contexto versionada** de los agentes de ChatGPT Business, ChatGPT Plus y Claude Pro. Los agentes no viven ni se ejecutan aquí: consultan estos archivos al comenzar cada sesión y dejan resultados mediante Issues/PRs.

## Orden obligatorio de lectura
1. [CONTEXTO.md](CONTEXTO.md): problema, hipótesis y decisiones aún pendientes.
2. [PROTOCOLO.md](PROTOCOLO.md): cómo reclamar, realizar, revisar y entregar tareas.
3. [ESTADO.md](ESTADO.md): instantánea resumida; confirmar siempre con Issues/PRs.
4. [ROLES.md](ROLES.md): responsabilidades y límites.
5. [CONTRATOS.md](CONTRATOS.md): reglas para interfaces entre módulos.
6. [FUENTES.md](FUENTES.md): recursos científicos y cautelas.
7. [DECISIONES/ADR-0001.md](DECISIONES/ADR-0001.md): decisión de arquitectura organizativa.
8. [HANDOFFS/README.md](HANDOFFS/README.md): traspasos entre sesiones y agentes.
9. [PROMPTS.md](PROMPTS.md): mensajes de arranque reutilizables.

## Fuente de verdad y conflictos
- **Tareas/propietarios/estado actual:** GitHub Issues y PRs, no este README.
- **Código:** rama `main` tras revisión.
- **Decisiones duraderas:** ADR aprobado y fusionado.
- **Especificaciones técnicas:** contratos aprobados por PR; no se inventan.
- **Estado.md:** instantánea manual y posiblemente desactualizada, nunca fuente de autoridad para tareas.

La carpeta puede cambiar mediante PR, evitando ediciones paralelas del mismo archivo. El código de la aplicación permanece fuera.
