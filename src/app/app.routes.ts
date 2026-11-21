import { Routes } from '@angular/router';
import { requireSessionGuard, guestGuard } from './core/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage) },
  { path: 'dashboard', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage) },
  { path: 'configuracion-campana', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/configuracion-campana/configuracion-campana.page').then(m => m.ConfiguracionCampanaPage) },
  { path: 'mired', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/mired/mired.page').then(m => m.MiRedPage) },
  { path: 'invitaciones', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/pending-section/pending-section.page').then(m => m.PendingSectionPage) },
  { path: 'evolucion-historica', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/pending-section/pending-section.page').then(m => m.PendingSectionPage) },
  { path: 'autorizaciones-gestion', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/pending-section/pending-section.page').then(m => m.PendingSectionPage) },
  { path: 'medios', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/pending-section/pending-section.page').then(m => m.PendingSectionPage) },
  { path: 'galeria', canActivate: [requireSessionGuard], loadComponent: () => import('./pages/pending-section/pending-section.page').then(m => m.PendingSectionPage) },
  { path: '**', redirectTo: 'login' }
];
