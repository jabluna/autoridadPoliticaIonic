import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  gridOutline,
  layersOutline,
  logOutOutline,
  peopleOutline,
  shieldCheckmarkOutline
} from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { db } from '../../core/firebase';

type CampaignSummary = { id: string; nombre: string; corporacion: string; estado: string; };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit {
  readonly profile = this.access.profile;
  loadingCampaigns = true;
  loggingOut = false;
  warning = '';
  campaigns: CampaignSummary[] = [];

  constructor(
    private readonly access: AuthService,
    private readonly router: Router
  ) {
    addIcons({ checkmarkCircleOutline, gridOutline, layersOutline, logOutOutline, peopleOutline, shieldCheckmarkOutline });
  }

  ngOnInit(): void {
    void this.loadCampaigns();
  }

  get firstName(): string {
    return this.profile()?.nombre.split(' ')[0] || 'Usuario';
  }

  get activeCampaigns(): number {
    return this.campaigns.filter(item => item.estado === 'activa').length;
  }

  get roleLabel(): string {
    return this.profile()?.rol === 'cliente_admin' ? 'Propietario / Administrador' : 'Líder de red';
  }

  private async loadCampaigns(): Promise<void> {
    const current = this.profile();
    if (!current) {
      this.loadingCampaigns = false;
      return;
    }
    try {
      if (current.rol === 'cliente_admin') {
        const snap = await getDocs(collection(db, 'clientes', current.clienteId, 'campanas'));
        this.campaigns = snap.docs.map(item => {
          const value = item.data();
          return {
            id: item.id,
            nombre: String(value['nombreCampana'] || 'Campaña'),
            corporacion: String(value['corporacion'] || 'silueta'),
            estado: String(value['estado'] || 'inactiva')
          };
        });
      } else if (current.campanaId) {
        const snap = await getDoc(doc(db, 'clientes', current.clienteId, 'campanas', current.campanaId));
        if (snap.exists()) {
          const value = snap.data();
          this.campaigns = [{
            id: snap.id,
            nombre: String(value['nombreCampana'] || 'Mi grupo'),
            corporacion: String(value['corporacion'] || 'silueta'),
            estado: String(value['estado'] || 'inactiva')
          }];
        }
      }
    } catch (error) {
      console.warn('Dashboard: no fue posible obtener campañas', error);
      this.warning = 'No se pudieron cargar las campañas en este momento.';
    } finally {
      this.loadingCampaigns = false;
    }
  }

  async logout(): Promise<void> {
    if (this.loggingOut) return;
    this.loggingOut = true;
    try {
      await this.access.logout();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch {
      this.warning = 'No fue posible cerrar la sesión. Intenta nuevamente.';
    } finally {
      this.loggingOut = false;
    }
  }
}
