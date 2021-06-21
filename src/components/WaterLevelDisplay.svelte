<script>
    import { onMount } from 'svelte';

    import * as THREE from 'three';
    import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
    import { Water } from 'three/examples/jsm/objects/Water.js';
    import { Sky } from 'three/examples/jsm/objects/Sky.js';

	// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.117.1/build/three.module.js';

    // import * as dat from 'dat.gui';
    // import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.117.1/examples/jsm/controls/OrbitControls.js";
    // import Stats from 'https://cdn.jsdelivr.net/npm/three@0.117.1/examples/jsm/libs/stats.module.js';
    // import { GUI } from 'https://cdn.jsdelivr.net/npm/three@0.117.1/examples/jsm/libs/dat.gui.module.js';
    // import { Water } from 'https://cdn.jsdelivr.net/npm/three@0.117.1/examples/jsm/objects/Water.js';
    // import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.117.1/examples/jsm/objects/Sky.js';

    let container;
    let camera, scene, renderer;
    let controls, water, sun, front, mesh;

    let width;
    let height;

    onMount(() => {

        init();
        animate();

        function init() {

            renderer = new THREE.WebGLRenderer();
            renderer.setPixelRatio( window.devicePixelRatio );
            renderer.setSize( width, height );
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            container.appendChild( renderer.domElement );

            //

            scene = new THREE.Scene();

            camera = new THREE.PerspectiveCamera( 55, width / height, 1, 20000 );
            camera.position.set( 0, 70, 150 );

            //

            sun = new THREE.Vector3();

            // Water

            // const waterGeometry = new THREE.PlaneGeometry( 50, 50 );
            const waterGeometry = new THREE.BoxGeometry( 50, 50, 50 );

            water = new Water(
                waterGeometry,
                {
                    textureWidth: 512,
                    textureHeight: 512,
                    waterNormals: new THREE.TextureLoader().load( 'textures/waternormals.jpg', ( texture ) => {
                        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    }),
                    sunDirection: new THREE.Vector3(),
                    sunColor: 0xffffff,
                    waterColor: 0x001e0f,
                    distortionScale: 5,
                    fog: scene.fog !== undefined
                }
            );

            water.rotation.x = - Math.PI / 2;
            water.position.set = new THREE.Vector3();

            scene.add( water );

            // front = new Water(
            //     waterGeometry,
            //     {
            //         textureWidth: 512,
            //         textureHeight: 512,
            //         waterNormals: new THREE.TextureLoader().load( 'textures/waternormals.jpg', function ( texture ) {
            //             texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            //         }),
            //         sunDirection: new THREE.Vector3(),
            //         sunColor: 0xffffff,
            //         waterColor: 0x001e0f,
            //         distortionScale: 5,
            //         fog: scene.fog !== undefined
            //     }
            // );

            // front.position.set = new THREE.Vector3();
            // front.position.y = -25;
            // scene.add( front );

            // Skybox

            const sky = new Sky();
            sky.scale.setScalar( 10000 );
            scene.add( sky );

            const skyUniforms = sky.material.uniforms;

            skyUniforms[ 'turbidity' ].value = 10;
            skyUniforms[ 'rayleigh' ].value = 2;
            skyUniforms[ 'mieCoefficient' ].value = 0.005;
            skyUniforms[ 'mieDirectionalG' ].value = 0.8;

            const parameters = {
                elevation: 7,
                azimuth: 135
            };

            const pmremGenerator = new THREE.PMREMGenerator( renderer );

            function updateSun() {

                const phi = THREE.MathUtils.degToRad( 90 - parameters.elevation );
                const theta = THREE.MathUtils.degToRad( parameters.azimuth );

                sun.setFromSphericalCoords( 1, phi, theta );

                sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
                water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();
                // front.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();


                scene.environment = pmremGenerator.fromScene( sky ).texture;
            }

            updateSun();

            //

            const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
            directionalLight.position.z = 400;
            directionalLight.position.y = 150;

            const ambientLight = new THREE.AmbientLight( 0xffffff );

            scene.add( directionalLight, ambientLight );

            // const geometry = new THREE.BoxGeometry( 50, 50, 50 );

            // const waterTexture = new THREE.TextureLoader().load( 'textures/waternormals.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; });
	        // const boxMaterial = new THREE.MeshBasicMaterial( { map: waterTexture } );

            // const material = new THREE.MeshPhongMaterial({
            //     color: 0x001e0f,
            //     opacity: 0.4,
            //     transparent: true,
            // });

            // mesh = new THREE.Mesh( geometry, boxMaterial );
            // scene.add( mesh );

            // mesh.position.x = 0;
            // mesh.position.y = -25.1;
            // mesh.position.z = 0;

            
            //

            controls = new OrbitControls( camera, renderer.domElement );
            controls.maxPolarAngle = Math.PI * 0.495;
            controls.target.set( 0, 0, 0 );
            controls.minDistance = 40.0;
            controls.maxDistance = 200.0;
            controls.update();
        }

        function animate() {
            requestAnimationFrame( animate );
            render();
        }

        function render() {
            const time = performance.now() * 0.001;

            water.material.uniforms[ 'time' ].value += 1.0 / 60.0;
            // front.material.uniforms[ 'time' ].value += 1.0 / 60.0;

            renderer.render( scene, camera );
        }
    })

    $: if (camera !== undefined && renderer !== undefined) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize( width, height );
    }

    const handleKeydown = (e) => {
        if (water && e.key === "d") {
            water.position.y -= 0.1;
        }
    }

</script>

<style>
    div {
        position: absolute;
        z-index: 100;

        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        height: 20rem;
        width: 20rem;
    }
</style>

<svelte:window on:keydown={handleKeydown}/>
<div bind:this={container} bind:clientWidth={width} bind:clientHeight={height}></div>