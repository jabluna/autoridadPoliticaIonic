import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, chevronBackOutline, chevronForwardOutline, peopleOutline, personAddOutline, searchOutline, layersOutline, gridOutline, listOutline, closeOutline, refreshOutline, locationOutline, callOutline, mailOutline, menuOutline, personOutline } from 'ionicons/icons';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { db } from '../../core/firebase';

interface Campaign {id:string;nombreCampana:string;estado:string;}
interface Leader {puntuacion?:number;id:string;nombre:string;apellido:string;email:string;telefono:string;ciudad:string;departamento:string;padreId:string|null;nivel:number;estado:string;fotoUrl?:string;estimacionVotos:number;votosEstimadosSubarbol:number;votosRealesSubarbol:number;etiquetaId:string;multinodo?:boolean;}
interface Person {id:string;nombre:string;apellido:string;telefono:string;email:string;ciudad:string;etiquetaId:string;observaciones:string;}
@Component({selector:'app-mi-red',standalone:true,imports:[FormsModule,IonContent,IonIcon,IonSpinner],templateUrl:'./mired.page.html',styleUrls:['./mired.page.scss']})
export class MiRedPage implements OnInit,OnDestroy {
 readonly profile=this.access.profile;
 campaigns:Campaign[]=[];campaignId='';rootName='';focusId:string|null=null;focus:Leader|null=null;leaders:Leader[]=[];people:Person[]=[];
 labels:Record<string,{nombre:string;color:string}>={};view:'grafica'|'tabla'|'comunidad'='grafica';search='';page=1;pageSize=10;
 stats:Record<string,{votos:number;directos:number;profundidad:number}>={};meetingStats:Record<string,{cantidad:number;personas:number}>={};statsReady=false;
 loading=true;branchLoading=false;peopleLoading=false;error='';menuOpen=false;detail:Leader|null=null;actionsFor:Leader|null=null;notesFor:Leader|null=null;notes:Array<{id:string;texto:string;fecha:Date|null}>=[];noteText='';editingNoteId='';notesBusy=false;peopleOwner:string|null=null;message='';
 private subscriptions:Unsubscribe[]=[];private branchSubs:Unsubscribe[]=[];
 constructor(private readonly access:AuthService,private readonly router:Router){addIcons({arrowBackOutline,chevronBackOutline,chevronForwardOutline,peopleOutline,personAddOutline,searchOutline,layersOutline,gridOutline,listOutline,closeOutline,refreshOutline,locationOutline,callOutline,mailOutline,menuOutline,personOutline});}
 get isOwner():boolean{return this.profile()?.rol==='cliente_admin';}
 get rootId():string|null{return this.isOwner?null:(this.profile()?.nodoId||null);}
 get selectedCampaign():Campaign|undefined{return this.campaigns.find(x=>x.id===this.campaignId);}
 get visibleLeaders():Leader[]{const q=this.search.trim().toLocaleLowerCase('es');return this.leaders.filter(x=>!q||[x.nombre,x.apellido,x.ciudad,x.email,x.telefono].some(s=>String(s||'').toLocaleLowerCase('es').includes(q)));}
 get pagedLeaders():Leader[]{return this.visibleLeaders.slice((this.page-1)*this.pageSize,this.page*this.pageSize);}
 get totalPages():number{return Math.max(1,Math.ceil(this.visibleLeaders.length/this.pageSize));}
 get visiblePeople():Person[]{const q=this.search.trim().toLocaleLowerCase('es');return this.people.filter(x=>!q||[x.nombre,x.apellido,x.ciudad,x.telefono].some(s=>String(s||'').toLocaleLowerCase('es').includes(q)));}
 get rootLeader():Leader {
  if(this.focus)return this.focus;
  const parts=this.rootName.trim().split(/\s+/);
  return {id:'gerencia',nombre:parts[0]||'Gerencia',apellido:parts.slice(1).join(' '),email:'',telefono:'',ciudad:'',departamento:'',padreId:null,nivel:1,estado:'activo',estimacionVotos:0,votosEstimadosSubarbol:0,votosRealesSubarbol:0,etiquetaId:'',multinodo:true};
 }
 get ownerName():string{return this.focus?this.fullName(this.focus):this.rootName;}
 get totalEstimate():number{return this.leaders.reduce((n,x)=>n+Number(x.estimacionVotos||0),0);}
 fullName(x:{nombre:string;apellido:string}):string{return [x.nombre,x.apellido].filter(Boolean).join(' ').trim();}
 stat(n:Leader){return this.stats[n.id]||{votos:0,directos:0,profundidad:0};}
 gap(n:Leader){return Number(n.estimacionVotos||0)-this.stat(n).votos;}
 progress(n:Leader){return Number(n.estimacionVotos)>0?Math.round(this.stat(n).votos/Number(n.estimacionVotos)*100):0;}
 meetings(id:string|null){return this.meetingStats[id||'root']||{cantidad:0,personas:0};}
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
 selectCampaign(id:string):void{
  this.campaignId=id;this.clearBranch();this.subscriptions.splice(1).forEach(u=>u());this.statsReady=false;this.stats={};this.meetingStats={};
  const p=this.profile();if(!p||!id)return;
  const base=collection(db,'clientes',p.clienteId,'campanas',id,'nodos');
  this.subscriptions.push(onSnapshot(query(base,limit(5001)),snap=>{
   if(snap.size>5000){this.statsReady=false;this.error='La red supera 5.000 líderes; el cálculo debe realizarse en el servidor.';return;}
   const active=snap.docs.map(d=>({...d.data(),id:d.id} as Leader)).filter(n=>n.estado!=='inactivo');
   const byParent=new Map<string,Leader[]>();for(const n of active){const key=n.padreId||'';byParent.set(key,[...(byParent.get(key)||[]),n]);}
   const computed:typeof this.stats={};const visiting=new Set<string>();
   const compute=(n:Leader):{votos:number;directos:number;profundidad:number}=>{
    if(computed[n.id])return computed[n.id];if(visiting.has(n.id))throw Error('Jerarquía circular detectada.');
    visiting.add(n.id);const direct=byParent.get(n.id)||[];let votos=n.multinodo===false?Math.max(1,Number(n.estimacionVotos)||1):1;let profundidad=0;
    for(const child of direct){const stat=compute(child);votos+=stat.votos;profundidad=Math.max(profundidad,1+stat.profundidad);}
    visiting.delete(n.id);return computed[n.id]={votos,directos:direct.length,profundidad};
   };
   try{for(const n of active)compute(n);this.stats=computed;this.statsReady=true;}
   catch(e){this.statsReady=false;this.error=e instanceof Error?e.message:'Error calculando la red.';}
  },()=>{this.error='No se pudo calcular la estructura de la red.';}));
  this.subscriptions.push(onSnapshot(query(collection(db,'clientes',p.clienteId,'campanas',id,'reuniones'),limit(5001)),snap=>{
   const result:typeof this.meetingStats={};for(const row of snap.docs){const data=row.data();const key=String(data['responsableId']||'root');const old=result[key]||{cantidad:0,personas:0};result[key]={cantidad:old.cantidad+1,personas:old.personas+Number(data['cantidad']||0)};}this.meetingStats=result;
  },()=>{this.error='No se pudieron cargar las reuniones.';}));
  this.openNode(this.rootId);
 }
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
  this.peopleOwner=this.focusId;this.view='comunidad';this.search='';this.peopleLoading=true;this.people=[];
  const path=this.focusId?collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'nodos',this.focusId,'personas'):collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'personasRaiz');
  getDocs(query(path,limit(200))).then(s=>{this.people=s.docs.map(x=>({...x.data(),id:x.id} as Person));}).catch(()=>{this.error='No se pudo consultar la comunidad.';}).finally(()=>this.peopleLoading=false);
 }
 openPeopleFor(n:Leader):void{this.actionsFor=null;if(n.id==='gerencia'){this.openNode(null);this.showPeople();return;}this.openNode(n.id);this.peopleOwner=n.id;this.view='comunidad';this.peopleLoading=true;const p=this.profile();if(!p)return;getDocs(query(collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'nodos',n.id,'personas'),limit(200))).then(s=>this.people=s.docs.map(d=>({...d.data(),id:d.id} as Person))).catch(()=>this.error='No fue posible consultar las personas.').finally(()=>this.peopleLoading=false);}
 async openNotes(n:Leader):Promise<void>{const p=this.profile();if(!p)return;this.actionsFor=null;this.notesFor=n;this.notes=[];this.noteText='';this.editingNoteId='';this.notesBusy=true;try{const s=await getDocs(collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'nodos',n.id,'notas'));this.notes=s.docs.map(d=>({id:d.id,texto:String(d.data()['texto']||''),fecha:d.data()['fecha']?.toDate?.()||null})).sort((a,b)=>(b.fecha?.getTime()||0)-(a.fecha?.getTime()||0));}catch{this.error='No se pudieron consultar los comentarios.';}finally{this.notesBusy=false;}}
 async saveNote():Promise<void>{const p=this.profile(),n=this.notesFor;if(!p||!n||!this.noteText.trim()||this.notesBusy)return;this.notesBusy=true;try{const col=collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'nodos',n.id,'notas');if(this.editingNoteId)await updateDoc(doc(col,this.editingNoteId),{texto:this.noteText.trim(),fechaEdicion:serverTimestamp()});else await setDoc(doc(col),{texto:this.noteText.trim(),fecha:serverTimestamp(),autorUid:p.uid||''});await this.openNotes(n);this.message='Comentario guardado.';}catch{this.error='No se pudo guardar el comentario.';}finally{this.notesBusy=false;}}
 async deleteNote(id:string):Promise<void>{const p=this.profile(),n=this.notesFor;if(!p||!n||this.notesBusy||!confirm('¿Eliminar este comentario?'))return;this.notesBusy=true;try{await deleteDoc(doc(db,'clientes',p.clienteId,'campanas',this.campaignId,'nodos',n.id,'notas',id));this.notes=this.notes.filter(x=>x.id!==id);this.message='Comentario eliminado.';}catch{this.error='No se pudo eliminar el comentario.';}finally{this.notesBusy=false;}}
 share(n:Leader):void{this.actionsFor=null;const votos=n.id==='gerencia'?this.leaders.reduce((sum,leader)=>sum+this.stat(leader).votos,0):this.stat(n).votos,estimado=Number(n.estimacionVotos||0);const msg='Resumen de la red de '+this.fullName(n)+'\\nVotos de la red: '+this.format(votos)+'\\nEstimado: '+this.format(estimado)+'\\nDiferencia: '+this.format(estimado-votos)+'\\nFecha: '+new Date().toLocaleString('es-CO');window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer');}
 unavailable(action:string):void{this.message=action+' requiere portar las validaciones de la web antes de permitir cambios en Firebase.';}
 changeView(v:'grafica'|'tabla'|'comunidad'):void{if(v==='comunidad')this.showPeople();else{this.view=v;this.search='';}}
 next():void{this.page=Math.min(this.totalPages,this.page+1);}
 previous():void{this.page=Math.max(1,this.page-1);}
 navigate(path:string):void{this.menuOpen=false;void this.router.navigateByUrl(path);}
}
