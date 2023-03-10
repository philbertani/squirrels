import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class GPU {
    renderer;  scene; camera; controls;
    pointMaterial; innerPointMaterial;
    mainLight; cameraLight;
    canvas = null;
    resized = false;
    controls = {};
    showShadows = 0;
    pointList = [];
  
    constructor(canvas) {

      this.canvas = canvas
      this.label01 = document.getElementById("label01")
      this.label02 = document.getElementById("label02")

      window.addEventListener("resize",this.handleResize.bind(this),false )

      const canvasDim = canvas.getBoundingClientRect();
      const [width, height] = [canvasDim.width, canvasDim.height];
      this.width = width; this.height = height;

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      const renderer = this.renderer;

      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height, true);
      renderer.setClearColor("rgb(0,0,0)", 0);

      renderer.shadowMap.enabled = true;
      renderer.shadowMap.needsUpdate = true;
      renderer.shadowMap.type = THREE.PCFShadowMap; //THREE.VSMShadowMap;  //THREE.PCFSoftShadowMap //

      canvas.appendChild(renderer.domElement);
      this.canvas = canvas;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 3000);
      this.camera.position.z = 6;
  
      //this.controls = new THREE.
      this.controls = new OrbitControls(this.camera, renderer.domElement);
      this.controls.minDistance = -10000;
      this.controls.maxDistance = 10000;
      this.controls.zoomSpeed = 1;

      this.pointMaterial = new THREE.MeshPhongMaterial(
        { color: "rgb(180,150,50)", opacity: .4, transparent:true, blending: THREE.AdditiveBlending }
      )  
      this.innerPointMaterial = new THREE.MeshPhongMaterial({color:"rgb(100,0,255)", blending: THREE.AdditiveBlending})

      this.treeMaterial = new THREE.MeshPhongMaterial(
        { color: "rgb(255,255,200)" }
      )

      this.mainLight = new THREE.DirectionalLight(0xFFFFFF, .5)
      this.mainLight.position.set(0,0,5)
      this.setShadow(this.mainLight)
      this.scene.add(this.mainLight)

      this.cameraLight = new THREE.PointLight(0xFFFF00,.6)
      this.setShadow(this.cameraLight)
      this.camera.add(this.cameraLight)
      this.scene.add(this.camera)

      renderer.render(this.scene, this.camera)
    }
  
    handleResize() {
      console.log("resized")
      const canvasDim = canvas.getBoundingClientRect();
      const [width, height] = [canvasDim.width, canvasDim.height];
      this.width = width; this.height = height;

      //console.log(this)  don't forget to bind the GPU this context to callback functions
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
      this.renderer.setSize( width, height)

    }

    setShadow(light) {
      light.castShadow = true;
      light.shadow.mapSize.width = 2048;
      light.shadow.mapSize.height = 1024;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 1000;
    
      //have to set the range of the orthographic shadow camera
      //to cover the whole plane we are casting shadows onto
      //the shadows get fuzzier if these limits are much greater than the scene
      light.shadow.camera.left = -20;
      light.shadow.camera.bottom = -20;
      light.shadow.camera.right = 20;
      light.shadow.camera.top = 20;
    }

    createScene(coords, textReferencePoint) {
      const cylinderGeo = new THREE.CylinderGeometry(.002,.003,.2)
      const pointGeo = new THREE.SphereGeometry(.04)
      const innerPointGeo = new THREE.SphereGeometry(.015)
      const sc = 2.;
      const trans = 1.;
      for (let i=0; i<coords.length; i++) {
        const coord = coords[i]
        const point = new THREE.Mesh(pointGeo,this.pointMaterial)
        const innerPoint = new THREE.Mesh(innerPointGeo,this.innerPointMaterial)

        const tree = coord[2] > 0 ? 1  : 0
        //place the 2 views side by side by translating in -x direction
        point.position.set(coord[0]-sc*tree+trans,coord[1],2+coord[2])
        innerPoint.position.set(coord[0]-sc*tree+trans,coord[1],2+coord[2])
        
        point.castShadow = true;
        innerPoint.castShadow = true;
   
        this.pointList.push(point)

        if ( tree ) {
          const branch = new THREE.Mesh(cylinderGeo, this.treeMaterial)
          branch.position.set(coord[0]-sc*tree+trans,coord[1],2+coord[2])
          branch.rotateX(Math.PI/2)
          branch.castShadow = true
          branch.receiveShadow = true
          this.scene.add(branch)
        }

        this.scene.add(point)
        this.scene.add(innerPoint)

        //save the sphere that has the max Longitude so we can use it as reference
        //for displaying text that tracks the changes in view
        if (i === textReferencePoint[1][0]) this.textReferenceObject01 = point
        else if (i=== textReferencePoint[1][1]) this.textReferenceObject02 = point
      }

      const planeGeometry = new THREE.PlaneGeometry(8, 5, 1, 1);
      const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x005010, shininess:40 });
      this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
      this.plane.position.set(0, 0, -2);
      this.plane.receiveShadow = true;
      this.plane.visible = false;
      this.scene.add(this.plane);
      this.controls.shadowToggle = document.getElementById('shadowToggle')
      this.controls.shadowToggle.onclick = (ev)=>{this.showShadows ^= 1;}
      this.controls.transparentRadiusSlider = document.getElementById("transparentRadiusSlider")
      this.controls.transparentRadiusSlider.onchange = (ev)=>{
        //console.log("slider",ev.target.value)
        this.rescaleTransparentSpheres(ev.target.value)
      }

      this.renderer.render(this.scene,this.camera)
    }
  
    setText(textElem, object, text) {
      //we can make text follow ojbects by reversing some matrix transformations
      const tempV = new THREE.Vector3()
      //object.updateWorldMatrix(true,false) //actually do not need this - but why?
      object.getWorldPosition(tempV)  //get the World Position Vector
      tempV.project(this.camera)      //gets us to the NDC coords/Clip Space for the center of this object

      const textX = (tempV.x*.5+.5)*this.width;  // NDC to pixel coords in div
      const textY = (tempV.y*-.5+.5)*this.height + 50;  //CSS coords are opposite in Y direction

      textElem.style.position = "absolute"
      textElem.textContent = text
      textElem.style.color = "white"
      textElem.style.transform = `translate(-50%, -50%) translate(${textX}px,${textY}px)`;
    }

    rescaleTransparentSpheres(newScale) {
      const sc = Math.max(.5, newScale / 50);
      for (const point of this.pointList) {
        point.scale.set(sc,sc,sc)
      }
    }

    render() {
  
      let prevRenderTime = Date.now();
      const fps = 40;
      const fpsInterval = 1000 / fps;
      requestAnimationFrame(renderLoop.bind(this));
  
      function renderLoop(time) {
        requestAnimationFrame(renderLoop.bind(this));
  
        //throttle the fps because without it just maxes
        //out the GPU for no good reason, for example it will
        //redisplay the same scene at 240 fps on this computer
        const currentRenderTime = Date.now();
        const elapsed = currentRenderTime - prevRenderTime;
        if (elapsed < fpsInterval) return;
        prevRenderTime = currentRenderTime - (elapsed % fpsInterval);
        time *= 0.001; //convert from milliseconds to seconds
  
        this.setText(this.label01, this.textReferenceObject01, "Squirrels on Ground")
        this.setText(this.label02, this.textReferenceObject02, "Squirrels in Trees")

        this.plane.visible = this.showShadows === 1;  //turn shadow plane on and off

        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  export default GPU