import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, chevronBackOutline, chevronForwardOutline, peopleOutline, personAddOutline, searchOutline, layersOutline, gridOutline, listOutline, closeOutline, refreshOutline, locationOutline, callOutline, mailOutline, menuOutline, personOutline } from 'ionicons/icons';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, increment, type Unsubscribe, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { db, rtdb } from '../../core/firebase';
import { get, ref } from 'firebase/database';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { firebaseConfig, storage } from '../../core/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Campaign {id:string;nombreCampana:string;estado:string;}
interface Leader {puntuacion?:number;id:string;nombre:string;apellido:string;email:string;telefono:string;ciudad:string;departamento:string;padreId:string|null;nivel:number;estado:string;fotoUrl?:string;estimacionVotos:number;votosEstimadosSubarbol:number;votosRealesSubarbol:number;etiquetaId:string;multinodo?:boolean;}
interface Person {identificacion?:string;departamento?:string;responsableId?:string|null;id:string;nombre:string;apellido:string;telefono:string;email:string;ciudad:string;etiquetaId:string;observaciones:string;}
@Component({selector:'app-mi-red',standalone:true,imports:[FormsModule,IonContent,IonIcon,IonSpinner],templateUrl:'./mired.page.html',styleUrls:['./mired.page.scss']})
export class MiRedPage implements OnInit,OnDestroy {
 readonly profile=this.access.profile;
 levelsAllowed=1;campaigns:Campaign[]=[];campaignId='';rootName='';focusId:string|null=null;focus:Leader|null=null;leaders:Leader[]=[];people:Person[]=[];
 labels:Record<string,{nombre:string;color:string}>={};view:'grafica'|'tabla'|'comunidad'='grafica';search='';page=1;pageSize=10;
 stats:Record<string,{votos:number;directos:number;profundidad:number}>={};meetingStats:Record<string,{cantidad:number;personas:number}>={};statsReady=false;
 loading=true;branchLoading=false;peopleLoading=false;error='';menuOpen=false;detail:Leader|null=null;actionsFor:Leader|null=null;notesFor:Leader|null=null;notes:Array<{id:string;texto:string;fecha:Date|null}>=[];noteText='';editingNoteId='';notesBusy=false;peopleOwner:string|null=null;message='';
 leaderFormOpen=false;leaderFromPerson:Person|null=null;leaderParentId:string|null=null;leaderBusy=false;leaderPhoto:File|null=null;leaderPhotoPreview='';leaderForm={nombre:'',apellido:'',email:'',telefono:'',identificacion:'',departamento:'',ciudad:'',edad:'',password:'',multinodo:true,etiquetaId:'',estimacionVotos:0};
 personFormOpen=false;personBusy=false;personOwner:string|null=null;personForm={nombre:'',apellido:'',email:'',telefono:'',identificacion:'',departamento:'',ciudad:'',etiquetaId:'',observaciones:'',fechaReunion:'',lugarReunion:''};catalog:Record<string,Record<string,unknown>>={};catalogError='';meetingsData:Array<{id:string;responsableId:string|null;fecha:string;lugar:string;estado:string;cantidad:number}>=[];
 get labelEntries():Array<{key:string;value:{nombre:string;color:string}}>{return Object.entries(this.labels).map(([key,value])=>({key,value}));}
 get departments():string[]{return Object.keys(this.catalog).sort((a,b)=>a.localeCompare(b,'es'));}
 get cities():string[]{return Object.keys(this.catalog[this.personForm.departamento]||{}).sort((a,b)=>a.localeCompare(b,'es'));}
 private subscriptions:Unsubscribe[]=[];private branchSubs:Unsubscribe[]=[];
 constructor(private readonly access:AuthService,private readonly router:Router){addIcons({arrowBackOutline,chevronBackOutline,chevronForwardOutline,peopleOutline,personAddOutline,searchOutline,layersOutline,gridOutline,listOutline,closeOutline,refreshOutline,locationOutline,callOutline,mailOutline,menuOutline,personOutline});}
 get isOwner():boolean{return this.profile()?.rol==='cliente_admin';}
 get canInviteLeader():boolean{return this.isOwner||this.focus?.multinodo!==false&&!!this.focusId;}

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
 ngOnInit():void{void this.load();void this.loadCatalog();}
 ngOnDestroy():void{this.clearBranch();this.subscriptions.forEach(u=>u());}
 private clearBranch():void{this.branchSubs.forEach(u=>u());this.branchSubs=[];}
 async load():Promise<void>{
  const p=this.profile();if(!p){this.error='No hay sesión activa.';this.loading=false;return;}
  this.loading=true;this.error='';
  try{
   const client=await getDoc(doc(db,'clientes',p.clienteId));this.rootName=String(client.data()?.['responsable']||client.data()?.['nombreCliente']||p.clienteNombre);this.levelsAllowed=Math.max(1,Number(client.data()?.['nivelesRed']||1));
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
   this.meetingsData=snap.docs.map(d=>({id:d.id,responsableId:d.data()['responsableId']||null,fecha:String(d.data()['fecha']||''),lugar:String(d.data()['lugar']||''),estado:String(d.data()['estado']||''),cantidad:Number(d.data()['cantidad']||0)}));
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
 openLeaderForm(parent:string|null=this.focusId,person:Person|null=null):void{
  const p=this.profile();
  if(!p||!this.campaignId)return;
  if(!this.isOwner && (!parent||parent===this.rootId&&this.focus?.multinodo===false)){
   this.message='Este responsable no tiene habilitada la creación de líderes.';return;
  }
  this.actionsFor=null;this.leaderFromPerson=person;this.leaderParentId=parent;this.leaderPhoto=null;this.leaderPhotoPreview='';
  this.leaderForm={nombre:person?.nombre||'',apellido:person?.apellido||'',email:person?.email||'',telefono:person?.telefono||'',identificacion:person?.identificacion||'',departamento:person?.departamento||'',ciudad:person?.ciudad||'',edad:'',password:'',multinodo:true,etiquetaId:person?.etiquetaId||Object.keys(this.labels)[0]||'',estimacionVotos:0};
  this.error='';this.message='';this.leaderFormOpen=true;
 }
 onLeaderPhoto(event:Event):void{
  const file=(event.target as HTMLInputElement).files?.[0]||null;
  if(!file){this.leaderPhoto=null;this.leaderPhotoPreview='';return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){
   this.error='La foto debe ser JPG, PNG o WebP y pesar máximo 2 MB.';this.leaderPhoto=null;this.leaderPhotoPreview='';return;
  }
  this.leaderPhoto=file;this.error='';
  const reader=new FileReader();
  reader.onload=()=>this.leaderPhotoPreview=typeof reader.result==='string'?reader.result:'';
  reader.readAsDataURL(file);
 }
 openInviteLeader(person:Person):void{this.openLeaderForm(this.peopleOwner,person);}
 get leaderCities():string[]{return Object.keys(this.catalog[this.leaderForm.departamento]||{}).sort((a,b)=>a.localeCompare(b,'es'));}
 async submitLeaderInvitation():Promise<void>{
  const p=this.profile(),f=this.leaderForm,parent=this.leaderParentId;
  if(!p||!this.campaignId||this.leaderBusy)return;
  this.error='';
  if(!this.isOwner&& !parent){this.error='Un líder solo puede registrar descendientes de su red.';return;}
  if(!f.nombre.trim()||!f.apellido.trim()||!f.email.trim()||!f.etiquetaId||!this.labels[f.etiquetaId]){
   this.error='Nombre, apellido, correo y etiqueta válida son obligatorios.';return;
  }
  if(f.password.length<6){this.error='La contraseña inicial debe tener al menos seis caracteres.';return;}
  const estimate=Number(f.estimacionVotos);
  if(!Number.isSafeInteger(estimate)||estimate<0){this.error='La estimación debe ser un entero no negativo.';return;}
  if(f.edad&&( !Number.isInteger(Number(f.edad))||Number(f.edad)<18||Number(f.edad)>120)){
   this.error='Ingresa una edad válida entre 18 y 120 años.';return;
  }
  this.leaderBusy=true;
  let secondary:ReturnType<typeof initializeApp>|null=null;
  let createdUid='';
  try{
   const base=doc(db,'clientes',p.clienteId,'campanas',this.campaignId);
   const nodes=collection(base,'nodos');
   let parentLevel=1;
   if(parent){
    const parentSnap=await getDoc(doc(nodes,parent));
    if(!parentSnap.exists()||parentSnap.data()['estado']==='inactivo')throw Error('El responsable no está disponible.');
    if(parentSnap.data()['multinodo']===false)throw Error('Este responsable no tiene habilitado multinodo.');
    parentLevel=Number(parentSnap.data()['nivel']||1);
   }
   if(!this.isOwner){
    const rootId=this.rootId;
    if(!rootId||!parent)throw Error('No tienes un nodo habilitado para registrar líderes.');
    const seen=new Set<string>();let cursor:string|null=parent,authorized=false;
    while(cursor){
     if(seen.has(cursor)||seen.size>30)throw Error('Jerarquía inconsistente.');
     seen.add(cursor);
     if(cursor===rootId){authorized=true;break;}
     const ancestorSnap:DocumentSnapshot<DocumentData> = await getDoc(doc(nodes,String(cursor)));
     const ancestorData:DocumentData|undefined=ancestorSnap.data();
     if(!ancestorSnap.exists()||!ancestorData||ancestorData['estado']==='inactivo')break;
     cursor=String(ancestorData['padreId']||'')||null;
    }
    if(!authorized)throw Error('Solo puedes crear líderes dentro de tu propia red.');
   }
   const level=parentLevel+1;
   if(level>this.levelsAllowed)throw Error('Se alcanzó el máximo de '+this.levelsAllowed+' niveles contratados.');
   const siblings=await getDocs(query(nodes,where('padreId','==',parent),limit(11)));
   if(siblings.docs.filter(d=>d.data()['estado']!=='inactivo').length>=10)throw Error('Este responsable ya tiene diez líderes directos.');
   const ancestors:string[]=[],seen=new Set<string>();let cursor=parent;
   while(cursor){
    if(seen.has(cursor)||ancestors.length>30)throw Error('Jerarquía inconsistente.');
    seen.add(cursor);ancestors.push(cursor);
    const snap:DocumentSnapshot<DocumentData>=await getDoc(doc(nodes,String(cursor)));
    const data:DocumentData|undefined=snap.data();
    if(!snap.exists()||!data||data['estado']==='inactivo')throw Error('No se encontró un antecesor activo.');
    cursor=String(data['padreId']||'')||null;
   }
   secondary=initializeApp(firebaseConfig,'crear-lider-'+Date.now()+'-'+Math.random().toString(36).slice(2));
   const secondaryAuth=getAuth(secondary);
   const email=f.email.trim().toLowerCase();
   const credential=await createUserWithEmailAndPassword(secondaryAuth,email,f.password);
   createdUid=credential.user.uid;
   const nodeRef=doc(nodes),batch=writeBatch(db);
   let fotoUrl='';
   if(this.leaderPhoto){const photoRef=storageRef(storage,'clientes/'+p.clienteId+'/campanas/'+this.campaignId+'/lideres/'+nodeRef.id+'/foto-'+Date.now());await uploadBytes(photoRef,this.leaderPhoto,{contentType:this.leaderPhoto.type});fotoUrl=await getDownloadURL(photoRef);}
   const payload={nombre:f.nombre.trim(),apellido:f.apellido.trim(),telefono:f.telefono.trim(),identificacion:f.identificacion.trim(),departamento:f.departamento.trim(),ciudad:f.ciudad.trim(),edad:f.edad?Number(f.edad):null,etiquetaId:f.etiquetaId};
   batch.set(nodeRef,{...payload,fotoUrl,multinodo:f.multinodo,estimacionVotos:estimate,votosEstimadosSubarbol:estimate,votosRealesSubarbol:0,email,campanaId:this.campaignId,padreId:parent,nivel:level,uid:createdUid,estado:'activo',creadoEn:serverTimestamp(),actualizadoEn:serverTimestamp()});
   batch.set(doc(db,'usuarios',createdUid),{uid:createdUid,email,nombre:payload.nombre,apellido:payload.apellido,rol:'red_usuario',estado:'activo',clienteId:p.clienteId,campanaId:this.campaignId,nodoId:nodeRef.id,creadoEn:serverTimestamp()});
   for(const id of ancestors)batch.update(doc(nodes,id),{votosEstimadosSubarbol:increment(estimate)});
   batch.set(doc(base,'metricas','red'),{votosEstimados:increment(estimate)},{merge:true});
   await batch.commit();
   let verificationSent=false;
   try{await sendEmailVerification(credential.user);verificationSent=true;}catch(e){console.warn('No se pudo enviar verificación al nuevo líder',e);}
   this.leaderFormOpen=false;this.leaderFromPerson=null;this.leaderForm.password='';this.leaderPhoto=null;this.leaderPhotoPreview='';
   this.message=verificationSent?'Líder y cuenta creados. Se envió un correo de verificación.':'Líder y cuenta creados, pero no se pudo enviar el correo de verificación. Puede solicitarlo desde Login.';
  }catch(e){
   console.error('No se pudo crear líder',e);
   this.error=(createdUid?'Authentication pudo crear una cuenta sin finalizar Firestore. Comprueba el usuario antes de volver a intentar. ':'')+(e instanceof Error?e.message:'No fue posible crear el líder.');
  }finally{
   if(secondary){
    const instance=getAuth(secondary);
    await signOut(instance).catch(()=>undefined);
    await deleteApp(secondary).catch(()=>undefined);
   }
   this.leaderBusy=false;
  }
 }
 async loadCatalog():Promise<void>{try{const s=await get(ref(rtdb,'MUNICIPIOPUESTOS'));this.catalog=s.exists()?s.val():{};}catch{this.catalogError='No se pudieron cargar los departamentos y municipios.';}}
 openPersonForm(n:Leader):void{
  if(!this.isOwner){this.message='Los registros de comunidad requieren autorización del administrador.';return;}
  this.actionsFor=null;this.personOwner=n.id==='gerencia'?null:n.id;const active=this.meetingsData.find(x=>x.responsableId===this.personOwner&&x.estado==='activa');
  const date=new Date();const localDate=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  this.personForm={nombre:'',apellido:'',email:'',telefono:'',identificacion:'',departamento:'',ciudad:'',etiquetaId:Object.keys(this.labels)[0]||'',observaciones:'',fechaReunion:active?.fecha||localDate,lugarReunion:active?.lugar||''};
  this.personFormOpen=true;this.error='';this.message='';
 }
 async savePerson():Promise<void>{
  const p=this.profile(),f=this.personForm,owner=this.personOwner;
  if(!p||!this.campaignId||this.personBusy)return;
  if(!this.isOwner){this.error='No tienes permisos para registrar personas.';return;}
  if(!f.nombre.trim()||!f.apellido.trim()||!f.etiquetaId||!this.labels[f.etiquetaId]){this.error='Nombre, apellido y etiqueta válida son obligatorios.';return;}
  if(!f.fechaReunion||!f.lugarReunion.trim()){this.error='Indica fecha y lugar de la reunión.';return;}
  this.personBusy=true;this.error='';
  try{
   const base=collection(db,'clientes',p.clienteId,'campanas',this.campaignId,'reuniones').parent!;
   const meetings=collection(base,'reuniones');
   const active=this.meetingsData.find(x=>x.responsableId===owner&&x.estado==='activa');
   if(active&&(active.fecha!==f.fechaReunion||active.lugar!==f.lugarReunion.trim()))throw Error('Hay una reunión activa. Finalízala en la web antes de iniciar otra con fecha o lugar diferentes.');
   const ancestors:string[]=[];const visited=new Set<string>();let cursor=owner;
   while(cursor){if(visited.has(cursor)||ancestors.length>30)throw Error('Jerarquía inconsistente.');visited.add(cursor);ancestors.push(cursor);const node=await getDoc(doc(base,'nodos',cursor));if(!node.exists()||node.data()['estado']==='inactivo')throw Error('El responsable no está disponible.');cursor=node.data()['padreId']||null;}
   const batch=writeBatch(db),meetingDoc=active?doc(meetings,active.id):doc(meetings);
   if(active)batch.update(meetingDoc,{cantidad:increment(1)});
   else batch.set(meetingDoc,{responsableId:owner,fecha:f.fechaReunion,lugar:f.lugarReunion.trim(),estado:'activa',cantidad:1,creadoEn:serverTimestamp()});
   const people=owner?collection(base,'nodos',owner,'personas'):collection(base,'personasRaiz');
   batch.set(doc(people),{nombre:f.nombre.trim(),apellido:f.apellido.trim(),email:f.email.trim().toLowerCase(),telefono:f.telefono.trim(),identificacion:f.identificacion.trim(),departamento:f.departamento.trim(),ciudad:f.ciudad.trim(),etiquetaId:f.etiquetaId,observaciones:f.observaciones.trim(),multinodo:false,responsableId:owner,reunionId:meetingDoc.id,fechaReunion:f.fechaReunion,lugarReunion:f.lugarReunion.trim(),creadoEn:serverTimestamp(),actualizadoEn:serverTimestamp()});
   for(const id of ancestors)batch.update(doc(base,'nodos',id),{votosRealesSubarbol:increment(1)});
   batch.set(doc(base,'metricas','red'),{registros:increment(1)},{merge:true});
   await batch.commit();this.personFormOpen=false;this.message='Persona registrada correctamente. No consume cupo de liderazgo.';
   if(this.view==='comunidad'&&this.peopleOwner===owner)this.showPeople();
  }catch(e){this.error=e instanceof Error?e.message:'No fue posible registrar la persona.';}finally{this.personBusy=false;}
 }
 unavailable(action:string):void{this.message=action+' requiere portar las validaciones de la web antes de permitir cambios en Firebase.';}
 changeView(v:'grafica'|'tabla'|'comunidad'):void{if(v==='comunidad')this.showPeople();else{this.view=v;this.search='';}}
 next():void{this.page=Math.min(this.totalPages,this.page+1);}
 previous():void{this.page=Math.max(1,this.page-1);}
 navigate(path:string):void{this.menuOpen=false;void this.router.navigateByUrl(path);}
}
