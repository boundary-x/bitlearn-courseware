// Coordinates are mm relative to chassisVisual, whose CAD height origin is 37.8031 mm.
export const BITRUN_MODULES={units:'mm',forward:[0,0,1],sideConvention:'robot left/right looking forward (+Z); left is +X',modules:[
 {id:'servo.right',name:'서보 · 로봇 기준 오른쪽',label:'서보 R',kind:'servo',position:[-55.6251,5.2077,0.0002],direction:[-1,0,0],bounds:[[-71.8751,-10.7923,-6.1998],[-39.3751,21.2077,6.2002]],labelPosition:[-60,32,8],sourceId:703160,physicsMotorIndex:0,gpioPin:null},
 {id:'servo.left',name:'서보 · 로봇 기준 왼쪽',label:'서보 L',kind:'servo',position:[55.6296,5.2077,0.0002],direction:[1,0,0],bounds:[[39.3796,-10.7923,-6.1998],[71.8796,21.2077,6.2002]],labelPosition:[60,32,8],sourceId:703161,physicsMotorIndex:1,gpioPin:null},
 {id:'line.front',name:'라인센서 · 전면 하단',label:'라인센서',kind:'line',position:[34.4825,-29.1934,75.3644],direction:[0,-1,0],bounds:[[27.4825,-29.1934,41.7644],[41.4825,-11.0134,78.7644]],labelPosition:[34.4825,-15,91],sourceId:703151,gpioPin:null},
 {id:'microbit.main',name:'마이크로비트 · 전면',label:'마이크로비트',kind:'microbit',position:[0,28.2469,15.5],direction:[0,0,1],bounds:[[-26.0001,7.4981,8.553],[25.9999,50.5951,19.353]],labelPosition:[0,70,15.5],sourceId:703167}
]};
export function createBitrunModules({THREE,parent,onChange=()=>{}}){
 const modules=new Map(),readings=new Map(),root=new THREE.Group();root.name='bitrun.modules';parent.add(root);
 for(const spec of BITRUN_MODULES.modules){const node=new THREE.Object3D();node.name=spec.id;node.position.fromArray(spec.position);node.userData=structuredClone(spec);root.add(node);modules.set(spec.id,node);}
 const marker=new THREE.Group();marker.visible=false;root.add(marker);const material=new THREE.MeshBasicMaterial({color:0xffa23c,transparent:true,opacity:.95,depthTest:false,depthWrite:false});
 const point=new THREE.Mesh(new THREE.SphereGeometry(2,12,8),material);point.renderOrder=2000;marker.add(point);const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),15,0xffa23c,4,2);for(const part of [arrow.line,arrow.cone]){part.material.depthTest=false;part.material.depthWrite=false;part.renderOrder=2000;}marker.add(arrow);let selected=null;
 function getModule(id){const n=modules.get(id);if(!n)throw new RangeError(`Unknown module: ${id}`);return n;}
 function getWorldPose(id){const n=getModule(id);parent.updateWorldMatrix(true,true);return {id,position:n.getWorldPosition(new THREE.Vector3()).toArray(),direction:new THREE.Vector3(...n.userData.direction).transformDirection(n.matrixWorld).toArray()};}
 function select(id){const n=id?getModule(id):null;selected=id||null;marker.visible=!!n;if(n){marker.position.copy(n.position);arrow.setDirection(new THREE.Vector3(...n.userData.direction));}onChange();}
 function pick(raycaster){parent.updateWorldMatrix(true,true);const ray=raycaster.ray.clone().applyMatrix4(parent.matrixWorld.clone().invert());let hit=null;for(const [id,node]of modules){const [min,max]=node.userData.bounds;const p=ray.intersectBox(new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)),new THREE.Vector3());if(!p)continue;p.applyMatrix4(parent.matrixWorld);const distance=p.distanceTo(raycaster.ray.origin);if(!hit||distance<hit.distance)hit={id,node,point:p,distance};}return hit;}
 function setReading(id,value){const n=getModule(id);if(!value||typeof value!=='object')throw new TypeError('Object reading required');if(n.userData.kind==='servo'&&!Number.isFinite(value.rpm))throw new TypeError('Finite rpm required');if(n.userData.kind==='line'&&typeof value.detected!=='boolean'&&value.detected!==null)throw new TypeError('detected must be boolean or null');readings.set(id,structuredClone(value));onChange();}
 function dispose(){root.removeFromParent();point.geometry.dispose();material.dispose();arrow.dispose();modules.clear();readings.clear();}
 return {group:parent,modules,getModule,getWorldPose,select,pick,setReading,getReading:id=>{getModule(id);return structuredClone(readings.get(id)??null);},getSelected:()=>selected,dispose};
}
