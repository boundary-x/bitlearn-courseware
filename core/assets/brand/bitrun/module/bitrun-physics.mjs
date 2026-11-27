/** Bitrun cam-drive approximation. SI units. Requires cannon-es 0.20.0.
 * CAD supplies shaft spacing, shaft height and eccentricity; masses, friction,
 * torque are provisional. The upper notch is constrained by the fixed shaft.
 * No body position is animated after creation: joint motors drive the system.
 */
export function createBitrunPhysics(C,{supported=false,rpm=20,torque=.04,friction=.8}={}){
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});
 world.solver.iterations=100;world.solver.tolerance=1e-9;
 const contact=new C.Material('robot'),floor=new C.Material('floor');
 world.addContactMaterial(new C.ContactMaterial(contact,floor,{friction,restitution:0,contactEquationStiffness:1e7,contactEquationRelaxation:4}));
 const ground=new C.Body({mass:0,material:floor,shape:new C.Plane(),collisionFilterGroup:1,collisionFilterMask:2});ground.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(ground);
 const chassis=new C.Body({mass:supported?0:.18,material:contact,position:new C.Vec3(0,supported?.067803:.047803,0),linearDamping:.03,angularDamping:.04,collisionFilterGroup:2,collisionFilterMask:1});
 chassis.addShape(new C.Box(new C.Vec3(.073,.022,.018)),new C.Vec3(0,.012,0));world.addBody(chassis);
 const motors=[],feet=[],joints=[];const eccentricity=.003512105;
 // CAD: notch width 7.6 mm, usable straight notch y=64.061..84.606;
 // shaft 2 is the 5x5 mm crossbar at world y=73.682, z=71.0036.
 const slot={halfWidth:.0038,min:.0262579,max:.0468029,shaftHalf:.0025};
 class SlotGuide extends C.Constraint{
  constructor(frame,foot,anchor){super(frame,foot,{collideConnected:false});this.anchor=anchor;this.equations=[new C.ContactEquation(frame,foot,100),new C.ContactEquation(frame,foot,100)];this.equations.forEach(eq=>eq.setSpookParams(1e9,2,1/480));this.last={};}
  update(){const a=this.bodyA,b=this.bodyB,p=a.pointToWorldFrame(this.anchor),q=b.pointToLocalFrame(p),relative=a.quaternion.inverse().mult(b.quaternion);const angle=2*Math.atan2(relative.x,relative.w);const support=slot.shaftHalf*(Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle)));const zLimit=Math.max(0,slot.halfWidth-support),lo=slot.min+support,hi=slot.max-support;const edges=[{axis:'z',value:Math.max(-zLimit,Math.min(zLimit,q.z))},{axis:'y',value:Math.max(lo,Math.min(hi,q.y))}];edges.forEach(({axis,value},i)=>{const eq=this.equations[i],delta=q[axis]-value;eq.enabled=Math.abs(delta)>1e-7;const normal=new C.Vec3();normal[axis]=delta>=0?1:-1;b.vectorToWorldFrame(normal,eq.ni);p.vsub(a.position,eq.ri);const local=q.clone();local[axis]=value;b.pointToWorldFrame(local).vsub(b.position,eq.rj);});this.last={alongMm:q.y*1000,lateralMm:q.z*1000,clearanceMm:zLimit*1000,violationMm:Math.max(0,Math.abs(q.z)-zLimit,lo-q.y,q.y-hi)*1000};}
 }
 for(const [index,side]of [-1,1].entries()){
  const x=side*.077;
  const rotor=new C.Body({mass:.006,position:new C.Vec3(x,chassis.position.y,0),collisionFilterMask:0,angularDamping:.005});rotor.addShape(new C.Sphere(.008));world.addBody(rotor);
  const hinge=new C.HingeConstraint(chassis,rotor,{pivotA:new C.Vec3(x,0,0),pivotB:new C.Vec3(),axisA:new C.Vec3(1,0,0),axisB:new C.Vec3(1,0,0),collideConnected:false,maxForce:100});hinge.enableMotor();hinge.setMotorMaxForce(torque);world.addConstraint(hinge);joints.push(hinge);
  motors.push({id:index===0?'servo.right':'servo.left',rotor,hinge,rpm,shaftLocal:[x,0,0]});
  for(const [j,sign]of [-1,1].entries()){
   const px=index===0?[-.0748751,-.0808751][j]:[.0754862,.0814862][j];
   const center=new C.Vec3(px,chassis.position.y,sign*eccentricity);
   const foot=new C.Body({mass:.012,material:contact,position:center,linearDamping:.01,angularDamping:.03,collisionFilterGroup:2,collisionFilterMask:1});
   // Broad contact along the original foot plate's lower edge; 2 mm plate width.
   foot.addShape(new C.Box(new C.Vec3(.001,.002,.028)),new C.Vec3(0,-.035803,0));world.addBody(foot);
   const anchor=new C.Vec3(px,.0332005,.011553);
   const initialAngle=Math.atan2(anchor.z-center.z,anchor.y);foot.quaternion.setFromAxisAngle(new C.Vec3(1,0,0),initialAngle);
   const pin=new C.HingeConstraint(rotor,foot,{pivotA:new C.Vec3(center.x-x,0,sign*eccentricity),pivotB:new C.Vec3(),axisA:new C.Vec3(1,0,0),axisB:new C.Vec3(1,0,0),collideConnected:false,maxForce:100});world.addConstraint(pin);joints.push(pin);
   const guide=new SlotGuide(chassis,foot,anchor);world.addConstraint(guide);joints.push(guide);
   feet.push({id:`${index===0?'left':'right'}.${j}`,body:foot,motor:index,sign,centerLocal:[center.x,0,center.z],pin,guide});
  }
 }
 let time=0;
 const initial=world.bodies.map(body=>({body,p:body.position.clone(),q:body.quaternion.clone()}));
 function setRPM(left,right=left){for(const [i,n]of [right,left].entries()){if(!Number.isFinite(n)||Math.abs(n)>120)throw new RangeError('RPM must be between -120 and 120');motors[i].rpm=n;motors[i].hinge.setMotorSpeed(-n*Math.PI/30);}}
 function setMotion(mode,speed=20){if(!Number.isFinite(speed)||Math.abs(speed)>120)throw new RangeError('Invalid speed');const n=Math.abs(speed);if(mode==='left')setRPM(-n,n);else if(mode==='right')setRPM(n,-n);else if(mode==='straight')setRPM(speed,speed);else throw new RangeError('Unknown motion');}
 setRPM(rpm);
 function step(dt=1/240){if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw new RangeError('Use a fixed step <= 1/30 s');const substeps=Math.max(1,Math.ceil(dt*480));for(let i=0;i<substeps;i++)world.step(dt/substeps);time+=dt;}
 function reset(){for(const s of initial){s.body.position.copy(s.p);s.body.quaternion.copy(s.q);s.body.velocity.setZero();s.body.angularVelocity.setZero();s.body.force.setZero();s.body.torque.setZero();s.body.aabbNeedsUpdate=true;s.body.wakeUp();}time=0;}
 function diagnostics(){let jointError=0;for(const f of feet){const a=f.pin.bodyA.pointToWorldFrame(f.pin.pivotA),b=f.pin.bodyB.pointToWorldFrame(f.pin.pivotB);jointError=Math.max(jointError,a.distanceTo(b));f.guide.update();}return {time,jointErrorMm:jointError*1000,slotViolationMm:Math.max(...feet.map(f=>f.guide.last.violationMm)),slots:feet.map(f=>f.guide.last),contacts:world.contacts.length,position:chassis.position.toArray(),rpm:motors.map(m=>m.rpm)};}
 return {forward:[0,0,1],world,chassis,motors,feet,joints,eccentricity,step,setRPM,setMotion,reset,diagnostics};
}




