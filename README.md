# Autoridad Política · Ionic

Aplicación móvil para Android y iOS, conectada al mismo proyecto Firebase de Autoridad Política Web.

## Primera etapa
- Ionic 8 + Angular 19 (Standalone) + Capacitor 7.
- Login real con Firebase Authentication (correo y contraseña).
- Comprobación de correo verificado, cliente activo y rol permitido (`cliente_admin` / `red_usuario`).
- Navegación protegida al dashboard y cierre de sesión.
- Diseño Orbital verde oscuro, móvil primero.

## Desde tu Mac

```bash
git clone https://github.com/jabluna/autoridadPoliticaIonic.git
cd autoridadPoliticaIonic
npm install
npm run start
```

Abrir `http://localhost:4200`. Puedes iniciar sesión con una cuenta ya aprobada de la plataforma web.

## Android

```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## iOS (requiere Xcode)

```bash
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Las carpetas nativas Android e iOS se generarán en el Mac al ejecutar `cap add`; la base de código web es común. Antes de publicar, definir los identificadores definitivos de la aplicación y configurar firmas/capacidades nativas.

## Actualizaciones posteriores

```bash
git pull origin main
npm install
npm run build
npx cap sync
```

`npx cap sync` requiere tener creada al menos una plataforma nativa.

## Seguridad y alcances

El inicio de sesión utiliza Firebase Authentication y lee permisos existentes de Firestore. No se crean ni cambian cuentas; las reglas de Firebase siguen siendo el control final. El dashboard es la base inicial para desarrollar el resto de los módulos paso a paso. No se incluye Firebase Admin ni claves privadas en la app.
