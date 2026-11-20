import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Todos los accesos se validan nuevamente contra Firestore, igual que en la web.
export const requireSessionGuard: CanActivateFn = async () => {
  const access = inject(AuthService);
  const router = inject(Router);
  try {
    return (await access.resolveSession()) ? true : router.createUrlTree(['/login']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};

export const guestGuard: CanActivateFn = async () => {
  const access = inject(AuthService);
  const router = inject(Router);
  try {
    return (await access.resolveSession()) ? router.createUrlTree(['/dashboard']) : true;
  } catch {
    return true;
  }
};
