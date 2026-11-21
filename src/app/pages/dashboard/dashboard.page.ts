import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  collection, doc, getCountFromServer, getDoc, getDocs, updateDoc
} from 'firebase/firestore';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, gridOutline, layersOutline, logOutOutline,
  peopleOutline, shieldCheckmarkOutline, notificationsOutline, refreshOutline,
  searchOutline, trendingUpOutline, statsChartOutline, chevronBackOutline,
  chevronForwardOutline, closeOutline, locationOutline, menuOutline,
  personCircleOutline, pulseOutline, settingsOutline, mailOutline, folderOutline, imagesOutline
} from 'ionicons/icons';
import { AuthService } from '../../core/auth.service';
import { db } from '../../core/firebase';

type CampaignSummary = {
  id: string; nombre: string; corporacion: string; estado: string; lema: string;
  metaVotos: number; partidoMovimiento: string;
};
type NetworkMetrics = {
  integrantes: number; lideres: number; votosEstimados: number;
  votosRed: number; matrizDirectos: number; matrizProfundidad: number;
};
type LeaderSummary = {
  id: string; nombre: string; ciudad: string; fotoUrl: string;
  votos: number; estimado: number; matrizDirectos: number; matrizProfundidad: number;
};
type Notice = {
  id: string; titulo: string; mensaje: string; origen: string;
  leida: boolean; fecha: Date | null;
};
type AccountSummary = { nombre: string; plan: string; niveles: number; planActivo: boolean; logoURL: string };
type FirestoreDate = { toDate?: () => Date; seconds?: number };

const EMPTY_METRICS: NetworkMetrics = {
  integrantes: 0, lideres: 0, votosEstimados: 0, votosRed: 0,
  matrizDirectos: 0, matrizProfundidad: 0
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, IonContent, IonIcon, IonSpinner],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit {
  readonly profile = this.access.profile;
  loadingCampaigns = true;
  loggingOut = false;
  refreshing = false;
  warning = '';
  campaigns: CampaignSummary[] = [];
  metrics: NetworkMetrics = { ...EMPTY_METRICS };
  leaders: LeaderSummary[] = [];
  notices: Notice[] = [];
  account: AccountSummary | null = null;
  leaderQuery = '';
  projectionQuery = '';
  selectedLeaderId = '';
  projectionPage = 1;
  projectionPageSize = 5;
  notificationsOpen = false;
  menuOpen = false;
  activeTab: 'resumen' | 'lideres' | 'avisos' = 'resumen';

  constructor(private readonly access: AuthService, private readonly router: Router) {
    addIcons({
      checkmarkCircleOutline, gridOutline, layersOutline, logOutOutline,
      peopleOutline, shieldCheckmarkOutline, notificationsOutline, refreshOutline,
      searchOutline, trendingUpOutline, statsChartOutline, chevronBackOutline,
      chevronForwardOutline, closeOutline, locationOutline, menuOutline,
      personCircleOutline, pulseOutline
    });
  }

  ngOnInit(): void { void this.loadDashboard(); }

  get firstName(): string { return this.profile()?.nombre.split(' ')[0] || 'Usuario'; }
  get roleLabel(): string { return this.profile()?.rol === 'cliente_admin' ? 'Propietario / Administrador' : 'Líder de red'; }
  get activeCampaigns(): number { return this.campaigns.filter(item => item.estado === 'activa').length; }
  get currentSlogan(): string { return (this.campaigns.find(item => item.estado === 'activa') || this.campaigns[0])?.lema || ''; }
  get completion(): number {
    return this.metrics.votosEstimados > 0 ? this.metrics.votosRed / this.metrics.votosEstimados * 100 : 0;
  }
  get completionBar(): number { return this.clamp(this.completion); }
  get difference(): number { return this.metrics.votosEstimados - this.metrics.votosRed; }
  get unread(): number { return this.notices.filter(item => !item.leida).length; }
  get selectedLeader(): LeaderSummary | undefined {
    return this.leaders.find(item => item.id === this.selectedLeaderId);
  }
  get filteredLeaders(): LeaderSummary[] {
    const query = this.leaderQuery.trim().toLocaleLowerCase('es');
    return this.leaders.filter(item =>
      !query || `${item.nombre} ${item.ciudad}`.toLocaleLowerCase('es').includes(query)
    );
  }
  get projectionLeaders(): LeaderSummary[] {
    const query = this.projectionQuery.trim().toLocaleLowerCase('es');
    return [...this.leaders].filter(item =>
      !query || `${item.nombre} ${item.ciudad}`.toLocaleLowerCase('es').includes(query)
    ).sort((a, b) => b.votos - a.votos);
  }
  get projectionPages(): number { return Math.max(1, Math.ceil(this.projectionLeaders.length / this.projectionPageSize)); }
  get visibleProjection(): LeaderSummary[] {
    return this.projectionLeaders.slice((this.projectionPage - 1) * this.projectionPageSize,
      this.projectionPage * this.projectionPageSize);
  }
  get projectionMax(): number {
    return Math.max(1, ...this.projectionLeaders.flatMap(item => [item.votos, item.estimado]));
  }

  format(value: number): string { return value.toLocaleString('es-CO'); }
  percent(value: number): string { return Number.isFinite(value) ? value.toFixed(1) + '%' : '0.0%'; }
  clamp(value: number): number { return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); }
  bar(value: number, max: number): number { return this.clamp(max > 0 ? value / max * 100 : 0); }
  leaderProgress(item: LeaderSummary): number { return item.estimado > 0 ? item.votos / item.estimado * 100 : 0; }
  leaderComparisonMax(item: LeaderSummary): number { return Math.max(1, item.votos, item.estimado); }

  changePageSize(value: number | string): void {
    this.projectionPageSize = Math.max(1, Number(value) || 5);
    this.projectionPage = 1;
  }
  changeProjectionQuery(value: string): void { this.projectionQuery = value; this.projectionPage = 1; }
  previousPage(): void { this.projectionPage = Math.max(1, this.projectionPage - 1); }
  nextPage(): void { this.projectionPage = Math.min(this.projectionPages, this.projectionPage + 1); }
  selectLeader(item: LeaderSummary): void { this.selectedLeaderId = item.id; }
  notificationDate(date: Date | null): string {
    return date ? date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'Fecha no disponible';
  }
  navigateMenu(path: string): void { this.menuOpen = false; void this.router.navigateByUrl(path); }\n  switchTab(tab: 'resumen' | 'lideres' | 'avisos'): void {
    this.activeTab = tab;
    this.menuOpen = false;
  }

  async refresh(): Promise<void> {
    if (this.loadingCampaigns) return;
    this.refreshing = true;
    try { await this.loadDashboard(); } finally { this.refreshing = false; }
  }

  private async loadDashboard(): Promise<void> {
    const current = this.profile();
    if (!current) { this.loadingCampaigns = false; return; }
    this.loadingCampaigns = true;
    this.warning = '';
    try {
      const client = await getDoc(doc(db, 'clientes', current.clienteId));
      if (!client.exists()) throw new Error('No se encontró la cuenta del cliente.');
      const data = client.data();
      this.account = {
        nombre: String(data['nombreCliente'] || current.clienteNombre),
        plan: String((data['plan'] as { nombre?: string } | undefined)?.nombre || 'Plan activo'),
        niveles: Number(data['nivelesRed'] || 1),
        planActivo: data['planActivo'] !== false,
        logoURL: String(data['logoURL'] || '')
      };

      const campaignsSnapshot = current.rol === 'cliente_admin'
        ? await getDocs(collection(db, 'clientes', current.clienteId, 'campanas'))
        : null;
      let campaigns: Array<Record<string, unknown>> = campaignsSnapshot?.docs.map(item => ({ id: item.id, ...item.data() })) || [];
      if (current.rol === 'red_usuario' && current.campanaId) {
        const linked = await getDoc(doc(db, 'clientes', current.clienteId, 'campanas', current.campanaId));
        campaigns = linked.exists() ? [{ id: linked.id, ...linked.data() }] : [];
      }
      this.campaigns = campaigns.map(raw => ({
        id: String(raw['id'] || ''),
        nombre: String(raw['nombreCampana'] || 'Campaña'),
        corporacion: String(raw['corporacion'] || 'silueta'),
        estado: String(raw['estado'] || 'inactiva'),
        lema: String(raw['lema'] || ''),
        metaVotos: Number(raw['metaVotos'] || 0),
        partidoMovimiento: String(raw['partidoMovimiento'] || '')
      }));

      // Misma estructura de Firestore y reglas de cálculo que dashboard web.
      // En el rol de líder se acota el cálculo a su propio subárbol, sin mostrar
      // campañas ni notificaciones privadas de otros clientes.
      const summary: NetworkMetrics = { ...EMPTY_METRICS };
      const leaderList: LeaderSummary[] = [];
      let complete = true;
      for (const campaign of this.campaigns) {
        try {
          const base = ['clientes', current.clienteId, 'campanas', campaign.id] as const;
          if (current.rol === 'red_usuario' && current.nodoId) {
            const own = await getDoc(doc(db, ...base, 'nodos', current.nodoId));
            if (own.exists() && own.data()['estado'] !== 'inactivo') {
              const node = own.data();
              const votes = node['multinodo'] === false ? Math.max(1, Number(node['estimacionVotos']) || 1) : 1;
              const people = await getCountFromServer(collection(db, ...base, 'nodos', own.id, 'personas'));
              summary.lideres += 1;
              summary.integrantes += people.data().count;
              summary.votosEstimados += Number(node['estimacionVotos'] || 0);
              summary.votosRed += votes;
              summary.matrizDirectos += 0;
              summary.matrizProfundidad = Math.max(summary.matrizProfundidad, 1);
              leaderList.push(this.toLeader(campaign.id, own.id, node, votes, 0, 0));
            }
            continue;
          }

          const nodesSnap = await getDocs(collection(db, ...base, 'nodos'));
          const activeNodes = nodesSnap.docs.filter(item => item.data()['estado'] !== 'inactivo');
          const nodeMap = new Map(activeNodes.map(item => [item.id, item.data()]));
          const children = new Map<string, string[]>();
          for (const node of activeNodes) {
            const parent = String(node.data()['padreId'] || '');
            children.set(parent, [...(children.get(parent) || []), node.id]);
          }
          summary.matrizDirectos += (children.get('') || []).length;

          const depthCache = new Map<string, number>();
          const depthOf = (id: string, seen = new Set<string>()): number => {
            if (depthCache.has(id)) return depthCache.get(id)!;
            if (seen.has(id)) return 0;
            const next = new Set(seen);
            next.add(id);
            const depth = 1 + Math.max(0, ...(children.get(id) || []).map(child => depthOf(child, next)));
            depthCache.set(id, depth);
            return depth;
          };
          summary.matrizProfundidad = Math.max(summary.matrizProfundidad, 0,
            ...(children.get('') || []).map(id => depthOf(id)));

          const voteCache = new Map<string, number>();
          const calculateVotes = (id: string, seen = new Set<string>()): number => {
            if (voteCache.has(id)) return voteCache.get(id)!;
            if (seen.has(id)) return 0;
            const node = nodeMap.get(id);
            if (!node) return 0;
            const next = new Set(seen);
            next.add(id);
            const own = node['multinodo'] === false
              ? Math.max(1, Number(node['estimacionVotos']) || 1) : 1;
            const votes = own + (children.get(id) || []).reduce((sum, child) => sum + calculateVotes(child, next), 0);
            voteCache.set(id, votes);
            return votes;
          };

          for (const node of activeNodes) {
            const value = node.data();
            leaderList.push(this.toLeader(
              campaign.id, node.id, value, calculateVotes(node.id),
              (children.get(node.id) || []).length, Math.max(0, depthOf(node.id) - 1)
            ));
          }
          summary.lideres += activeNodes.length;
          const rootCount = await getCountFromServer(collection(db, ...base, 'personasRaiz'));
          summary.integrantes += rootCount.data().count;
          // Igual que la web: cuenta cada persona vinculada directamente a un líder.
          const counts = await Promise.all(activeNodes.map(item =>
            getCountFromServer(collection(db, ...base, 'nodos', item.id, 'personas'))
          ));
          summary.integrantes += counts.reduce((sum, item) => sum + item.data().count, 0);
          summary.votosEstimados += activeNodes.reduce((sum, item) =>
            sum + Number(item.data()['estimacionVotos'] || 0), 0);
          summary.votosRed += activeNodes.reduce((sum, item) => {
            const value = item.data();
            return sum + (value['multinodo'] === false
              ? Math.max(1, Number(value['estimacionVotos']) || 1) : 1);
          }, 0);
        } catch (error) {
          complete = false;
          console.warn('No se pudo calcular la red de la campaña', campaign.id, error);
        }
      }
      this.metrics = summary;
      this.leaders = leaderList.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      this.selectedLeaderId = this.leaders.some(item => item.id === this.selectedLeaderId)
        ? this.selectedLeaderId : this.leaders[0]?.id || '';

      if (current.rol === 'cliente_admin') {
        try {
          const notices = await getDocs(collection(db, 'clientes', current.clienteId, 'notificaciones'));
          this.notices = notices.docs.map(item => {
            const value = item.data();
            const raw = (value['fecha'] || value['createdAt'] || value['creadoEn']) as FirestoreDate | string | number | undefined;
            let date: Date | null = null;
            if (raw && typeof raw === 'object' && typeof raw.toDate === 'function') date = raw.toDate();
            else if (raw && typeof raw === 'object' && typeof raw.seconds === 'number') date = new Date(raw.seconds * 1000);
            else if (typeof raw === 'string' || typeof raw === 'number') date = new Date(raw);
            return {
              id: item.id,
              titulo: String(value['titulo'] || 'Notificación'),
              mensaje: String(value['mensaje'] || value['descripcion'] || ''),
              origen: ['master', 'red', 'sistema'].includes(String(value['origen']))
                ? String(value['origen']) : 'sistema',
              leida: value['leida'] === true,
              fecha: date && !Number.isNaN(date.getTime()) ? date : null
            };
          }).sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));
        } catch (error) {
          complete = false;
          console.warn('No fue posible cargar notificaciones', error);
          this.notices = [];
        }
      } else {
        this.notices = [];
      }
      if (!complete) this.warning = 'Algunos datos no pudieron cargarse. Verifica tus permisos o la conexión.';
    } catch (error) {
      console.error('Error al obtener dashboard', error);
      this.warning = 'No fue posible cargar el dashboard. Desliza o usa el botón actualizar para reintentar.';
    } finally {
      this.loadingCampaigns = false;
    }
  }

  private toLeader(
    campaignId: string, id: string, value: Record<string, unknown>,
    votes: number, direct: number, depth: number
  ): LeaderSummary {
    return {
      id: `${campaignId}:${id}`,
      nombre: [value['nombre'], value['apellido']].filter(Boolean).join(' ') || 'Líder',
      ciudad: String(value['municipio'] || value['ciudad'] || 'Ciudad no registrada'),
      fotoUrl: String(value['fotoUrl'] || ''),
      votos: votes,
      estimado: Number(value['estimacionVotos'] || 0),
      matrizDirectos: direct,
      matrizProfundidad: depth
    };
  }

  async markAsRead(item: Notice): Promise<void> {
    const current = this.profile();
    if (!current || current.rol !== 'cliente_admin' || item.leida) return;
    try {
      await updateDoc(doc(db, 'clientes', current.clienteId, 'notificaciones', item.id), { leida: true });
      item.leida = true;
    } catch {
      this.warning = 'No fue posible actualizar el estado de la notificación.';
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
