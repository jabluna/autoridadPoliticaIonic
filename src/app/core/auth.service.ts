import { Injectable, signal } from '@angular/core';
import {
  User,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export type AppRole = 'cliente_admin' | 'red_usuario';

export interface AppProfile {
  uid: string;
  email: string;
  nombre: string;
  rol: AppRole;
  clienteId: string;
  clienteNombre: string;
  campanaId?: string;
  nodoId?: string;
}

export class AccessError extends Error {
  constructor(message: string, public readonly reason = 'NO_ACCESS') {
    super(message);
    this.name = 'AccessError';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly profile = signal<AppProfile | null>(null);

  async resolveSession(): Promise<AppProfile | null> {
    await auth.authStateReady();
    const current = auth.currentUser;
    if (!current) {
      this.profile.set(null);
      return null;
    }
    try {
      const validated = await this.readAllowedProfile(current);
      this.profile.set(validated);
      return validated;
    } catch (error) {
      this.profile.set(null);
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AppProfile> {
    const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    try {
      const validated = await this.readAllowedProfile(credential.user);
      this.profile.set(validated);
      return validated;
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      this.profile.set(null);
      throw error;
    }
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.profile.set(null);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  }

  async resendVerification(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    try {
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
      }
    } finally {
      await signOut(auth);
      this.profile.set(null);
    }
  }

  private async readAllowedProfile(current: User): Promise<AppProfile> {
    await current.reload();
    if (!current.emailVerified) {
      throw new AccessError('Debes verificar tu correo electrónico antes de ingresar.', 'UNVERIFIED_EMAIL');
    }

    const usuarioSnap = await getDoc(doc(db, 'usuarios', current.uid));
    if (!usuarioSnap.exists()) {
      throw new AccessError('Tu cuenta aún no tiene acceso habilitado a la plataforma.');
    }
    const usuario = usuarioSnap.data();
    const rol = usuario['rol'] as string;
    const clienteId = String(usuario['clienteId'] || '');
    if (
      !['cliente_admin', 'red_usuario'].includes(rol) ||
      usuario['estado'] === 'inactivo' ||
      !clienteId
    ) {
      throw new AccessError('Tu cuenta no tiene un rol o una asignación activa válida.');
    }

    const clienteSnap = await getDoc(doc(db, 'clientes', clienteId));
    if (!clienteSnap.exists()) {
      throw new AccessError('No se encontró el cliente asociado a esta cuenta.');
    }
    const cliente = clienteSnap.data();
    if ((cliente['estado'] || 'activo') !== 'activo') {
      throw new AccessError('La cuenta del cliente está inactiva.');
    }
    if (cliente['planActivo'] === false) {
      throw new AccessError('El plan de la campaña aún no está activo o espera aprobación.');
    }

    const campanaId = String(usuario['campanaId'] || '');
    const nodoId = String(usuario['nodoId'] || '');
    if (rol === 'red_usuario') {
      if (!campanaId || !nodoId) {
        throw new AccessError('No tienes una campaña o nodo de trabajo asignado.');
      }
      const nodoSnap = await getDoc(doc(db, 'clientes', clienteId, 'campanas', campanaId, 'nodos', nodoId));
      if (
        !nodoSnap.exists() ||
        nodoSnap.data()['estado'] === 'inactivo' ||
        nodoSnap.data()['uid'] !== current.uid
      ) {
        throw new AccessError('Tu nodo de trabajo no se encuentra activo.');
      }
    }

    const nombre = [usuario['nombre'], usuario['apellido']].filter(Boolean).join(' ').trim();
    return {
      uid: current.uid,
      email: current.email || '',
      nombre: nombre || current.displayName || 'Usuario',
      rol: rol as AppRole,
      clienteId,
      clienteNombre: String(cliente['nombreCliente'] || cliente['nombreCampana'] || 'Mi campaña'),
      ...(campanaId ? { campanaId } : {}),
      ...(nodoId ? { nodoId } : {})
    };
  }
}
