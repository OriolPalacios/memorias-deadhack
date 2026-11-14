# Contexto del desafío — edición inicial

**Equipo:** DeadHack — NASA Space Apps Lima Virtual 2026.
**Challenge:** Interplanetary Survival Guide: Martian Map.
**Objetivo general del desafío:** integrar, en una ubicación o trayecto de Marte, datos de múltiples misiones espaciales para ayudar a una exploración humana a planificar una caminata y cumplir objetivos científicos.

## Problema entendido hasta ahora
Los datos ópticos, topográficos, espectrales, térmicos y ambientales proceden de misiones distintas y no equivalen automáticamente a decisiones seguras a escala de una caminata. Hacen falta referencias espaciales compatibles, resolución adecuada, trazabilidad y una representación de la incertidumbre.

## Ideas de exploración (NO aprobadas como solución)
- Planificar recorridos según distancia, pendientes, obstáculos visibles e interés científico.
- Comparar alternativas de rutas con criterios explícitos.
- Explorar un regreso de contingencia a una base con parámetros simulados.

Estas ideas provienen de las conversaciones iniciales del equipo; confirmar el backlog y los flujos finales en Issues. No asumir que están implementadas ni que tienen validación científica.

## Decisiones pendientes
- Región y extensión específica (Jezero, Gale u otra).
- Dataset(s) exactos, cobertura y resolución para la región.
- Objetivo de la primera demostración y flujos de usuario.
- Stack frontend/backend, formato de raster y proyección.
- Criterios y límites científicos de cualquier cálculo de ruta, radiación u oxígeno.

## No objetivos por defecto
- No prometer navegación segura para EVA real ni meteorología instantánea global.
- No adquirir servicios ni API de pago sin decisión humana.
- No procesar en GitHub binarios planetarios grandes como si fueran código.

**Referencia oficial:** https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
