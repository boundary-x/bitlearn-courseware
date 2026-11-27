export async function createBitrunModel(THREE,modelData,sim){
 const compressed=Uint8Array.from(atob(modelData.bytes),c=>c.charCodeAt(0));
 const raw=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 function decode(state,count,stride,positions=false){const out=positions?new Float32Array(count):new Uint32Array(count),last=new Int32Array(stride);for(let k=0;k<count;k++){let u=0,shift=0,b;do{if(state.offset>=raw.length)throw new Error('Truncated model');b=raw[state.offset++];u|=(b&127)<<shift;shift+=7;}while(b&128);last[k%stride]+=(u>>>1)^-(u&1);out[k]=positions?last[k%stride]/50:last[k%stride];}return out;}
 const geometries=new Map();
 for(const part of modelData.meta.parts){
  const vc=part.meshes.reduce((n,m)=>n+m.p/3,0),ic=part.meshes.reduce((n,m)=>n+m.i,0);
  const p=new Float32Array(vc*3),n=new Float32Array(vc*3),c=new Float32Array(vc*3),idx=vc<65536?new Uint16Array(ic):new Uint32Array(ic);let vo=0,io=0;
  for(const m of part.meshes){const state={offset:m.offset},pos=decode(state,m.p,3,true),indices=decode(state,m.i,1);const temporary=new THREE.BufferGeometry();temporary.setAttribute('position',new THREE.BufferAttribute(pos,3));temporary.setIndex(new THREE.BufferAttribute(indices,1));temporary.computeVertexNormals();p.set(pos,vo*3);n.set(temporary.attributes.normal.array,vo*3);const color=new THREE.Color().setRGB(...m.color.map(v=>v/255),THREE.SRGBColorSpace);
   for(let j=0;j<pos.length;j+=3){c[vo*3+j]=color.r;c[vo*3+j+1]=color.g;c[vo*3+j+2]=color.b;}for(let j=0;j<indices.length;j++)idx[io+j]=indices[j]+vo;vo+=pos.length/3;io+=indices.length;temporary.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeBoundingSphere();geometries.set(part.name,g);
 }
 const makeInkMaterial=(acrylic=false)=>new THREE.ShaderMaterial({
     vertexColors:true,side:acrylic?THREE.FrontSide:THREE.DoubleSide,transparent:acrylic,depthWrite:!acrylic,
     uniforms:{acrylic:{value:acrylic?1:0}},
     vertexShader:`varying vec3 pigment;varying vec3 surface;
      void main(){pigment=color;surface=normalMatrix*normal;
       gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
     fragmentShader:`uniform float acrylic;varying vec3 pigment;varying vec3 surface;
      void main(){
       vec3 n=normalize(surface)*(gl_FrontFacing?1.0:-1.0);
       vec3 base=pow(max(pigment,vec3(0.0)),vec3(1.0/2.2));
       float gray=dot(base,vec3(.2126,.7152,.0722));
       vec3 printColor=mix(vec3(gray),base,.83);
       printColor=.055+.90*pow(max(printColor,vec3(0.0)),vec3(.79));
       float light=dot(n,normalize(vec3(-.46,.81,.48)));
       float shade=.81+.19*smoothstep(-.55,.82,light);
       float rim=pow(1.-abs(n.z),2.);
       vec3 paint=mix(printColor*shade,vec3(.94,.95,.93)*shade,acrylic*.88);
       gl_FragColor=vec4(pow(paint,vec3(2.2)),mix(1.,.55+.26*rim,acrylic));
       #include <colorspace_fragment>
      }`
    });
 const material=makeInkMaterial();
 const acrylicMaterial=makeInkMaterial(true);

 const make=(name,center)=>{const group=new THREE.Group();group.name=name;for(const suffix of ['', '.acrylic']){const g=geometries.get(name+suffix);if(!g)continue;g.translate(-center[0],-center[1],-center[2]);const mesh=new THREE.Mesh(g,suffix?acrylicMaterial:material);mesh.name=name+suffix;group.add(mesh);}if(!group.children.length)throw Error('Missing CAD part '+name);return group;};
 // The micro:bit LED face points toward +Z: this is the robot's front.
 const bodyGeometry=geometries.get('body'),positions=bodyGeometry.attributes.position,colors=bodyGeometry.attributes.color;
 const unlit=new THREE.Color(0x351014);
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);if(Math.abs(x)<=8.6&&y>=57.2&&y<=74.9&&z>=14.8&&z<=15.5)colors.setXYZ(i,unlit.r,unlit.g,unlit.b);}
 colors.needsUpdate=true;
 const chassisVisual=make('body',[0,37.8031,0]);
 chassisVisual.userData.forward=[0,0,1];
 const tongue=['00000','01010','00000','10001','01110'];
 const ledRows=[73.8,69.91,66.3,62.3,58.3];
 const lit=tongue.join('').split('').filter(x=>x==='1').length;
 const matrix=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2,2.1),new THREE.MeshBasicMaterial({color:0xff3038,toneMapped:false}),lit);
 matrix.name='microbit.ledMatrix.smile';let ledIndex=0;const transform=new THREE.Matrix4();
 tongue.forEach((row,r)=>[...row].forEach((v,c)=>{if(v==='1'){transform.makeTranslation((c-2)*4,ledRows[r]-37.8031,15.5);matrix.setMatrixAt(ledIndex++,transform);}}));matrix.instanceMatrix.needsUpdate=true;chassisVisual.add(matrix);
 const footVisuals=sim.feet.map((f,i)=>make('foot.'+(i<2?'left':'right')+'.'+(i%2),[f.centerLocal[0]*1000,37.8031,i%2===0?-3.54371:3.4805]));
 const rotorVisuals=sim.motors.map((m,i)=>make('rotor.'+(i===0?'left':'right'),[m.shaftLocal[0]*1000,37.8031,0]));
 return {chassisVisual,footVisuals,rotorVisuals};
}

