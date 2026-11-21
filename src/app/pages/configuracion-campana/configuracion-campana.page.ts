import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, addOutline, createOutline, trashOutline, checkmarkCircleOutline, closeOutline, swapHorizontalOutline, menuOutline, layersOutline } from 'ionicons/icons';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { get, ref } from 'firebase/database';
import { AuthService } from '../../core/auth.service';
import { db, rtdb } from '../../core/firebase';

type CampaignType = 'municipal' | 'departamental' | 'nacional';
type Corporation = 'silueta' | 'edil' | 'jac' | 'alcaldia' | 'concejo' | 'gobernacion' | 'asamblea' | 'presidencia';
type Campaign = {
  id: string; tipo: CampaignType; corporacion: Corporation; departamento: string; municipio: string;
  nombreCampana: string; candidato: string; partidoMovimiento: string; lema: string;
  metaVotos: number; fechaEleccion: string; alcancePuestos: 'todos' | 'seleccionados';
  puestosSeleccionados: string[]; totalPuestos: number; totalMesas: number; estado: string;
};
const TYPES: Record<CampaignType, {value:Corporation;label:string}[]> = {
  municipal: [{value:'silueta',label:'Silueta'},{value:'edil',label:'Edil / JAL'},{value:'jac',label:'Junta de Acción Comunal (JAC)'},{value:'alcaldia',label:'Alcaldía'},{value:'concejo',label:'Concejo municipal'}],
  departamental: [{value:'gobernacion',label:'Gobernación'},{value:'asamblea',label:'Asamblea departamental'}],
  nacional: [{value:'presidencia',label:'Presidencia'}]
};
function blank(): Campaign { return { id:'',tipo:'municipal',corporacion:'silueta',departamento:'',municipio:'',nombreCampana:'',candidato:'',partidoMovimiento:'',lema:'',metaVotos:0,fechaEleccion:'',alcancePuestos:'todos',puestosSeleccionados:[],totalPuestos:0,totalMesas:0,estado:'inactiva' }; }
@Component({
  selector:'app-configuracion-campana', standalone:true,
  imports:[FormsModule,IonContent,IonIcon,IonSpinner],
  templateUrl:'./configuracion-campana.page.html',styleUrls:['./configuracion-campana.page.scss']
})
export class ConfiguracionCampanaPage implements OnInit {
  readonly profile=this.access.profile;
  campaigns:Campaign[]=[]; catalog:Record<string,Record<string,Record<string,unknown>>>={};
  client:Record<string,unknown>={}; form:Campaign=blank();
  loading=true; saving=false; formOpen=false; menuOpen=false; step=1;
  error=''; success=''; confirmDelete:Campaign|null=null; requestUpgrade:Corporation|null=null;
  readonly options=TYPES;
  constructor(private readonly access:AuthService,private readonly router:Router) {
    addIcons({arrowBackOutline,addOutline,createOutline,trashOutline,checkmarkCircleOutline,closeOutline,swapHorizontalOutline,menuOutline,layersOutline});
  }
  ngOnInit():void { void this.load(); }
  get isOwner():boolean{return this.profile()?.rol==='cliente_admin';}
  get activeCampaignCount():number{return this.campaigns.filter(c=>c.estado==='activa').length;}\n  get departments():string[]{return Object.keys(this.catalog).sort((a,b)=>a.localeCompare(b,'es'));}
  get municipalities():string[]{return Object.keys(this.catalog[this.form.departamento]||{}).sort((a,b)=>a.localeCompare(b,'es'));}
  get votingPlaces():{name:string;mesas:number}[]{return Object.entries(this.catalog[this.form.departamento]?.[this.form.municipio]||{}).map(([name,raw])=>({name,mesas:Number(raw)||0})).sort((a,b)=>a.name.localeCompare(b.name,'es'));}
  get totalSteps():number{return this.form.tipo==='municipal'?5:4;}
  get isReview():boolean{return this.step===this.totalSteps;}
  get totalMesas():number{return this.votingPlaces.filter(p=>this.form.alcancePuestos==='todos'||this.form.puestosSeleccionados.includes(p.name)).reduce((s,p)=>s+p.mesas,0);}
  get licensed():string[]{const plan=this.client['plan'] as {preciosCampana?:Array<{id:string;activo?:boolean}>}|undefined;return (plan?.preciosCampana||[]).filter(x=>x.activo!==false).map(x=>x.id);}
  allowed(corporation:Corporation):boolean{return corporation==='silueta'||!Array.isArray((this.client['plan'] as {preciosCampana?:unknown}|undefined)?.preciosCampana)||this.licensed.includes(corporation)||this.campaigns.some(c=>c.corporacion===corporation);}
  private async load():Promise<void>{
    this.loading=true;this.error='';
    const current=this.profile();
    if(!current){this.error='No hay sesión activa.';this.loading=false;return;}
    if(!this.isOwner){this.error='Solo el propietario puede configurar campañas.';this.loading=false;return;}
    try{
      const client=await getDoc(doc(db,'clientes',current.clienteId));
      this.client=client.data()||{};
      await this.reloadCampaigns();
      try{const geography=await get(ref(rtdb,'MUNICIPIOPUESTOS'));this.catalog=geography.exists()?geography.val():{};}
      catch{this.error='No se pudo consultar el catálogo electoral. Revisa los permisos de Realtime Database.';}
    }catch(e){console.error(e);this.error='No fue posible cargar las campañas.';}
    finally{this.loading=false;}
  }
  async reloadCampaigns():Promise<void>{
    const current=this.profile();if(!current)return;
    const snap=await getDocs(collection(db,'clientes',current.clienteId,'campanas'));
    this.campaigns=snap.docs.map(x=>({ ...blank(), ...x.data(),id:x.id } as Campaign)).sort((a,b)=>(a.estado==='activa'?-1:1)-(b.estado==='activa'?-1:1)||a.nombreCampana.localeCompare(b.nombreCampana,'es'));
  }
  newCampaign():void{this.form=blank();this.form.candidato=String(this.client['responsable']||this.client['nombreCliente']||'');this.form.partidoMovimiento=String(this.client['partidoMovimiento']||'');this.formOpen=true;this.step=1;this.error='';this.success='';}
  edit(c:Campaign,transform=false):void{this.form={...c,puestosSeleccionados:[...(c.puestosSeleccionados||[])]};this.formOpen=true;this.step=transform?1:2;this.error='';this.success='';}
  close():void{this.formOpen=false;this.error='';}
  changeType(type:CampaignType):void{this.form.tipo=type;this.form.corporacion=TYPES[type][0].value;this.form.departamento='';this.form.municipio='';this.form.alcancePuestos='todos';this.form.puestosSeleccionados=[];}
  changeDepartment():void{this.form.municipio='';this.form.puestosSeleccionados=[];}
  changeMunicipality():void{this.form.puestosSeleccionados=[];}
  togglePlace(name:string):void{const selected=this.form.puestosSeleccionados;this.form.puestosSeleccionados=selected.includes(name)?selected.filter(x=>x!==name):[...selected,name];}
  stepName(n:number):string{
    if(n===1)return 'Tipo de campaña';if(n===2)return 'Datos generales';
    if(n===3)return this.form.tipo==='nacional'?'Multired':'Territorio';
    if(n===4)return this.form.tipo==='municipal'?'Puestos y mesas':'Revisión';
    return 'Revisión';
  }
  private validate(step:number):boolean{
    this.error='';
    if(step===1&&!this.allowed(this.form.corporacion)){this.requestUpgrade=this.form.corporacion;return false;}
    if(step===2&&(!this.form.nombreCampana.trim()||!this.form.candidato.trim())){this.error='Completa el nombre de la campaña y el candidato.';return false;}
    if(step===3&&this.form.tipo!=='nacional'&&(!this.form.departamento||(this.form.tipo==='municipal'&&!this.form.municipio))){this.error='Selecciona el departamento y, si corresponde, el municipio.';return false;}
    if(step===4&&this.form.tipo==='municipal'&&this.form.alcancePuestos==='seleccionados'&&!this.form.puestosSeleccionados.length){this.error='Selecciona al menos un puesto de votación.';return false;}
    return true;
  }
  next():void{if(this.validate(this.step))this.step=Math.min(this.totalSteps,this.step+1);}
  previous():void{this.error='';this.step=Math.max(1,this.step-1);}
  async save():Promise<void>{
    if(!this.isOwner||this.saving)return;
    for(let n=1;n<this.totalSteps;n++)if(!this.validate(n)){this.step=n;return;}
    const current=this.profile();if(!current)return;
    this.saving=true;this.error='';
    try{
      const target=this.form.id?doc(db,'clientes',current.clienteId,'campanas',this.form.id):doc(collection(db,'clientes',current.clienteId,'campanas'));
      const previous=this.campaigns.find(x=>x.id===this.form.id);
      await setDoc(target,{
        tipo:this.form.tipo,corporacion:this.form.corporacion,
        departamento:this.form.tipo==='nacional'?'':this.form.departamento,
        municipio:this.form.tipo==='municipal'?this.form.municipio:'',
        nombreCampana:this.form.nombreCampana.trim(),candidato:this.form.candidato.trim(),
        partidoMovimiento:this.form.partidoMovimiento.trim(),lema:this.form.lema.trim(),
        metaVotos:Number(this.form.metaVotos)||0,fechaEleccion:this.form.fechaEleccion||'',
        alcancePuestos:this.form.tipo==='municipal'?this.form.alcancePuestos:'todos',
        puestosSeleccionados:this.form.tipo==='municipal'&&this.form.alcancePuestos==='seleccionados'?this.form.puestosSeleccionados:[],
        totalPuestos:this.form.tipo==='municipal'?(this.form.alcancePuestos==='todos'?this.votingPlaces.length:this.form.puestosSeleccionados.length):0,
        totalMesas:this.form.tipo==='municipal'?this.totalMesas:0,
        nivelesMultiredPermitidos:Number(this.client['nivelesRed']||1),
        estado:previous?.estado||'inactiva',actualizadoEn:serverTimestamp(),
        ...(!this.form.id?{creadoEn:serverTimestamp()}:{})
      },{merge:true});
      await this.reloadCampaigns();this.formOpen=false;this.success='Campaña guardada correctamente.';
    }catch(e){console.error(e);this.error='No fue posible guardar la campaña. Comprueba los permisos de Firebase.';}
    finally{this.saving=false;}
  }
  async toggleActive(c:Campaign):Promise<void>{
    if(!this.isOwner)return;const current=this.profile();if(!current)return;
    try{await updateDoc(doc(db,'clientes',current.clienteId,'campanas',c.id),{estado:c.estado==='activa'?'inactiva':'activa',actualizadoEn:serverTimestamp()});await this.reloadCampaigns();}
    catch{this.error='No se pudo cambiar el estado de la campaña.';}
  }
  async deleteCampaign():Promise<void>{
    const c=this.confirmDelete,current=this.profile();if(!c||!current||!this.isOwner)return;
    this.saving=true;
    try{await deleteDoc(doc(db,'clientes',current.clienteId,'campanas',c.id));this.confirmDelete=null;await this.reloadCampaigns();this.success='Campaña eliminada.';}
    catch{this.error='No se pudo eliminar la campaña. Verifica que no tenga una red vinculada.';}
    finally{this.saving=false;}
  }
  async sendUpgrade():Promise<void>{
    const current=this.profile(),type=this.requestUpgrade;if(!current||!type)return;
    this.saving=true;
    try{
      await setDoc(doc(collection(db,'clientes',current.clienteId,'solicitudesPlan')),{tipo:'agregar_campana',campanaSolicitada:type,nivelesActuales:Number(this.client['nivelesRed']||1),nivelesSolicitados:null,planActual:this.client['plan']||{},estado:'pendiente',creadoEn:serverTimestamp()});
      this.requestUpgrade=null;this.success='Solicitud de ampliación enviada.';
    }catch{this.error='No fue posible enviar la solicitud.';}
    finally{this.saving=false;}
  }
  back():void{void this.router.navigateByUrl('/dashboard');}
}
