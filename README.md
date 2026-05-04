# WebManager - Gestor de Vencimientos

Aplicación web para gestionar vencimientos de dominios, hosting y certificados SSL de tus clientes de desarrollo web.

## Características

✅ **Dashboard**: Vista general de alertas críticas de vencimientos próximos  
✅ **Gestión de Clientes**: CRUD completo de clientes y sus servicios  
✅ **Alertas Automáticas**: Notificación de vencimientos a menos de 20 días  
✅ **Control de Precios**: Mantén actualizado el costo de servicios revendedor  
✅ **Hosting Revendedor**: Recordatorio de renovación anual  
✅ **Sincronización Real-time**: Datos sincronizados con Firebase Firestore  

## Requisitos

- Una cuenta de Firebase con un proyecto configurado
- (Recomendado) Un servidor local (Firebase suele requerir `http://localhost` o `https`)

## Instalación

No hay build ni React: toda la app vive en un solo archivo: `index.html`.

1. Configura Firebase:
  - Ve a [Firebase Console](https://console.firebase.google.com)
  - En "Configuración del proyecto", copia los datos de configuración
  - Abre `index.html` y completa `window.__APP_CONFIG__.firebaseConfig`.

2. (Opcional) Cambia el `appId` dentro de `window.__APP_CONFIG__` si querés separar datos.

3. Configuración de Firestore:
   - En Firebase Console, crea una base de datos Firestore
   - Establece las reglas de seguridad (ver sección abajo)
   - Crea la estructura de colecciones como se detalla en el código

## Ejecutar

Firebase normalmente no funciona correctamente abriendo el archivo con `file://`.

Levanta un servidor local y abre la URL en el navegador:

```bash
python3 -m http.server 5173
# luego abrir http://localhost:5173
```

## Deploy en Netlify

Este repo es un **sitio estático** (no hay build).

En Netlify:

- Build command: *(vacío)*
- Publish directory: `.` (la raíz del repo)

El archivo [_redirects](_redirects) ya está en la raíz para que Netlify haga fallback a `index.html`.

## Estructura de Firestore

```
artifacts/
├── vencimientos-web-app/
│   └── public/
│       └── data/
│           ├── clients/ (colección)
│           │   └── [clientId]
│           │       ├── name
│           │       ├── url
│           │       ├── domainExpiry
│           │       ├── hostingExpiry
│           │       ├── sslExpiry
│           │       ├── managesOwn
│           │       └── notes
│           └── config/
│               └── global
│                   ├── hostingResellerPrice
│                   ├── domainPrice
│                   ├── sslPrice
│                   └── lastUpdate
```

## Seguridad de Firestore

Usar estas reglas de seguridad (reemplaza `TU_UID` con tu UID de usuario):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/{document=**} {
      allow read, write: if request.auth.uid == 'TU_UID' || request.auth != null;
    }
  }
}
```

## Próximas Mejoras

- [ ] Integración con EmailJS para alertas automáticas
- [ ] Importación de clientes desde CSV
- [ ] Historial de cambios
- [ ] Estadísticas y reportes

## Notas

- La app utiliza autenticación anónima de Firebase por defecto
- Los precios deben actualizarse manualmente (DonWeb no tiene API pública)
- Las alertas se muestran 20 días antes del vencimiento (ajustable en el código)

## Licencia

MIT
