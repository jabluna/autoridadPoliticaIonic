import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons';
import { AccessError, AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IonButton, IonContent, IonIcon, IonSpinner],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage {
  email = '';
  password = '';
  showPassword = false;
  loading = false;
  secondaryLoading = false;
  error = '';
  notice = '';
  needsVerification = false;

  constructor(
    private readonly access: AuthService,
    private readonly router: Router
  ) {
    addIcons({
      arrowForwardOutline,
      eyeOffOutline,
      eyeOutline,
      lockClosedOutline,
      mailOutline,
      shieldCheckmarkOutline
    });
  }

  async login(): Promise<void> {
    this.clearFeedback();
    if (!this.email.trim() || !this.password) {
      this.error = 'Ingresa tu correo electrónico y contraseña.';
      return;
    }

    this.loading = true;
    try {
      await this.access.login(this.email, this.password);
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } catch (error) {
      this.needsVerification = error instanceof AccessError && error.reason === 'UNVERIFIED_EMAIL';
      this.error = this.readableError(error);
    } finally {
      this.loading = false;
    }
  }

  async recoverPassword(): Promise<void> {
    this.clearFeedback();
    if (!this.email.trim()) {
      this.error = 'Escribe tu correo para enviarte las instrucciones de recuperación.';
      return;
    }

    this.secondaryLoading = true;
    try {
      await this.access.resetPassword(this.email);
      this.notice = 'Si existe una cuenta con ese correo, recibirás instrucciones para recuperar tu contraseña.';
    } catch (error) {
      this.error = this.readableError(error);
    } finally {
      this.secondaryLoading = false;
    }
  }

  async resendVerification(): Promise<void> {
    this.clearFeedback();
    if (!this.email.trim() || !this.password) {
      this.error = 'Escribe tu correo y contraseña para reenviar la verificación.';
      return;
    }
    this.secondaryLoading = true;
    try {
      await this.access.resendVerification(this.email, this.password);
      this.notice = 'Verificación enviada, si tu correo aún estaba pendiente. Revisa tu bandeja de entrada y Spam.';
    } catch (error) {
      this.error = this.readableError(error);
    } finally {
      this.secondaryLoading = false;
    }
  }

  private clearFeedback(): void {
    this.error = '';
    this.notice = '';
    this.needsVerification = false;
  }

  private readableError(error: unknown): string {
    if (error instanceof AccessError) return error.message;
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
    switch (code) {
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'El correo o la contraseña no son correctos.';
      case 'auth/user-disabled':
        return 'Esta cuenta se encuentra deshabilitada.';
      case 'auth/too-many-requests':
        return 'Se realizaron demasiados intentos. Prueba más tarde.';
      case 'auth/network-request-failed':
        return 'No hay conexión con el servidor. Comprueba internet e inténtalo de nuevo.';
      default:
        return 'No fue posible completar la operación. Inténtalo de nuevo.';
    }
  }
}
