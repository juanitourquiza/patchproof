# PatchProof

PatchProof es una herramienta open source para revisar **diffs de código generados por agentes de IA** antes de hacer commit, abrir un PR o mezclar cambios.

La idea no es reemplazar SonarQube, Semgrep o una auditoría humana. La idea es cubrir un flujo muy concreto: cuando Claude Code, Cursor, Copilot, Windsurf u otro agente genera cambios, PatchProof revisa el `git diff` y marca patrones peligrosos que suelen aparecer en código generado por IA.

## Estado actual

Este es un **MVP funcional de CLI**.

Ya hace:

- Lee un diff desde `git diff`, archivo `.diff` o stdin.
- Analiza solo líneas agregadas.
- Detecta riesgos comunes:
  - secretos hardcodeados;
  - SQL injection básica;
  - XSS por renderizado HTML inseguro;
  - uso de `eval`/ejecución dinámica/comandos;
  - CORS abierto con `*`.
- Genera reportes en:
  - texto;
  - JSON;
  - Markdown;
  - SARIF para GitHub Security.
- Devuelve exit code `1` cuando encuentra hallazgos que deberían bloquear CI.

Todavía falta:

- Reglas AST más precisas para TypeScript, Angular, Node y Laravel/PHP.
- Cargar configuración real desde `patchproof.config.json`.
- GitHub Action publicable.
- Backend Laravel real en `back/`.
- Dashboard Angular real en `front/`.
- Publicar el paquete en npm para usar `npx patchproof`.

## Estructura

```txt
patchproof/
  packages/core/  Motor TypeScript de auditoría y reglas internas
  packages/cli/   CLI patchproof
  back/           Futuro backend Laravel para reportes, equipos y monetización
  front/          Futuro dashboard Angular
  docs/           Arquitectura, monetización y fixtures
```

## Instalación local

Desde la carpeta del proyecto:

```bash
cd /Users/juanurquiza/Documents/dev/patchproof
npm install
npm run build
```

## Cómo probarlo ahora

### 1. Ver reglas disponibles

```bash
node packages/cli/dist/index.js rules
```

Debe mostrar:

```txt
PP001  Hardcoded secret
PP002  Potential SQL injection
PP003  Unsafe HTML rendering
PP004  Dangerous dynamic execution
PP005  Permissive CORS configuration
```

### 2. Probar con el fixture incluido

```bash
node packages/cli/dist/index.js audit --file docs/fixtures/sample.diff
```

Ese fixture tiene código inseguro a propósito. Deberías ver 5 hallazgos.

Para verlo como Markdown:

```bash
node packages/cli/dist/index.js audit --file docs/fixtures/sample.diff --format markdown
```

Para verlo como JSON:

```bash
node packages/cli/dist/index.js audit --file docs/fixtures/sample.diff --format json
```

Para generar SARIF:

```bash
node packages/cli/dist/index.js audit --file docs/fixtures/sample.diff --format sarif
```

### 3. Probarlo sobre cambios reales de un repo

En cualquier repo donde tengas cambios sin commit:

```bash
git diff | /Users/juanurquiza/Documents/dev/patchproof/packages/cli/dist/index.js audit
```

O desde dentro del repo de PatchProof, cuando sea repo Git:

```bash
node packages/cli/dist/index.js audit --diff
```

### 4. Interpretar exit codes

- `0`: no hay hallazgos bloqueantes.
- `1`: hay hallazgos con severidad igual o mayor al umbral configurado.
- `2`: error de uso, configuración o entrada vacía.

Por defecto bloquea en `high` o `critical`.

Ejemplo:

```bash
node packages/cli/dist/index.js audit --file docs/fixtures/sample.diff --fail-on critical
```

## Configuración

`patchproof.config.json` puede vivir en el directorio actual o en cualquier directorio padre. Sirve para definir `failOn` y activar o desactivar reglas internas.

## Qué hace exactamente

PatchProof analiza un unified diff, por ejemplo:

```diff
+const apiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz";
+app.get("/search", (req, res) => db.query(`SELECT * FROM users WHERE name = ${req.query.name}`));
+document.body.innerHTML = req.query.message;
```

Y produce hallazgos como:

```txt
[CRITICAL] PP001 OpenAI API key committed in code
[HIGH] PP002 SQL query appears to include interpolated input
[HIGH] PP003 Potential XSS sink added
```

Cada hallazgo incluye:

- regla;
- severidad;
- confianza;
- archivo;
- línea;
- evidencia;
- recomendación.

## Comandos de desarrollo

```bash
npm test
npm run typecheck
npm run build
```

Estado actual verificado:

- tests pasan;
- typecheck pasa;
- build pasa;
- `npm audit --omit=dev` no reporta vulnerabilidades runtime.

Npm sí reporta vulnerabilidades moderadas en dependencias de desarrollo de tooling. No afectan el runtime publicado del CLI, pero conviene revisarlas antes de release público.

## Licencia

MIT.
