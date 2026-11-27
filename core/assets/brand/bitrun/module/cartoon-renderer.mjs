export function createCartoonRenderer(THREE, renderer, {outlinePx=0.78}={}) {
const target=new THREE.WebGLRenderTarget(1,1,{samples:0,type:THREE.HalfFloatType});
target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
const inkUniforms={image:{value:target.texture},depthImage:{value:target.depthTexture},depthRange:{value:1499},texel:{value:new THREE.Vector2(1,1)},thickness:{value:0.8},ink:{value:new THREE.Color(0x46443e)}};
const inkMaterial=new THREE.ShaderMaterial({
 uniforms:inkUniforms,transparent:true,depthTest:false,depthWrite:false,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
 fragmentShader:`uniform sampler2D image;uniform sampler2D depthImage;uniform float depthRange;uniform vec2 texel;uniform float thickness;uniform vec3 ink;varying vec2 vUv;
 void main(){vec4 center=texture2D(image,vUv);float mask=center.a;
 for(int i=0;i<16;i++){float a=float(i)*6.2831853/16.;vec2 d=vec2(cos(a),sin(a))*texel*thickness;mask=max(mask,texture2D(image,vUv+d).a);mask=max(mask,texture2D(image,vUv+d*.5).a);}
 float centerDepth=texture2D(depthImage,vUv).r*depthRange;float boundary=0.;
 // Depth discontinuities outline overlapping parts. A planar slope has zero
 // second derivative, so triangulation and flat face detail do not gain ink.
 for(int i=0;i<4;i++){
 float angle=float(i)*3.14159265/4.;vec2 stepUv=vec2(cos(angle),sin(angle))*texel*max(1.,thickness*.7);
 vec2 uvA=vUv+stepUv,uvB=vUv-stepUv;
 float a=texture2D(depthImage,uvA).r*depthRange,b=texture2D(depthImage,uvB).r*depthRange;
 float valid=step(.98,center.a)*step(.98,texture2D(image,uvA).a)*step(.98,texture2D(image,uvB).a);
 float jump=max(abs(a-centerDepth),abs(b-centerDepth));
 float curvature=abs(a+b-2.*centerDepth);
 boundary=max(boundary,valid*smoothstep(2.,4.,jump)*smoothstep(1.5,3.,curvature));
 }
 vec3 color=mix(ink,center.rgb,center.a);color=mix(color,ink,boundary*.66);gl_FragColor=vec4(color,mask);
 
 #include <colorspace_fragment>
 }`
});
const inkScene=new THREE.Scene();inkScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),inkMaterial));const inkCamera=new THREE.Camera();
// Fixed 0.8 CSS px: old widget state must not restore a thicker outline.
function renderCartoon(scene,camera,left,bottom,w,h){
 const ratio=renderer.getPixelRatio(),rw=Math.round(w*ratio),rh=Math.round(h*ratio);
 if(target.width!==rw||target.height!==rh){target.setSize(rw,rh);inkUniforms.texel.value.set(1/rw,1/rh);}
 const cssThickness=inkUniforms.thickness.value;inkUniforms.thickness.value=cssThickness*ratio;
 inkUniforms.depthRange.value=camera.far-camera.near;
 target.viewport.set(0,0,rw,rh);renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
 renderer.setRenderTarget(null);renderer.setViewport(left,bottom,w,h);renderer.setScissor(left,bottom,w,h);renderer.setScissorTest(true);renderer.render(inkScene,inkCamera);inkUniforms.thickness.value=cssThickness;
}

inkUniforms.thickness.value=outlinePx; return {render(scene,camera,{x=0,y=0,width,height}){if(width<=0||height<=0)return;renderCartoon(scene,camera,x,y,width,height);},dispose(){target.dispose();inkMaterial.dispose();inkScene.children[0].geometry.dispose();}};
}
