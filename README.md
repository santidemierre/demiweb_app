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

- Node.js 18+ 
- Una cuenta de Firebase con un proyecto configurado

## Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Configura Firebase:
   - Ve a [Firebase Console](https://console.firebase.google.com)
   - Crea un nuevo proyecto o usa uno existente
   - En "Configuración del proyecto", copia los datos de configuración
   - Abre `.env.local` y pega tu configuración:

```env
VITE_FIREBASE_CONFIG='{"apiKey":"tu_api_key","authDomain":"tu_auth_domain","projectId":"tu_project_id","storageBucket":"tu_storage_bucket","messagingSenderId":"tu_messaging_sender_id","appId":"tu_app_id"}'
VITE_APP_ID="vencimientos-web-app"
```

3. Configuración de Firestore:
   - En Firebase Console, crea una base de datos Firestore
   - Establece las reglas de seguridad (ver sección abajo)
   - Crea la estructura de colecciones como se detalla en el código

## Comandos

```bash
# Desarrollo (http://localhost:5173)
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview
```

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
