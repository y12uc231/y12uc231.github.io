import * as THREE from './vendor/three.module.min.js';
import { selectLandscape } from './loss-landscapes.js?v=c67791504d';

// An articulated character on an illustrative loss surface, with world-space foot contacts.
const host = document.querySelector('.loss-explorer');
const canvas = host?.querySelector('.loss-surface');
if (host && canvas) initialize();

function initialize() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true }); }
  catch { return; }
  const world = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5.7,5.7,2.8,-2.8,.1,40);
  camera.position.set(7,6.2,9); camera.lookAt(0,.48,0);
  renderer.setClearColor(0x000000,0);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  world.add(new THREE.HemisphereLight(0xf6fcff,0xa4b1a0,2.3));
  const sun=new THREE.DirectionalLight(0xfff3dc,3.0);
  sun.position.set(-3.5,8,5); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.5,far:18});
  sun.shadow.normalBias=.014; sun.shadow.bias=-.0001; sun.shadow.radius=3;
  world.add(sun);
  const fill=new THREE.DirectionalLight(0xd6efff,.8); fill.position.set(4,3,-4);world.add(fill);
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  const UP=V(0,1,0);
  const CHARACTER_SCALE=.76;
  const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
  const mix=THREE.MathUtils.lerp;
  // Brief acceleration, an unhurried steady stride, then a soft stop.
  function walkProgress(t,alreadyWalking=false) {
    const ramp=.13;
    const integral=x=>x**6-3*x**5+2.5*x**4;
    if(alreadyWalking) {
      if(t>1-ramp)return 1-ramp*integral((1-t)/ramp)/(1-ramp*.5);
      return t/(1-ramp*.5);
    }
    if(t<ramp)return ramp*integral(t/ramp)/(1-ramp);
    if(t>1-ramp)return 1-ramp*integral((1-t)/ramp)/(1-ramp);
    return (t-ramp*.5)/(1-ramp);
  }
  let landscapeStorage;
  try { landscapeStorage=localStorage; } catch {}
  const landscape=selectLandscape(landscapeStorage),heightAt=landscape.height;
  const normalAt=(x,z)=>V(-(heightAt(x+.01,z)-heightAt(x-.01,z))/.02,1,-(heightAt(x,z+.01)-heightAt(x,z-.01))/.02).normalize();
  const terrainGeometry=new THREE.PlaneGeometry(7.4,7.4,100,100);
  terrainGeometry.rotateX(-Math.PI/2);
  const positions=terrainGeometry.attributes.position;
  const colors=new Float32Array(positions.count*3);
  const low=new THREE.Color('#afcfdf'), high=new THREE.Color('#d4e2bd');
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getZ(i),y=heightAt(x,z);
    positions.setY(i,y);
    const color=low.clone().lerp(high,THREE.MathUtils.clamp((y-.02)/1.46,0,1));
    color.toArray(colors,i*3);
  }
  terrainGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  terrainGeometry.computeVertexNormals();
  const ground=new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0,side:THREE.DoubleSide}));
  ground.receiveShadow=true;world.add(ground);
  const gridPoints=[];
  for(let axis=0;axis<2;axis++)for(let i=0;i<=24;i++)for(let j=0;j<100;j++) {
    const a=-3.7+i*7.4/24,b=-3.7+j*7.4/100,c=-3.7+(j+1)*7.4/100;
    for(const m of [b,c]) {const x=axis?a:m,z=axis?m:a;gridPoints.push(x,heightAt(x,z)+.005,z);}
  }
  const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3));
  world.add(new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:0x58868e,transparent:true,opacity:.17,depthWrite:false})));

  const skin=new THREE.MeshStandardMaterial({color:0xd6a57d,roughness:.82});
  const shirt=new THREE.MeshStandardMaterial({color:0x607d92,roughness:.96});
  const trousers=new THREE.MeshStandardMaterial({color:0x364248,roughness:1});
  const shoes=new THREE.MeshStandardMaterial({color:0xeee9da,roughness:.9});
  const eyeMaterial=new THREE.MeshStandardMaterial({color:0x253329,roughness:.32});
  const coverMaterial=new THREE.MeshStandardMaterial({color:0x34756c,roughness:.85});
  const pageMaterial=new THREE.MeshStandardMaterial({color:0xfff6d7,roughness:.96});
  const sphere=new THREE.SphereGeometry(1,28,20);
  const cube=new THREE.BoxGeometry(1,1,1);
  const actor=new THREE.Group();actor.scale.setScalar(CHARACTER_SCALE);world.add(actor);
  function ellipsoid(parent,scale,material=skin) {
    const m=new THREE.Mesh(sphere,material);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function box(parent,scale,material) {
    const m=new THREE.Mesh(cube,material);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function profile(parent,rings,material,sides=24) {
    const vertices=[],indices=[];
    rings.forEach(([y,rx,rz,offset=0])=>{
      for(let j=0;j<=sides;j++) {const angle=j/sides*Math.PI*2;vertices.push(rx*Math.cos(angle),y,offset+rz*Math.sin(angle));}
    });
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++) {
      const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,b+1,a,b+1,a+1);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  // Adult proportions: long legs, a small jawed head, and tailored clothing.
  const torso=profile(actor,[[-.13,.080,.052],[-.11,.094,.055],[-.035,.091,.056,.005],[.07,.116,.060],[.107,.110,.055],[.132,.053,.032],[.138,.026,.027]],shirt);
  const pelvis=ellipsoid(actor,[.093,.065,.060],trousers);
  const neck=profile(actor,[[-.035,.029,.028],[.030,.023,.024]],skin);
  const seamMaterial=new THREE.MeshStandardMaterial({color:0x4d687d,roughness:1});
  const seam=box(torso,[.0025,.195,.002],seamMaterial);seam.position.set(0,-.025,.060);
  for(const y of [-.085,-.025,.035]) {const button=ellipsoid(torso,[.003,.003,.002],seamMaterial);button.position.set(0,y,.064);}
  const head=new THREE.Group();actor.add(head);
  profile(head,[[-.065,.019,.022,.010],[-.049,.037,.032,.006],[-.018,.048,.043,.003],[.012,.052,.047],[.041,.045,.041,-.003],[.061,.021,.023,-.003],[.065,.001,.001,-.003]],skin);
  function roundedFrame(path,w,h,r) {
    const x=w/2,y=h/2;
    path.moveTo(-x+r,-y);path.lineTo(x-r,-y);path.quadraticCurveTo(x,-y,x,-y+r);
    path.lineTo(x,y-r);path.quadraticCurveTo(x,y,x-r,y);
    path.lineTo(-x+r,y);path.quadraticCurveTo(-x,y,-x,y-r);
    path.lineTo(-x,-y+r);path.quadraticCurveTo(-x,-y,-x+r,-y);
    return path;
  }
  const frameShape=roundedFrame(new THREE.Shape(),.040,.025,.0035);
  frameShape.holes.push(roundedFrame(new THREE.Path(),.0345,.0195,.002));
  const frameGeometry=new THREE.ExtrudeGeometry(frameShape,{depth:.002,bevelEnabled:false,curveSegments:4});
  for(const side of [-1,1]) {
    const ear=ellipsoid(head,[.009,.015,.010]);ear.position.set(side*.051,-.009,-.003);
    const rim=new THREE.Mesh(frameGeometry,eyeMaterial);
    rim.position.set(side*.022,.006,.048);head.add(rim);
    const temple=box(head,[.0025,.0025,.041],eyeMaterial);temple.position.set(side*.041,.006,.029);
  }
  const bridge=box(head,[.010,.0025,.003],eyeMaterial);bridge.position.set(0,.009,.049);
  const nose=ellipsoid(head,[.007,.012,.012]);nose.position.set(0,-.009,.048);
  const smileMaterial=new THREE.MeshStandardMaterial({color:0x956a50,roughness:.9});
  const smilePath=new THREE.QuadraticBezierCurve3(V(-.009,-.035,.042),V(.001,-.038,.043),V(.012,-.032,.042));
  head.add(new THREE.Mesh(new THREE.TubeGeometry(smilePath,12,.0012,5,false),smileMaterial));
  const eyes=[-.019,.019].map(x=>{
    const e=ellipsoid(head,[.0038,.004,.002],eyeMaterial);e.position.set(x,.005,.045);return e;
  });
  // A continuous cloth surface bends around each joint instead of exposed ball joints.
  function clothedLimb(material,widths,hinged=false) {
    const ringCount=hinged?19:13,sides=12,joints=[V(),V(),V()];
    const curve=hinged?null:new THREE.CatmullRomCurve3(joints,false,'centripetal');
    const geometry=new THREE.BufferGeometry(),positions=new THREE.Float32BufferAttribute(new Float32Array(ringCount*(sides+1)*3),3),indices=[];
    geometry.setAttribute('position',positions);
    for(let i=0;i<ringCount-1;i++)for(let j=0;j<sides;j++) {const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,b+1,a,b+1,a+1);}
    geometry.setIndex(indices);
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;actor.add(mesh);
    return {joints,mesh,update(from,joint,to) {
      joints[0].copy(from);joints[1].copy(joint);joints[2].copy(to);
      const upper=joint.clone().sub(from).normalize(),lower=to.clone().sub(joint).normalize();
      const before=joint.clone().addScaledVector(upper,-.014),after=joint.clone().addScaledVector(lower,.014);
      for(let i=0;i<ringCount;i++) {
        const t=hinged?Math.max(0,i-2)/(ringCount-3):i/(ringCount-1);
        let center,tangent,cap=1;
        if(!hinged) {center=curve.getPoint(t);tangent=curve.getTangent(t).normalize();}
        else if(i<2) {center=from.clone().addScaledVector(upper,i===0?-.020:-.013);tangent=upper;cap=i===0?.025:.76;}
        else if(i<=8) {center=from.clone().lerp(before,(i-2)/6);tangent=upper;}
        else if(i>=12) {center=after.clone().lerp(to,(i-12)/6);tangent=lower;}
        else {
          // Only the fabric at the elbow flexes; both limb shafts stay straight.
          const bend=(i-8)/4;
          center=before.clone().multiplyScalar((1-bend)**2).addScaledVector(joint,2*bend*(1-bend)).addScaledVector(after,bend*bend);
          tangent=upper.clone().lerp(lower,bend).normalize();
        }
        let x=V(1,0,0).addScaledVector(tangent,-tangent.x);
        if(x.lengthSq()<.01)x=V(0,0,1).addScaledVector(tangent,-tangent.z);
        x.normalize();const z=x.clone().cross(tangent).normalize();
        const at=t*(widths.length-1),k=Math.min(widths.length-2,Math.floor(at)),radius=mix(widths[k],widths[k+1],at-k)*cap;
        for(let j=0;j<=sides;j++) {const angle=j/sides*Math.PI*2;const p=center.clone().addScaledVector(x,radius*Math.cos(angle)).addScaledVector(z,radius*.86*Math.sin(angle));positions.setXYZ(i*(sides+1)+j,p.x,p.y,p.z);}
      }
      positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    }};
  }
  function hand(side) {
    const group=new THREE.Group();actor.add(group);
    ellipsoid(group,[.016,.022,.009]);
    for(let i=0;i<4;i++) {const finger=ellipsoid(group,[.0038,.010,.0045]);finger.position.set((i-1.5)*.007,-.024,.002);}
    const thumb=ellipsoid(group,[.006,.012,.006]);thumb.position.set(-side*.016,-.004,.004);thumb.rotation.z=side*.45;
    return group;
  }
  function solveIK(from,to,l1,l2,pole) {
    const vector=to.clone().sub(from),distance=vector.length();
    const d=Math.min(l1+l2-.00001,Math.max(Math.abs(l1-l2)+.00001,distance));
    const axis=vector.normalize();
    const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
    const a=(l1*l1-l2*l2+d*d)/(2*d);
    const b=Math.sqrt(Math.max(0,l1*l1-a*a));
    return from.clone().addScaledVector(axis,a).addScaledVector(bend,b);
  }
  const legs=[-1,1].map(side=>({side,upperLength:.225,lowerLength:.220,shape:clothedLimb(trousers,[.042,.037,.030,.026,.022],true),foot:ellipsoid(actor,[.030,.027,.063],shoes)}));
  const arms=[-1,1].map(side=>({side,upperLength:.170,lowerLength:.165,shape:clothedLimb(shirt,[.031,.030,.026,.022,.0175],true),hand:hand(side)}));
  const book=new THREE.Group();actor.add(book);
  const ink=new THREE.MeshStandardMaterial({color:0x8c9d90,roughness:1});
  const bookSides=[-1,1].map(side=>{
    const hinge=new THREE.Group();book.add(hinge);
    const cover=box(hinge,[.102,.147,.012],coverMaterial);cover.position.set(side*.051,0,-.008);
    const pages=box(hinge,[.095,.134,.012],pageMaterial);pages.position.set(side*.049,0,.005);
    for(let line=0;line<8;line++) {
      const width=line===0?.041:line===7?.047:.069;
      const print=box(hinge,[width,line===0?.0024:.0014,.0006],ink);
      print.position.set(side*.049,.046-line*.0105,.0118);
    }
    return {hinge,side};
  });
  const turningPage=new THREE.Group();book.add(turningPage);
  const leaf=box(turningPage,[.094,.132,.0015],pageMaterial);leaf.position.x=.047;
  const spine=box(book,[.012,.15,.021],coverMaterial);
  spine.position.z=-.013;

  const aligned=(r,s)=>V((7*r+9*s)/Math.sqrt(130),0,(9*r-7*s)/Math.sqrt(130));
  // Start just behind a nearby crest, already walking around its edge.
  const anchors=[[-1.1,.02],[-1.1,-.9],[-.2,-2],[1.25,-2],[2.2,-.35],[1.6,.1],[2.2,1.4],[.6,2.3],[-.8,2.5],[-2.1,1.8],[-2.5,.6],[-1.1,1.1]].map(([r,s])=>aligned(r,s));
  if(landscape.id!=='original-interference') {
    // Prefer nearby low places with a clear view of the book when he stops.
    const towardCamera=V(7,0,9).normalize(),rise=5.72/Math.sqrt(130);
    function clearance(point) {
      const base=heightAt(point.x,point.z);
      let hiddenBy=0;
      for(let distance=.06;distance<3;distance+=.06) {
        const x=point.x+towardCamera.x*distance,z=point.z+towardCamera.z*distance;
        if(Math.max(Math.abs(x),Math.abs(z))>3.7)break;
        hiddenBy=Math.max(hiddenBy,heightAt(x,z)-base-rise*distance);
      }
      return hiddenBy;
    }
    for(let i=2;i<anchors.length-1;i++) {
      const nominal=anchors[i];
      let best=nominal,score=Infinity;
      for(const radius of [0,.2,.4,.6])for(let angle=0;angle<8;angle++) {
        const candidate=nominal.clone().add(V(Math.cos(angle*Math.PI/4)*radius,0,Math.sin(angle*Math.PI/4)*radius));
        if(Math.max(Math.abs(candidate.x),Math.abs(candidate.z))>3.1)continue;
        const hiddenBy=clearance(candidate);
        const cost=heightAt(candidate.x,candidate.z)+radius*.55+Math.max(0,hiddenBy-.20)*12;
        if(cost<score){best=candidate;score=cost;}
      }
      anchors[i]=best;
    }
  }
  const boundaries=[0,1,4,6,8,10,12];
  const routes=boundaries.slice(0,-1).map((start,i)=>{
    const path=new THREE.CurvePath();
    for(let j=start;j<boundaries[i+1];j++) {
      const n=anchors.length,a=anchors[j%n],b=anchors[(j+1)%n];
      const before=anchors[(j+n-1)%n],after=anchors[(j+2)%n];
      const outgoing=b.clone().sub(before).normalize().multiplyScalar(Math.min(a.distanceTo(before),a.distanceTo(b))*.28);
      const incoming=after.clone().sub(a).normalize().multiplyScalar(Math.min(b.distanceTo(a),b.distanceTo(after))*.28);
      path.add(new THREE.CubicBezierCurve3(a,a.clone().add(outgoing),b.clone().sub(incoming),b));
    }
    return path;
  });
  // Measure steps along the actual terrain, including its vertical rise and fall.
  const routeMaps=routes.map(route=>{
    const samples=[{u:0,d:0}];
    let previous=route.getPointAt(0),distance=0;
    previous.y=heightAt(previous.x,previous.z);
    for(let i=1;i<=400;i++) {
      const u=i/400,point=route.getPointAt(u);
      point.y=heightAt(point.x,point.z);distance+=point.distanceTo(previous);
      samples.push({u,d:distance});previous=point;
    }
    return samples;
  });
  const routeLengths=routeMaps.map(map=>map[map.length-1].d);
  const strides=routeLengths.map(l=>l/Math.ceil(l/(.20*CHARACTER_SCALE)));
  function routePoint(route,distance) {
    const map=routeMaps[route],target=THREE.MathUtils.clamp(distance,0,routeLengths[route]);
    let low=0,high=map.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(map[mid].d<target)low=mid;else high=mid;}
    const u=mix(map[low].u,map[high].u,(target-map[low].d)/(map[high].d-map[low].d));
    const point=routes[route].getPointAt(u),direction=routes[route].getTangentAt(u).normalize();
    point.y=heightAt(point.x,point.z);
    return {point,direction};
  }
  function contact(route,distance,side) {
    const {point,direction}=routePoint(route,distance);
    const normal=normalAt(point.x,point.z);
    const crossSlope=-(normal.x*direction.z-normal.z*direction.x)/normal.y;
    const width=.04*CHARACTER_SCALE/Math.sqrt(1+crossSlope*crossSlope);
    point.add(V(direction.z,0,-direction.x).multiplyScalar(side*width));
    point.y=heightAt(point.x,point.z)+.035*CHARACTER_SCALE;
    return {point,normal:normalAt(point.x,point.z),direction};
  }
  function walkingFoot(route,distance,side) {
    const stride=strides[route],phase=distance/stride+(side<0?0:.5),cycle=Math.floor(phase),p=phase-cycle;
    const start=(cycle-(side<0?0:.5))*stride;
    const a=contact(route,start===0?0:start+.31*stride,side);
    if(p<.62) return a;
    const b=contact(route,start+1.31*stride,side),t=(p-.62)/.38;
    const point=a.point.clone().lerp(b.point,smooth(t));
    point.y=heightAt(point.x,point.z)+.035*CHARACTER_SCALE+.043*CHARACTER_SCALE*Math.sin(Math.PI*t)**2;
    return {point,normal:a.normal.clone().lerp(b.normal,smooth(t)).normalize(),direction:a.direction.clone().lerp(b.direction,smooth(t)).normalize(),pitch:.13*Math.sin(Math.PI*2*t)};
  }
  const timetable=[];
  routes.forEach((route,i)=>{
    timetable.push({kind:'walk',duration:Math.max(4.8,routeLengths[i]/(.205*.20/.30)),route:i,alreadyWalking:i===0});
    if(i<routes.length-1)timetable.push({kind:'read',duration:10.8,place:i+1,route:i});
  });
  const total=timetable.reduce((sum,s)=>sum+s.duration,0);
  function phaseAt(time) {
    let t=time%total;
    for(const item of timetable) { if(t<item.duration)return {...item,t,f:t/item.duration};t-=item.duration; }
    return {...timetable[0],t:0,f:0};
  }
  function yawOf(direction) {return Math.atan2(direction.x,direction.z);}
  const cameraYaw=Math.atan2(7,9);
  const angleMix=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  const localWorld=(point,origin,yaw)=>point.clone().sub(origin).applyAxisAngle(UP,-yaw).divideScalar(CHARACTER_SCALE);
  function pose(time) {
    const state=phaseAt(time),moving=state.kind==='walk',reading=state.kind==='read';
    const settled=reading?smooth(state.t/.85)*(1-smooth((state.t-9.7)/1.1)):0;
    const bookOut=reading?smooth((state.t-.65)/1.25)*(1-smooth((state.t-8.2)/1.4)):0;
    const openBook=reading?smooth((state.t-1.5)/.75)*(1-smooth((state.t-7.8)/.7)):0;
    const discovery=reading?smooth((state.t-6.1)/.8)*(1-smooth((state.t-8.1)/.7)):0;
    let origin,heading,feet,gait=0,motion=0,aheadTurn=0,uphill=0;
    if(moving) {
      const d=walkProgress(state.f,state.alreadyWalking)*(routeLengths[state.route]+strides[state.route]*.5);
      const sample=routePoint(state.route,d);origin=sample.point;heading=yawOf(sample.direction);
      const normal=normalAt(origin.x,origin.z);
      const grade=-(normal.x*sample.direction.x+normal.z*sample.direction.z)/normal.y;
      uphill=smooth(grade/1.2);
      feet=legs.map(l=>walkingFoot(state.route,d,l.side));
      gait=d/strides[state.route]*Math.PI*2;
      motion=(state.alreadyWalking?1:smooth(state.t/.9))*(1-smooth((state.t-state.duration+1.1)/1.1));
      const ahead=routePoint(state.route,d+.32).direction;
      aheadTurn=THREE.MathUtils.clamp(angleMix(heading,yawOf(ahead),1)-heading,-.32,.32)*motion;
    } else {
      const route=state.route??0,d=reading?routeLengths[route]+strides[route]*.5:0;
      const sample=routePoint(route,d);origin=sample.point;
      heading=yawOf(sample.direction);
      feet=legs.map(l=>walkingFoot(route,d,l.side));
    }
    actor.position.copy(origin);actor.rotation.y=heading;
    const localFeet=feet.map(f=>localWorld(f.point,origin,heading));
    const weight=-.012*Math.sin(gait)*motion+.013*settled;
    const bob=.0025*(1+Math.cos(gait*2))*motion;
    const roll=.025*Math.sin(gait-.18)*motion;
    let hip=.470-bob;
    for(let i=0;i<2;i++) {
      const foot=localFeet[i],x=foot.x-(weight+legs[i].side*.064),z=foot.z;
      hip=Math.min(hip,foot.y+Math.sqrt(Math.max(.001,.440**2-x*x-z*z)));
    }
    const breath=(Math.sin(time*1.4)+.3*Math.sin(time*.73))*.0018;
    torso.position.set(weight,hip+.133+breath,.003);
    const chestTurn=reading?THREE.MathUtils.clamp(angleMix(heading,cameraYaw,1)-heading,-.20,.20)*settled:0;
    const chestLift=reading?smooth((state.t-6.35)/.8)*(1-smooth((state.t-8.15)/.7)):0;
    torso.rotation.set(.035+.055*openBook-.040*chestLift,chestTurn,-roll-.018*settled);
    pelvis.position.set(weight,hip,0);pelvis.rotation.z=roll*.5;
    neck.position.set(weight,hip+.289+breath,.007);
    head.rotation.set(.025+.76*openBook-.75*discovery,aheadTurn*.6+chestTurn+.10*discovery,-.008+.032*discovery+roll*.20);
    // Nod around the neck attachment, so the skull moves forward as the chin lowers.
    head.position.set(weight*.8,hip+.318+breath,.007).add(V(0,.047,.003).applyEuler(head.rotation));
    const blinkTime=time%24.6,blinkAt=[2.9,7.2,7.65,14.8,21.6];
    const closure=Math.max(...blinkAt.map(t=>Math.exp(-(((blinkTime-t)/.075)**2))));
    eyes.forEach(e=>e.scale.y=.004*(1-.94*closure));
    for(let i=0;i<2;i++) {
      const leg=legs[i],foot=localFeet[i],hipPoint=V(weight+leg.side*.064,hip,0);
      const knee=solveIK(hipPoint,foot,leg.upperLength,leg.lowerLength,V(0,0,1));
      leg.shape.update(hipPoint,knee,foot);
      leg.foot.position.copy(foot);
      const n=feet[i].normal.clone().applyAxisAngle(UP,-heading);
      const z=feet[i].direction.clone().applyAxisAngle(UP,-heading);z.addScaledVector(n,-z.dot(n)).normalize();
      const x=n.clone().cross(z).normalize();
      leg.foot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,n,z));
      leg.foot.rotateX(feet[i].pitch||0);
      leg.foot.position.addScaledVector(z,.026);
    }
    // The book follows the left hand out of the pocket, then opens for both hands.
    const pocket=V(weight-.086,hip+.025,.055),readingPosition=V(weight+.008,hip+.18,.175);
    book.position.copy(pocket).lerp(readingPosition,bookOut);
    book.rotation.set(mix(.04,-2.02,openBook),-.15*(1-bookOut),-.10*(1-bookOut));
    book.visible=bookOut>.008;
    const opening=mix(1.43,.20,openBook);
    bookSides.forEach(({hinge,side})=>hinge.rotation.y=-side*opening);
    const pageTurn=smooth((state.t-3.6)/1.15);
    turningPage.visible=reading&&state.t>3.6&&state.t<4.75;
    turningPage.rotation.y=-.2-pageTurn*(Math.PI-.4);
    for(const arm of arms) {
      const shoulder=V(arm.side*.107,.105,0).applyEuler(torso.rotation).add(torso.position);
      // Counter-swing against the stepping leg; uphill effort gently flexes the elbow.
      const armPhase=arm.side*Math.cos(gait);
      const swing=(.24+.06*uphill)*armPhase*motion;
      const elbowBend=.07+motion*(.09+.16*uphill+.05*Math.max(0,armPhase));
      const upper=V(arm.side*.025,-1,0).normalize().applyAxisAngle(V(1,0,0),-swing);
      const lower=upper.clone().applyAxisAngle(V(1,0,0),-elbowBend);
      const relaxed=shoulder.clone().addScaledVector(upper,arm.upperLength).addScaledVector(lower,arm.lowerLength);
      const holding=V(arm.side*mix(.018,.105,openBook),-.007,.018).applyEuler(book.rotation).add(book.position);
      if(arm.side>0&&reading) {
        const turning=smooth((state.t-3.35)/.35)*(1-smooth((state.t-4.65)/.45));
        const pageEdge=V(.076,.032,.012).applyEuler(turningPage.rotation).applyEuler(book.rotation).add(book.position);
        holding.lerp(pageEdge,turning);
      }
      const reach=reading?smooth((state.t-.25)/.5)*(1-smooth((state.t-9.6)/.75)):0;
      const grip=arm.side<0?Math.max(bookOut,reach):bookOut*openBook;
      const hand=relaxed.lerp(holding,grip);
      const readingPole=V(arm.side*.15,-1,.10).applyEuler(torso.rotation);
      const pole=V(0,0,-1).lerp(readingPole,arm.side<0?bookOut:grip);
      const elbow=solveIK(shoulder,hand,arm.upperLength,arm.lowerLength,pole);
      arm.shape.update(shoulder,elbow,hand);arm.hand.position.copy(hand);
      // Keep the wrist continuous with the forearm; the thumb points forward on a relaxed hand.
      const forearm=hand.clone().sub(elbow).normalize();
      const wristAlignment=new THREE.Quaternion().setFromUnitVectors(V(0,-1,0),forearm);
      const palmTurn=new THREE.Quaternion().setFromAxisAngle(UP,arm.side*mix(Math.PI/2,.28,grip));
      arm.hand.quaternion.copy(wristAlignment).multiply(palmTurn);
    }
  }
  const thought=host.querySelector('.explorer-thought');
  // A fictional inner monologue, not optimizer telemetry. Adam uses first/second moments:
  // https://arxiv.org/abs/1412.6980
  const thoughts={
    1:['Wait… what if I try a smaller step?','Read it again. There’s something here.'],
    2:['A tiny perturbation… then follow the gradient.','Steep here. Let the second moment scale the step.'],
    3:['Flat here. I wonder what’s over that ridge.','Maybe a little noise will help me explore.'],
    4:['Better loss… now, does it generalize?','Does this make the model more useful?'],
    5:['One more idea. One more experiment.','Still learning. Keep going.'],
  };
  let currentThought='';
  function thoughtAt(time,still=false) {
    const state=phaseAt(time);
    if(state.kind!=='read'||!thoughts[state.place])return null;
    const text=thoughts[state.place][Math.floor(time/total)%2];
    const start=3.8,end=9.6;
    const age=still?6:state.t;
    if(age<start||age>=end)return null;
    const fadeIn=smooth((age-start)/.75),vanish=smooth((age-(end-1.25))/1.25);
    return {text,opacity:Math.min(fadeIn,1-vanish),vanish};
  }
  function paintThought(storyTime) {
    const note=thoughtAt(storyTime,reduced.matches);
    if(!note){thought.hidden=true;currentThought='';return;}
    if(note.text!==currentThought){thought.textContent=note.text;currentThought=note.text;}
    thought.hidden=false;
    const anchor=head.getWorldPosition(V()).add(V(0,.36,0)).project(camera);
    const width=canvas.clientWidth,height=canvas.clientHeight;
    const half=Math.min(145,(width-28)/2);
    const x=THREE.MathUtils.clamp((anchor.x*.5+.5)*width,half+12,width-half-12);
    const y=Math.max(85,(-anchor.y*.5+.5)*height);
    thought.style.left=`${x}px`;thought.style.top=`${y}px`;
    thought.style.opacity=String(note.opacity);
    thought.style.setProperty('--thought-rise',`${-9*note.vanish}px`);
    thought.style.setProperty('--thought-blur',`${2.5*note.vanish}px`);
  }
  let elapsed=0,last=0,raf=0,lastDraw=0,visible=true,paused=false,readingThought=false;
  let hoveredThought=false,focusedThought=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const canRun=()=>!paused&&!readingThought&&!reduced.matches&&!document.hidden&&visible;
  function draw() {
    const stillTime=timetable[0].duration+6;
    const storyTime=reduced.matches?stillTime:elapsed;
    pose(storyTime);renderer.render(world,camera);paintThought(storyTime);

  }
  function tick(now) {
    raf=0;if(!canRun())return;
    elapsed+=last?Math.min(now-last,80)/1000:0;last=now;
    if(now-lastDraw>1000/40){draw();lastDraw=now;}
    raf=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(raf);raf=0;last=0;
    canvas.tabIndex=reduced.matches?-1:0;
    canvas.setAttribute('role',reduced.matches?'img':'button');
    canvas.setAttribute('aria-label',reduced.matches?'An explorer reading a book':paused?'Resume animation':'Pause animation');
    canvas.setAttribute('aria-pressed',String(paused));
    if(canRun())raf=requestAnimationFrame(tick);else draw();
  }
  function holdThought(){readingThought=hoveredThought||focusedThought;sync();}
  thought.addEventListener('pointerenter',()=>{hoveredThought=true;holdThought();});
  thought.addEventListener('pointerleave',()=>{hoveredThought=false;holdThought();});
  thought.addEventListener('focus',()=>{focusedThought=true;holdThought();});
  thought.addEventListener('blur',()=>{focusedThought=false;holdThought();});
  thought.addEventListener('keydown',event=>{if(event.key==='Escape'){hoveredThought=false;thought.blur();holdThought();}});
  function toggleMotion() {
    if(reduced.matches)return;
    document.dispatchEvent(new CustomEvent('sk-motion-change',{detail:{paused:!paused}}));
  }
  canvas.addEventListener('click',toggleMotion);
  canvas.addEventListener('keydown',event=>{
    if(event.key===' '||event.key==='Enter'){event.preventDefault();toggleMotion();}
  });
  document.addEventListener('sk-motion-change',event=>{paused=event.detail.paused;sync();});
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(host);
  new ResizeObserver(()=>{
    const width=canvas.clientWidth,height=canvas.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height,false);
    const aspect=width/height,viewHeight=Math.max(6.2,10.9/aspect);
    camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;
    camera.top=viewHeight/2+.75;camera.bottom=-viewHeight/2+.75;camera.updateProjectionMatrix();draw();
  }).observe(canvas);
  host.classList.add('world-ready');draw();sync();
}
