# Guía de Conventional Commits

Los **Conventional Commits** son una convención para escribir mensajes
de commit de forma consistente. Facilitan entender el historial del
proyecto, generar changelogs y automatizar versiones.

## Sintaxis

``` text
<tipo>(<scope>): <descripción>

[cuerpo opcional]

[footer opcional]
```

### Componentes

-   **tipo:** Indica el propósito del cambio.
-   **scope (opcional):** Módulo o componente afectado.
-   **descripción:** Explicación breve del cambio, en minúsculas y en
    modo imperativo.

------------------------------------------------------------------------

## Tipos de commits

### `feat`

Nueva funcionalidad.

``` text
feat: agregar autenticación con JWT
feat(auth): permitir inicio de sesión con Google
feat(loans): crear módulo de préstamos
```

### `fix`

Corrección de errores.

``` text
fix: corregir validación del correo
fix(login): solucionar error al iniciar sesión
fix(database): corregir consulta SQL
```

### `docs`

Cambios únicamente en la documentación.

``` text
docs: actualizar README
docs(api): agregar documentación de endpoints
```

### `style`

Cambios de formato que no afectan el funcionamiento.

``` text
style: aplicar formato con Prettier
style(css): corregir indentación
```

### `refactor`

Reestructuración del código sin cambiar su comportamiento.

``` text
refactor: simplificar lógica de autenticación
refactor(users): dividir servicio de usuarios
```

### `perf`

Mejoras de rendimiento.

``` text
perf: optimizar consulta de usuarios
perf(api): reducir tiempo de respuesta
```

### `test`

Agregar o modificar pruebas.

``` text
test: agregar pruebas para LoginService
test(api): actualizar pruebas de integración
```

### `build`

Cambios relacionados con compilación o dependencias.

``` text
build: actualizar dependencias
build: migrar a .NET 10
```

### `ci`

Cambios en CI/CD.

``` text
ci: agregar workflow de GitHub Actions
ci: actualizar pipeline de despliegue
```

### `chore`

Tareas de mantenimiento.

``` text
chore: actualizar dependencias
chore: configurar ESLint
chore: eliminar archivos temporales
```

### `revert`

Revierte un commit anterior.

``` text
revert: revertir implementación del login
```

------------------------------------------------------------------------

## Scopes comunes

``` text
auth
api
users
database
ui
dashboard
payments
notifications
orders
products
loans
config
```

------------------------------------------------------------------------

## Buenas prácticas

-   Escribe la descripción en minúsculas.
-   Usa verbos en modo imperativo.
-   No agregues punto al final.
-   Mantén la descripción entre 50 y 72 caracteres.
-   Usa un `scope` cuando el proyecto tenga varios módulos.

------------------------------------------------------------------------

## Ejemplos

``` text
feat(auth): agregar autenticación con JWT
fix(users): corregir validación del correo electrónico
refactor(database): simplificar consultas SQL
docs: actualizar guía de instalación
test(api): agregar pruebas para préstamos
build: actualizar dependencias de npm
ci: agregar pipeline de despliegue
chore: configurar ESLint
revert: revertir cambios del módulo de pagos
```

------------------------------------------------------------------------

## Resumen

  Tipo         Descripción
  ------------ ---------------------------------------------
  `feat`       Nueva funcionalidad
  `fix`        Corrección de errores
  `docs`       Documentación
  `style`      Formato del código
  `refactor`   Reestructuración sin cambiar comportamiento
  `perf`       Mejora de rendimiento
  `test`       Pruebas
  `build`      Compilación y dependencias
  `ci`         Integración y despliegue continuo
  `chore`      Mantenimiento
  `revert`     Revertir commits
