# GymManager Client

Frontend web de GymManager, una aplicación para gestionar usuarios, clases, reservas, perfiles y métricas de un gimnasio.

## Stack

- React 19
- Vite
- TypeScript
- Zustand para el estado de autenticación
- TanStack Query para peticiones, caché e invalidaciones
- Axios como cliente HTTP
- Tailwind CSS para estilos

## Separación Backend/Frontend

El proyecto separa backend y frontend para que cada parte tenga una responsabilidad clara. El backend Laravel expone la API, valida reglas de negocio y gestiona los datos. El frontend React se centra en la experiencia de usuario: pantallas, formularios, calendarios, tablas y feedback visual.

Esta separación facilita trabajar en paralelo, probar cada capa por separado y cambiar la interfaz sin tocar la lógica principal del servidor.

## Requisitos

- Node.js 20 o superior recomendado
- npm
- Backend de GymManager levantado y accesible

## Configuración Local

Instala las dependencias:

```bash
npm install
```

Crea un archivo `.env` en la raíz de este frontend:

```env
VITE_API_URL=http://localhost:8000
```

Levanta el servidor de desarrollo:

```bash
npm run dev
```

Por defecto, Vite mostrará la URL local en consola, normalmente `http://localhost:5173`.

## Scripts Disponibles

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

`npm run build` compila TypeScript y genera la versión de producción en `dist`.

## Docker

Este frontend incluye un `Dockerfile` multi-stage para construir la aplicación con Node.js 20 y servir el resultado estático con Nginx. La configuración de Nginx redirige las rutas a `index.html`, lo que evita errores 404 al navegar directamente a rutas gestionadas por React Router.

Para levantarlo localmente:

```bash
docker compose up --build
```

El servicio queda disponible en `http://localhost:3000`.

En Docker, el frontend se compila con `VITE_API_URL` vacío para que las llamadas usen el mismo origen (`/api/...` y `/sanctum/...`). Nginx reenvía esas peticiones al contenedor del backend (`gym_manager_app:8000`). Para que esta comunicación funcione, el backend debe estar levantado y el frontend debe unirse a la misma red Docker. Por defecto se usa la red `backend_gym_manager_network`, creada por el `docker-compose.yml` del backend al ejecutarlo desde la carpeta `backend`.

Si la red del backend tiene otro nombre, puedes indicarlo al levantar el frontend:

```bash
BACKEND_DOCKER_NETWORK=nombre_de_la_red docker compose up --build
```

En PowerShell:

```powershell
$env:BACKEND_DOCKER_NETWORK="nombre_de_la_red"; docker compose up --build
```

Este Docker es ideal para pruebas locales o servidores tradicionales donde se quiera servir el frontend como un contenedor independiente.

Nota arquitectónica: para el despliegue final en Hetzner con Coolify se usará el paradigma de "Sitio Estático". En ese escenario, Coolify gestionará la compilación y publicación del frontend, por lo que este `Dockerfile` no será necesario en producción.
