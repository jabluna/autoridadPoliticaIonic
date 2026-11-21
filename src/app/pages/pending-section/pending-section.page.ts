import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, constructOutline } from 'ionicons/icons';
@Component({selector:'app-pending-section',standalone:true,imports:[IonContent,IonIcon],template:`
<ion-content [fullscreen]="true" class="pending-screen">
  <main class="pending-wrap">
    <button class="back" (click)="back()"><ion-icon name="arrow-back-outline"></ion-icon> Volver al dashboard</button>
    <div class="pending-card"><ion-icon name="construct-outline"></ion-icon><span>PRÓXIMA SECCIÓN</span><h1>{{title}}</h1><p>Esta sección ya está incorporada en la navegación de la app. Su réplica nativa y conexión de datos se implementarán en la siguiente etapa.</p></div>
  </main>
</ion-content>`,styles:[`:host{color:#e9f9ef}.pending-screen{--background:#071b18}.pending-wrap{padding:calc(30px + env(safe-area-inset-top)) 18px;max-width:650px;margin:auto}.back{background:#1d4430;color:#d4f7df;border:1px solid #3a7050;padding:12px 15px;border-radius:11px;display:flex;gap:10px;align-items:center}.pending-card{margin-top:35px;background:#102b20;border:1px solid #3b694b;border-radius:23px;padding:30px}.pending-card>ion-icon{font-size:34px;color:#8be8a9}.pending-card span{display:block;margin-top:15px;color:#87dba5;font-size:10px;letter-spacing:.13em}.pending-card h1{font-size:28px}.pending-card p{color:#a1c5ad;font-size:13px;line-height:1.7}`]
})
export class PendingSectionPage {
  readonly title: string;
  constructor(route:ActivatedRoute,private readonly router:Router){
    addIcons({arrowBackOutline,constructOutline});
    const names:Record<string,string>={'mired':'Mi red','invitaciones':'Invitaciones a campañas','evolucion-historica':'Evolución histórica','autorizaciones-gestion':'Autorizaciones y gestión','medios':'Medios','galeria':'Galería'};
    this.title=names[route.snapshot.routeConfig?.path||'']||'Sección';
  }
  back():void{void this.router.navigateByUrl('/dashboard');}
}
