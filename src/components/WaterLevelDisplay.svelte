<script>
    import { onMount } from 'svelte';

    import * as THREE from 'three';
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
    import HelvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json';
    import * as d3 from 'd3';

    export let currentFlowrate;
    export let maxFlowrate;

    let container;
    let canvas;
    let camera, scene, renderer;
    let controls, water, sun, mesh;

    let width;
    let height;

    let tickCount = 0;

    // Colors
    const black = new THREE.Color('black');
    const white = new THREE.Color('white');

    const loadFile = (filename) => {
        return new Promise((resolve, reject) => {
            const loader = new THREE.FileLoader();

            loader.load(filename, (data) => {
                resolve(data);
            });
        });
    }

    onMount( async () => {

        const utils = await loadFile('shaders/utils.glsl');

        // const fontLoader = new THREE.FontLoader();
        // const font = await fontLoader.parse( HelvetikerFont );
        // const textGeometry = new THREE.TextGeometry( 'Hello three.js!', {
        //     font,
            // size: 10,
            // height: 10,
            // curveSegments: 12,
            // bevelEnabled: true,
            // bevelThickness: 2,
            // bevelSize: 2,
            // bevelOffset: 0,
            // bevelSegments: 5
        // });
        // const textMaterial = new THREE.MeshBasicMaterial( { color: white } );
        // const text = new THREE.Mesh( textGeometry, textMaterial );

        // Shader chunks
        THREE.ShaderChunk['utils'] = utils;

        // Create Renderer
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 400);
        camera.position.set(0, 0.5, 3.4);

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setClearColor( white, 0 );
        renderer.setSize(width, height);
        renderer.autoClear = false;

        // Light direction
        const light = [0.25, 0.75, -0.20];

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
        const tiles = textureloader.load('textures/plastic.jpg');

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
                    renderer.render(side, camera);
                })
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
                // THREE.ShaderChunk['utils'] = THREE.ShaderChunk['utils'].replace(/const float poolHeight = \d*.\d;/, `const float poolHeight = ${(targetHeight / 2).toFixed(1)};`);
                
                this._geometry = new THREE.BoxGeometry(2, targetHeight, 2);
                this._geometry.vertices.forEach( d => { d.y += ((2 - targetHeight) / 2); });
                this._geometry.verticesNeedUpdate = true;
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
        const animate = () => {
            const tick = new Date() - start;
            tickCount += 1

            if (tickCount % 300 === 0) {
                waterSimulation.addDrop(
                    renderer,
                    Math.random() * 2 - 1, Math.random() * 2 - 1,
                    0.03, 0.02
                );
            }

            waterSimulation.stepSimulation(renderer);
            waterSimulation.updateNormals(renderer);

            const waterTexture = waterSimulation.texture.texture;

            caustics.update(renderer, waterTexture);
            const causticsTexture = caustics.texture.texture;

            renderer.setRenderTarget(null);
            renderer.setClearColor( white, 0 );
            renderer.clear();

            // Decrease Height
            // water.adjustYPositionVertices(1 - (tick / 20000));
            // pool.setHeight(4 - (tick / 10000));
            
            water.adjustYPositionVertices((currentFlowrate / (maxFlowrate / 2)) - 1);
            pool.setHeight(4 * (currentFlowrate / maxFlowrate));

            water.draw(renderer, waterTexture, causticsTexture);
            pool.draw(renderer, waterTexture, causticsTexture);
            walls.draw(renderer);

            // renderer.render(text, camera);

            controls.update();

            window.requestAnimationFrame(animate);
        }

        const onMouseMove = (event) => {
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

        Promise.all(loaded).then( () => {
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

    })

</script>

<style>
    .container {
        position: absolute;
        z-index: 100;

        bottom: 4rem;
        left: 2rem;

        height: 15rem;
        width: 15rem;
    }

    .current-flowrate {
        color: white;
        font-size: 0.8rem;
        text-align: center;
    }

    div:focus, canvas:focus {
        outline: 0;
    }

    @media only screen and (max-width: 600px) {
		div {
			display: none;
		}
	}
</style>

<!-- <svelte:window on:keydown={handleKeydown}/> -->
<div class="container" bind:this={container} bind:clientWidth={width} bind:clientHeight={height}>
    <canvas bind:this={canvas} />
    <div class="current-flowrate">Average Annual Flowrate: ~{d3.format(",")(currentFlowrate)} ft³/s</div>
</div>