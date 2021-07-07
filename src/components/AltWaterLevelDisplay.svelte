<script>
    import { onMount } from 'svelte';

    import * as THREE from 'three';
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
    import { Water } from 'three/examples/jsm/objects/Water.js';
    import { Sky } from 'three/examples/jsm/objects/Sky.js';

    let container;
    let canvas;
    let camera, scene, renderer;
    let controls, water, sun, mesh;

    let width;
    let height;

    // Colors
    const black = new THREE.Color('black');
    const white = new THREE.Color('white');

    onMount(() => {

        function loadFile(filename) {
            return new Promise((resolve, reject) => {
                const loader = new THREE.FileLoader();

                loader.load(filename, (data) => {
                    resolve(data);
                });
            });
        }

        // Shader chunks
        loadFile('shaders/utils.glsl').then((utils) => {
            THREE.ShaderChunk['utils'] = utils;

            // Create Renderer
            const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100);
            camera.position.set(0, 0.3, 3.4);
            // camera.rotation.set(2.828, 0.191, 3.108);

            const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
            renderer.setClearColor( white, 0 );
            renderer.setSize(width, height);
            renderer.autoClear = false;

            // Light direction
            const light = [0.7559289460184544, 0.7559289460184544, -0.3779644730092272];

            // Create mouse Controls
            const controls = new OrbitControls(
                camera,
                canvas
            );

            // Ray caster
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            const targetgeometry = new THREE.PlaneGeometry(2, 2);
            for (let vertex of targetgeometry.vertices) {
                vertex.z = - vertex.y;
                vertex.y = 0.;
            }
            const targetmesh = new THREE.Mesh(targetgeometry);

            // Textures
            const cubetextureloader = new THREE.CubeTextureLoader();

            const textureCube = cubetextureloader.load([
                'textures/xpos.jpg', 'textures/xneg.jpg',
                'textures/ypos.jpg', 'textures/ypos.jpg',
                'textures/zpos.jpg', 'textures/zneg.jpg',
            ]);

            const textureloader = new THREE.TextureLoader();
            const tiles = textureloader.load('textures/stone_square.jpg');

            class WaterSimulation {
                constructor() {
                this._camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 2000);

                this._geometry = new THREE.PlaneBufferGeometry(2, 2);

                this._textureA = new THREE.WebGLRenderTarget(256, 256, {type: THREE.FloatType});
                this._textureB = new THREE.WebGLRenderTarget(256, 256, {type: THREE.FloatType});
                this.texture = this._textureA;

                const shadersPromises = [
                    loadFile('shaders/simulation/vertex.glsl'),
                    loadFile('shaders/simulation/drop_fragment.glsl'),
                    loadFile('shaders/simulation/normal_fragment.glsl'),
                    loadFile('shaders/simulation/update_fragment.glsl'),
                ];

                this.loaded = Promise.all(shadersPromises)
                    .then(([vertexShader, dropFragmentShader, normalFragmentShader, updateFragmentShader]) => {
                    const dropMaterial = new THREE.RawShaderMaterial({
                    uniforms: {
                        center: { value: [0, 0] },
                        radius: { value: 0 },
                        strength: { value: 0 },
                        texture: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: dropFragmentShader,
                    });

                    const normalMaterial = new THREE.RawShaderMaterial({
                    uniforms: {
                        delta: { value: [1 / 256, 1 / 256] },  // TODO: Remove this useless uniform and hardcode it in shaders?
                        texture: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: normalFragmentShader,
                    });

                    const updateMaterial = new THREE.RawShaderMaterial({
                    uniforms: {
                        delta: { value: [1 / 256, 1 / 256] },  // TODO: Remove this useless uniform and hardcode it in shaders?
                        texture: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: updateFragmentShader,
                    });

                    this._dropMesh = new THREE.Mesh(this._geometry, dropMaterial);
                    this._normalMesh = new THREE.Mesh(this._geometry, normalMaterial);
                    this._updateMesh = new THREE.Mesh(this._geometry, updateMaterial);
                });
                }

                // Add a drop of water at the (x, y) coordinate (in the range [-1, 1])
                addDrop(renderer, x, y, radius, strength) {
                    this._dropMesh.material.uniforms['center'].value = [x, y];
                    this._dropMesh.material.uniforms['radius'].value = radius;
                    this._dropMesh.material.uniforms['strength'].value = strength;

                    this._render(renderer, this._dropMesh);
                }

                stepSimulation(renderer) {
                    this._render(renderer, this._updateMesh);
                }

                updateNormals(renderer) {
                    this._render(renderer, this._normalMesh);
                }

                _render(renderer, mesh) {
                    // Swap textures
                    const oldTexture = this.texture;
                    const newTexture = this.texture === this._textureA ? this._textureB : this._textureA;

                    mesh.material.uniforms['texture'].value = oldTexture.texture;

                    renderer.setRenderTarget(newTexture);

                    // TODO Camera is useless here, what should be done?
                    renderer.render(mesh, this._camera);

                    this.texture = newTexture;
                }

            }

            class Caustics {
                constructor(lightFrontGeometry) {
                this._camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 2000);

                this._geometry = lightFrontGeometry;

                this.texture = new THREE.WebGLRenderTarget(1024, 1024, {type: THREE.UNSIGNED_BYTE});

                const shadersPromises = [
                    loadFile('shaders/caustics/vertex.glsl'),
                    loadFile('shaders/caustics/fragment.glsl')
                ];

                this.loaded = Promise.all(shadersPromises)
                    .then(([vertexShader, fragmentShader]) => {
                    const material = new THREE.RawShaderMaterial({
                    uniforms: {
                        light: { value: light },
                        water: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    });

                    this._causticMesh = new THREE.Mesh(this._geometry, material);
                });
                }

                update(renderer, waterTexture) {
                    this._causticMesh.material.uniforms['water'].value = waterTexture;

                    renderer.setRenderTarget(this.texture);
                    renderer.setClearColor(black, 0);
                    renderer.clear();

                    // TODO Camera is useless here, what should be done?
                    renderer.render(this._causticMesh, this._camera);
                }

            }

            class Walls {
                constructor() {
                    this.material = new THREE.MeshBasicMaterial( { map: tiles } );
                    
                    this.backGeometry = new THREE.BoxGeometry(2.04, 2.04, 0.2);
                    this.back = new THREE.Mesh(this.backGeometry, this.material);
                    this.back.geometry.vertices.forEach( d => { d.z = -1.02 });
                    this.back.verticesNeedUpdate = true;

                    this.leftGeometry = new THREE.BoxGeometry(0.2, 2.04, 2.04);
                    this.left = new THREE.Mesh(this.leftGeometry, this.material);
                    this.left.geometry.vertices.forEach( d => { d.x = -1.02 });
                    this.left.verticesNeedUpdate = true;

                    this.rightGeometry = new THREE.BoxGeometry(0.2, 2.04, 2.04);
                    this.right = new THREE.Mesh(this.rightGeometry, this.material);
                    this.right.geometry.vertices.forEach( d => { d.x = 1.02 });
                    this.right.verticesNeedUpdate = true;

                    this.bottomGeometry = new THREE.BoxGeometry(2.04, 0.2, 2.04);
                    this.bottom = new THREE.Mesh(this.bottomGeometry, this.material);
                    this.bottom.geometry.vertices.forEach( d => { d.y = -1.02 });
                    this.bottom.verticesNeedUpdate = true;

                    this.sides = [ this.back, this.left, this.right, this.bottom ];
                }

                draw(renderer) {
                    this.sides.forEach(side => {
                        // side.position.needsUpdate = true;
                        renderer.render(side, camera);
                    })
                    // renderer.render(this.back, camera);
                }


            }

            class Water {

                constructor() {
                        this.geometry = new THREE.PlaneGeometry(2, 2, 200, 200);

                        const shadersPromises = [
                            loadFile('shaders/water/vertex.glsl'),
                            loadFile('shaders/water/fragment.glsl')
                        ];

                        this.loaded = Promise.all(shadersPromises)
                            .then(([vertexShader, fragmentShader]) => {
                            this.material = new THREE.RawShaderMaterial({
                            uniforms: {
                                light: { value: light },
                                tiles: { value: tiles },
                                sky: { value: textureCube },
                                water: { value: null },
                                causticTex: { value: null },
                                underwater: { value: false },
                            },
                            vertexShader: vertexShader,
                            fragmentShader: fragmentShader,
                            });

                            this.mesh = new THREE.Mesh(this.geometry, this.material);
                        });
                }

                adjustYPositionShaders(yOffset) {
                    const roundedOffset = -yOffset.toFixed(3);
                    this.mesh.material.vertexShader = this.mesh.material.vertexShader.replace(/pos.y \+= info\.r.*;/, `pos.y += info.r - ${roundedOffset};`);
                    // console.log(this.material.vertexShader);
                }

                adjustYPositionVertices(yPosition) {
                    this.mesh.geometry.vertices.forEach(d => { d.z = yPosition });
                    this.mesh.geometry.verticesNeedUpdate = true;
                }

                draw(renderer, waterTexture, causticsTexture) {

                    this.material.uniforms['water'].value = waterTexture;
                    this.material.uniforms['causticTex'].value = causticsTexture;

                    this.material.side = THREE.FrontSide;
                    this.material.uniforms['underwater'].value = true;
                    renderer.render(this.mesh, camera);

                    this.material.side = THREE.BackSide;
                    this.material.uniforms['underwater'].value = false;
                    renderer.render(this.mesh, camera);
                }

            }

            class Pool {

                constructor() {
                this._geometry = new THREE.BoxGeometry(2, 2, 2);

                const shadersPromises = [
                    loadFile('shaders/pool/vertex.glsl'),
                    loadFile('shaders/pool/fragment.glsl')
                ];

                this.loaded = Promise.all(shadersPromises)
                    .then(([vertexShader, fragmentShader]) => {
                    this._material = new THREE.RawShaderMaterial({
                    uniforms: {
                        light: { value: light },
                        tiles: { value: tiles },
                        water: { value: null },
                        causticTex: { value: null },
                    },
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    });
                    this._material.side = THREE.FrontSide;

                    this._mesh = new THREE.Mesh(this._geometry, this._material);
                });
                }

                setHeight(targetHeight) {
                    const difference = this._geometry.parameters.height - targetHeight;
                    // console.log(difference);
                    this._geometry = new THREE.BoxGeometry(2, targetHeight, 2);
                    // console.log(this._geometry.vertices[1].y, difference);
                    this._geometry.vertices.forEach( d => { d.y += 2-targetHeight; });
                    // console.log(this._geometry.vertices[1].y);
                    this._geometry.verticesNeedUpdate = true;

                    // this._geometry.parameters.height = targetHeight;
                    // // console.log(this._geometry.parameters.height);
                    // this._mesh.scale.y = 0.7;
                }

                draw(renderer, waterTexture, causticsTexture) {
                    this._material.uniforms['water'].value = waterTexture;
                    this._material.uniforms['causticTex'].value = causticsTexture;

                    this._mesh = new THREE.Mesh(this._geometry, this._material);
                    renderer.render(this._mesh, camera);
                }

            }

            const waterSimulation = new WaterSimulation();
            const water = new Water();
            const caustics = new Caustics(water.geometry);
            const pool = new Pool();
            const walls = new Walls();

            const start = new Date();

            // Main rendering loop
            function animate() {
                waterSimulation.stepSimulation(renderer);
                waterSimulation.updateNormals(renderer);

                const waterTexture = waterSimulation.texture.texture;

                // console.log(waterTexture);

                caustics.update(renderer, waterTexture);

                const causticsTexture = caustics.texture.texture;

                renderer.setRenderTarget(null);
                renderer.setClearColor( white, 0 );
                renderer.clear();

                // Decrease Height
                const tick = new Date() - start;
                // pool.setHeight(2-(tick/10000))
                // water.adjustYPositionVertices(-(tick/40000))
                
                // water.adjustYPosition(-0.99);

                water.draw(renderer, waterTexture, causticsTexture);
                pool.draw(renderer, waterTexture, causticsTexture);
                walls.draw(renderer);

                controls.update();

                window.requestAnimationFrame(animate);
            }

            function onMouseMove(event) {
                const rect = canvas.getBoundingClientRect();

                mouse.x = (event.clientX - rect.left) * 2 / width - 1;
                mouse.y = - (event.clientY - rect.top) * 2 / height + 1;

                raycaster.setFromCamera(mouse, camera);

                const intersects = raycaster.intersectObject(targetmesh);

                // for (let intersect of intersects) {
                //   waterSimulation.addDrop(renderer, intersect.point.x, intersect.point.z, 0.03, 0.04);
                // }
            }

            const loaded = [waterSimulation.loaded, caustics.loaded, water.loaded, pool.loaded];

            Promise.all(loaded).then(() => {
                canvas.addEventListener('mousemove', { handleEvent: onMouseMove });

                for (var i = 0; i < 4; i++) {
                    waterSimulation.addDrop(
                        renderer,
                        Math.random() * 2 - 1, Math.random() * 2 - 1,
                        0.03, (i & 1) ? 0.02 : -0.02
                    );
                }

                animate();
            });
        });
    })

</script>

<style>
    div {
        position: absolute;
        z-index: 100;

        bottom: 2rem;
        left: 2rem;
        /* transform: translate(0%, -50%); */

        height: 15rem;
        width: 15rem;
    }

    div:focus, canvas:focus {
        outline:0;
    }

    @media only screen and (max-width: 600px) {
		div {
			display: none;
		}
	}
</style>

<!-- <svelte:window on:keydown={handleKeydown}/> -->
<div bind:this={container} bind:clientWidth={width} bind:clientHeight={height}>
    <canvas bind:this={canvas} />
</div>