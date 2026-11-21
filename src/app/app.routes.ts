import { Routes } from '@angular/router';
import { requireSessionGuard, guestGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'dashboard',
    canActivate: [requireSessionGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage)
  },
  { path: 'configuracion-campana', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/configuracion-campana/configuracion-campana.page').then(m => m.ConfiguracionCampanaPage) },\n 
];
