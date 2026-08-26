# Workspace

Aplicación web tipo Notion construida con Next.js 15, TypeScript, Tailwind CSS,
shadcn/ui y Supabase. Incluye autenticación, esquema de base de datos con RLS,
creación automática del primer workspace, navegación de páginas persistentes y
un editor por bloques con archivos privados en Supabase Storage. También permite
crear bases de datos con propiedades configurables y múltiples vistas persistentes.

## Requisitos

- Node.js 20 o superior
- Una cuenta gratuita de Supabase
- npm

## 1. Crear el proyecto gratuito en Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) y pulsa **New project**.
2. Elige tu organización, escribe un nombre y genera una contraseña segura para la base de datos.
3. Selecciona una región cercana y el plan **Free**. Pulsa **Create new project**.
4. Espera a que el proyecto termine de prepararse.
5. Abre **Project Settings → API**.
6. Copia **Project URL**: será `NEXT_PUBLIC_SUPABASE_URL`.
7. Copia la **Publishable key**: será `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
8. No necesitas una clave secreta ni `service_role` para ejecutar la aplicación.

## 2. Crear el archivo de variables local

En PowerShell, desde la carpeta del proyecto:

```powershell
Copy-Item .env.example .env.local
```

Abre `.env.local` y reemplaza únicamente los valores de ejemplo:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICABLE
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.local` está ignorado por Git. No lo compartas ni lo subas al repositorio.

## 3. Aplicar la migración

La opción más directa no requiere instalar el CLI:

1. En Supabase abre **SQL Editor**.
2. Pulsa **New query**.
3. Ejecuta, en orden, los archivos de `supabase/migrations/` que todavía no
   hayas aplicado. Empieza por `20260825000000_initial_schema.sql` y después
   ejecuta `20260826000000_phase5_templates.sql`.
4. Pega cada archivo completo en una consulta nueva y pulsa **Run** una sola vez.
5. En **Table Editor** confirma que aparecen `profiles`, `workspaces`,
   `workspace_members`, `pages`, `db_properties`, `db_views`, `comments`,
   `page_shares` y `files`.
6. Abre **Storage** y confirma que existe el bucket privado `workspace-files`.

Si ya usas Supabase CLI, puedes aplicar el mismo archivo con:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

## 4. Configurar los enlaces de autenticación

1. En Supabase abre **Authentication → URL Configuration**.
2. En **Site URL** escribe `http://localhost:3000`.
3. En **Redirect URLs** añade `http://localhost:3000/auth/callback`.
4. Abre **Authentication → Providers → Email** y confirma que Email está activo.
5. Mantén activa la confirmación de correo para probar el flujo completo.

## 5. Ejecutar y probar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), crea una cuenta y confirma
el enlace recibido. Al entrar en `/workspace`, la pantalla muestra el nombre del
workspace y el rol leídos desde Supabase. El trigger de alta crea el perfil, el
workspace inicial y la membresía `owner` automáticamente. Desde el panel puedes
crear, anidar, reordenar, renombrar, duplicar, marcar como favorita, archivar y
restaurar páginas. Dentro de cada página puedes usar `/` para insertar bloques,
`@` para mencionar otra página, subir imágenes, elegir un icono y añadir una
portada. El contenido se guarda automáticamente en Supabase.

Desde el menú **Nueva** puedes crear una **Base de datos**. Sus filas se editan
directamente en la tabla y también se abren como páginas. El panel de
**Propiedades** permite añadir, renombrar, convertir, reordenar, ocultar y
eliminar columnas; sus valores se guardan en `pages.properties`.

Cada base de datos puede guardar varias vistas en pestañas: **Tabla**, **Tablero**,
**Lista**, **Calendario** y **Galería**. Desde el panel **Vista** puedes combinar
filtros con reglas Y/O, añadir varios ordenamientos, agrupar registros y elegir
qué propiedades se muestran. El tablero permite mover tarjetas entre estados y
el calendario permite arrastrarlas a otra fecha; la configuración se persiste en
`db_views`.

La búsqueda global se abre con **Ctrl+K** o **Cmd+K** y consulta el índice de
texto completo de Supabase. La papelera permite restaurar, eliminar una página
definitivamente o vaciar todo. En **Plantillas** están las estructuras de
Tareas, CRM, Calendario de contenido, Notas de reunión y Metas trimestrales;
también puedes guardar cualquier página con todas sus subpáginas desde el menú
de acciones. Ese mismo menú permite duplicar el subárbol, exportarlo a Markdown
o abrir la impresión del navegador para guardarlo como PDF. Las páginas que
mencionan a la página actual aparecen al final en **Enlazada desde**.

## Verificaciones

```bash
npm run lint
npm run build
```

## Estructura relevante

- `app/`: rutas de la aplicación y callbacks de Auth
- `components/editor/`: editor BlockNote, bloques personalizados y menciones
- `components/database/`: vistas, filtros, tabla, celdas, propiedades y filas
- `components/`: formularios, workspace y componentes shadcn/ui
- `lib/supabase/`: clientes de navegador, servidor y middleware
- `supabase/migrations/`: esquema versionado, triggers y políticas RLS

## Despliegue futuro en Vercel

El despliegue se hará en la Fase 7. Vercel necesitará las tres variables de
`.env.example`. Después se añadirá el dominio final a **Site URL** y
`https://TU-DOMINIO/auth/callback` a **Redirect URLs** en Supabase.
