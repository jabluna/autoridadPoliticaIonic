import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, chevronBackOutline, chevronForwardOutline, peopleOutline, personAddOutline, searchOutline, layersOutline, gridOutline, listOutline, closeOutline, refreshOutline, locationOutline, callOutline, mailOutline, menuOutline, personOutline } from 'ionicons/icons';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { db } from '../../core/firebase';

interface Campaign {id:string;nombreCampana:string;estado:string;}
interface Leader {id:string;nombre:string;apellido:string;email:string;telefono:string;ciudad:string;departamento:string;padreId:string|null;nivel:number;estado:string;fotoUrl?:string;estimacionVotos:number;votosEstimadosSubarbol:number;votosRealesSubarbol:number;etiquetaId:string;multinodo?:boolean;}
interface Person {id:string;nombre:string;apellido:string;telefono:string;email:string;ciudad:string;etiquetaId:string;observaciones:string;}
@Component({selector:'app-mi-red',standalone:true,imports:[FormsModule,IonContent,IonIcon,IonSpinner],templateUrl:'./mired.page.html',styleUrls:['./mired.page.scss']})
export class MiRedPage implements OnInit,OnDestroy {
 readonly profile=this.access.profile;
 campaigns:Campaign[]=[];campaignId='';rootName='';focusId:string|null=null;focus:Leader|null=null;leaders:Leader[]=[];people:Person[]=[];
 labels:Record<string,{nombre:string;color:string}>={};view:'grafica'|'tabla'|'comunidad'='grafica';search='';page=1;pageSize=10;
 loading=true;branchLoading=false;peopleLoading=false;error='';menuOpen=false;detail:Leader|null=null;
 private subscriptions:Unsubscribe[]=[];private branchSubs:Unsubscribe[]=[];
 constructor(private readonly access:AuthService,private readonly router:Router){addIcons({arrowBackOutline,chevronBackOutline,chevronForwardOutline,peopleOutline,personAddOutline,searchOutline,layersOutline,gridOutline,listOutline,closeOutline,refreshOutline,locationOutline,callOutline,mailOutline,menuOutline,personOutline});}
 get isOwner():boolean{return this.profile()?.rol==='cliente_admin';}
 get rootId():string|null{return this.isOwner?null:(this.profile()?.nodoId||null);}
 get selectedCampaign():Campaign|undefined{return this.campaigns.find(x=>x.id===this.campaignId);}
 get visibleLeaders():Leader[]{const q=this.search.trim().toLocaleLowerCase('es');return this.leaders.filter(x=>!q||[x.nombre,x.apellido,x.ciudad,x.email,x.telefono].some(s=>String(s||'').toLocaleLowerCase('es').includes(q)));}
 get pagedLeaders():Leader[]{return this.visibleLeaders.slice((this.page-1)*this.pageSize,this.page*this.pageSize);}
 get totalPages():number{return Math.max(1,Math.ceil(this.visibleLeaders.length/this.pageSize));}
 get visiblePeople():Person[]{const q=this.search.trim().toLocaleLowerCase('es');return this.people.filter(x=>!q||[x.nombre,x.apellido,x.ciudad,x.telefono].some(s=>String(s||'').toLocaleLowerCase('es').includes(q)));}
 get ownerName():string{return this.focus?this.fullName(this.focus):this.rootName;}
 get totalEstimate():number{return this.leaders.reduce((n,x)=>n+Number(x.estimacionVotos||0),0);}
 fullName(x:{nombre:string;apellido:string}):string{return [x.nombre,x.apellido].filter(Boolean).join(' ').trim();}
 format(n:number):string{return new Intl.NumberFormat('es-CO').format(n||0);}
 label(id:string):string{return this.labels[id]?.nombre||'Sin etiqueta';}
 ngOnInit():void{void this.load();}
 ngOnDestroy():void{this.clearBranch();this.subscriptions.forEach(u=>u());}
 private clearBranch():void{this.branchSubs.forEach(u=>u());this.branchSubs=[];}
 async load():Promise<void>{
  const p=this.profile();if(!p){this.error='No hay sesión activa.';this.loading=false;return;}
  this.loading=true;this.error='';
  try{
   const client=await getDoc(doc(db,'clientes',p.clienteId));this.rootName=String(client.data()?.['responsable']||client.data()?.['nombreCliente']||p.clienteNombre);
   if(this.isOwner){const snap=await getDocs(collection(db,'clientes',p.clienteId,'campanas'));this.campaigns=snap.docs.map(x=>({id:x.id,nombreCampana:String(x.data()['nombreCampana']||x.id),estado:String(x.data()['estado']||'inactiva')}));}
   else{this.campaigns=[{id:p.campanaId||'',nombreCampana:'Mi campaña',estado:'activa'}];}
   const labelsRef=collection(db,'clientes',p.clienteId,'etiquetasNodo');
   this.subscriptions.push(onSnapshot(labelsRef,snap=>{const values:typeof this.labels={};snap.forEach(x=>{if(!x.data()['eliminada'])values[x.id]={nombre:String(x.data()['nombre']||''),color:String(x.data()['color']||'#65c991')};});this.labels=values;},()=>{}));
   this.campaignId=this.campaigns.find(x=>x.estado==='activa')?.id||this.campaigns[0]?.id||'';
   if(this.campaignId)this.selectCampaign(this.campaignId);
  }catch(e){console.error(e);this.error='No fue posible cargar la red. Revisa los permisos de Firebase.';}
  finally{this.loading=false;}
 }
 selectCampaign(id:string):void{this.campaignId=id;this.openNode(this.rootId);}
 openNode(id:string|null):void{
  const p=this.profile();if(!p||!this.campaignId)return;
  if(!this.isOwner&&id===null)return;
  this.clearBranch();this.focusId=id;this.focus=null;this.leaders=[];this.people=[];this.page=1;this.search='';this.view='grafica';this.branchLoading=true;this.error='';
  const nodes=collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'nodos');
  if(id){
   this.branchSubs.push(onSnapshot(doc(nodes,id),s=>{if(!s.exists()||s.data()['estado']==='inactivo'){this.error='Este nodo no está disponible.';return;}this.focus={...s.data(),id:s.id} as Leader;},()=>{this.error='No se pudo consultar el líder.';}));
  }
  this.branchSubs.push(onSnapshot(query(nodes,where('padreId','==',id)),snap=>{this.leaders=snap.docs.map(x=>({...x.data(),id:x.id} as Leader)).filter(x=>x.estado!=='inactivo').sort((a,b)=>this.fullName(a).localeCompare(this.fullName(b),'es'));this.branchLoading=false;},()=>{this.branchLoading=false;this.error='No se pudo consultar esta rama de la red.';}));
 }
 parent():void{if(!this.focusId||(!this.isOwner&&this.focusId===this.rootId))return;this.openNode(this.focus?.padreId||null);}
 showPeople():void{
  const p=this.profile();if(!p||!this.campaignId)return;
  if(!this.isOwner&&!this.focusId)return;
  this.view='comunidad';this.search='';this.peopleLoading=true;this.people=[];
  const path=this.focusId?collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'nodos',this.focusId,'personas'):collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'personasRaiz');
  getDocs(query(path,limit(200))).then(s=>{this.people=s.docs.map(x=>({...x.data(),id:x.id} as Person));}).catch(()=>{this.error='No se pudo consultar la comunidad.';}).finally(()=>this.peopleLoading=false);
 }
 changeView(v:'grafica'|'tabla'|'comunidad'):void{if(v==='comunidad')this.showPeople();else{this.view=v;this.search='';}}
 next():void{this.page=Math.min(this.totalPages,this.page+1);}
 previous():void{this.page=Math.max(1,this.page-1);}
 navigate(path:string):void{this.menuOpen=false;void this.router.navigateByUrl(path);}
}
