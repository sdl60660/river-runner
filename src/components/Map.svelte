<script>
	import { onMount } from 'svelte';
	import { mapbox } from '../mapbox.js';
	import { tick } from 'svelte';

	import { bearingBetween, roundToDigits } from '../utils';
	import { coordinates, riverPath, currentLocation, vizState } from '../state';
	
	import Prompt from './Prompt.svelte';

	import along from '@turf/along';
	import { lineString } from '@turf/helpers';
	import lineDistance from '@turf/line-distance';
	import distance from '@turf/distance';
	import destination from '@turf/destination';


	export let bounds = [[-125, 24], [-66, 51]];
	export let basins;
	export let featureData = undefined;
	export let coordinateQuadtree = undefined;
	export let visibleIndex;
	export let mapStyle;
	export let addTopo;

	let container;
	let map;
	let mapBounds = bounds;

	onMount(async () => {
		await tick();

		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://unpkg.com/mapbox-gl/dist/mapbox-gl.css';

		link.onload = () => {
			map = new mapbox.Map({
				container,
				style: mapStyle || 'mapbox://styles/mapbox/light-v10',
				center: [0, 0],
				zoom: 9,
				// pitch: 85,
				// bearing: 80,
			});

			// map.scrollZoom.disable();
			map.fitBounds(bounds, { animate: false, padding: 30 });
			map.setMaxBounds(map.getBounds());
			mapBounds = map.getBounds();

			// console.log(mapBounds);

            map.on('load', () => {
				if (featureData) {
					addRivers({ map, featureData, lineWidth: 1 });
				}

				if (addTopo) {
					addTopoLayer({ map });
				}
            });

			map.on('click', async (e) => {
				if (map.interactive === false) {
					return;
				}
				map.interactive = false;

				currentLocation.update(() => e.lngLat );

				initRunner({ map, e });
			});
        };

		document.head.appendChild(link);

		return () => {
			map.remove();
			link.parentNode.removeChild(link);
		};
	});

	const initRunner = async ({ map, e }) => {
		const closestFeatureURL = `https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28${e.lngLat.lng}%20${e.lngLat.lat}%29`;
		const coordinateResponse = await fetch(closestFeatureURL)
		const closestFeature = (await coordinateResponse.json()).features[0];
		// catch {
		// 	map.interactive = true;
		// 	vizState.update(() => "uninitialized");
		// }
		
		const flowlinesURL = closestFeature.properties.navigation + '/DM/flowlines?f=json&distance=5000';
		const flowlinesResponse = await fetch(flowlinesURL);
		const flowlinesData = await flowlinesResponse.json();

		const river = flowlinesData.features[0];
		const originPoint = river.geometry.coordinates[0];

		console.log('Clicked on:', e.lngLat, 'Closest point:', originPoint);

		const coordinatePath = flowlinesData.features.map( feature => feature.geometry.coordinates.slice(-1)[0] );

		riverPath.update(() => [ { geometry: { coordinates: coordinatePath }} ]);
		currentLocation.update(() => originPoint );
		vizState.update(() => "calculating" );
		
		// Draw river lines from flowline features
		drawFlowPath({ map, featureData: [ { geometry: { coordinates: coordinatePath }}]});
		// drawFlowPath({ map, featureData: flowlinesData.features })

		const smoothedPath = pathSmoother(coordinatePath, Math.min(10, Math.floor(coordinatePath.length / 2)));
		const cameraTargetIndexGap = Math.min(Math.floor(smoothedPath.length / 2), 8);
		// const artificalCameraStartPoints = createArticialCameraPoints(smoothedPath, cameraTargetIndexGap);
		const artificalCameraStartPoints = pathSmoother(createArticialCameraPoints(coordinatePath, cameraTargetIndexGap), 1);
		
		const targetRoute = smoothedPath;
		const cameraRoute = artificalCameraStartPoints.concat(smoothedPath.slice(0, -cameraTargetIndexGap));
		
		// get the overall distance of each route so we can interpolate along them
		const routeDistance = pathDistance(targetRoute);
		const cameraRouteDistance = pathDistance(cameraRoute);
		const trueRouteDistance = pathDistance(coordinatePath);

		console.log('Distances:', routeDistance, cameraRouteDistance, trueRouteDistance);

		const initialBearing = bearingBetween( cameraRoute[0], targetRoute[0] );
		const cameraPitch = 70;

		const cameraBaseAltitude = 4200;
		const elevationArrayStep = 100;
		const elevations = await getElevations(coordinatePath, elevationArrayStep);
		const initialElevation = cameraBaseAltitude + 1.4*Math.round(elevations[0]);

		const { zoom, center } = getInitialCamera({ map, cameraStart: cameraRoute[0], initialElevation, initialBearing, cameraPitch });

		// Fly to clicked point and pitch camera (initial "raindrop" animation)
		flyToPoint({ map, center, zoom, bearing: initialBearing, pitch: cameraPitch });
		vizState.update(() => "running" );

		// Maintain a consistent speed using the route distance. The higher the speed coefficient, the slower the runner will move.
		const speedCoefficient = smoothedPath.length < 50 ? 300 : 120;
		const animationDuration = Math.round(speedCoefficient*routeDistance);

		map.once('moveend', () => {
			// When "raindrop" animation is finished, pause for a moment then begin river run
			setTimeout(runRiver({ map, animationDuration, cameraBaseAltitude, targetRoute, cameraRoute, routeDistance, cameraRouteDistance, elevations, cameraPitch }), 600);
		});
	}

	const createArticialCameraPoints = (smoothedPath, cameraTargetIndexGap) => {
		const firstPointsBearing = bearingBetween( smoothedPath[1], smoothedPath[0] );

		// console.log(smoothedPath, cameraTargetIndexGap);

		return smoothedPath.slice(0, cameraTargetIndexGap).map( (coordinate, index) => {
			const offsetDistance = distance(coordinate, smoothedPath[index+cameraTargetIndexGap]);
			return destination(coordinate, offsetDistance, firstPointsBearing).geometry.coordinates;
		});
	}
	
	const positionCamera = ({ map, cameraCoordinates, elevation, pitch, bearing }) => {
		const camera = map.getFreeCameraOptions();
			
		// set the position and altitude of the camera
		camera.position = mapbox.MercatorCoordinate.fromLngLat(
			{
				lng: cameraCoordinates[0],
				lat: cameraCoordinates[1]
			},
			elevation
		);
		
		camera.setPitchBearing(pitch, bearing);
		map.setFreeCameraOptions(camera);
	}

	const getInitialCamera = ({ map, cameraStart, initialElevation, initialBearing, cameraPitch }) => {
		const currentZoom = map.getZoom();
		const currentCenter = map.getCenter();
		const currentBearing = map.getBearing();
		const currentPitch = map.getPitch();

		positionCamera({ map, cameraCoordinates: cameraStart, elevation: initialElevation, pitch: cameraPitch, bearing: initialBearing });

		const zoom = map.getZoom();
		const center = map.getCenter();

		map.jumpTo({
			zoom: currentZoom,
			center: currentCenter,
			bearing: currentBearing,
			pitch: currentPitch
		});

		return { zoom, center }
	}

	const pathDistance = (coordinateSet) => lineDistance(lineString(coordinateSet));

	const pathSmoother = (coordinateSet, smoothingCoefficient=1) => {
		const setLength = coordinateSet.length;
		const smoothedCoordinatePath = coordinateSet.map((coordinate, index) => {
			const coordinateGroup = coordinateSet.slice(Math.max(0, index-smoothingCoefficient), index+1+smoothingCoefficient);
			const lng = coordinateGroup.map(d => d[0]).reduce((a, b) => a + b, 0) / coordinateGroup.length;
			const lat = coordinateGroup.map(d => d[1]).reduce((a, b) => a + b, 0) / coordinateGroup.length;

			return [lng, lat];
		});

		return smoothedCoordinatePath;
	}

	const projectDistance = ( fromCoordinate, toCoordinate, distance ) => {
		const bearing = bearingBetween(fromCoordinate, toCoordinate);
		return destination(fromCoordinate, distance, bearing).geometry.coordinates;
	}

	const calculateCameraPath = (coordinatePath, cameraTargetDistance, routeDistance) => {
		const cameraPathCoordinates = coordinatePath.slice(0, -cameraTargetDistance);
		const distanceGap = routeDistance - pathDistance(cameraPathCoordinates);

		return cameraPathCoordinates.map((coordinate, index) => {
			return projectDistance(coordinatePath[index + cameraTargetDistance], coordinate, distanceGap);
		})
	}

	const runRiver = ({ map, animationDuration, cameraBaseAltitude=4000, cameraPitch=70, targetRoute, cameraRoute, routeDistance, cameraRouteDistance, elevations }) => {
		let start;

		const frame = (time) => {
			if (!start) start = time;

			// phase determines how far through the animation we are
			const phase = (time - start) / animationDuration;

			// When finished, exit animation loop and zoom out to show ending point
			if (phase > 1) {
				console.log('done');
				map.interactive = true;

				showExitPoint({ map });

				return;
			}

			// Calculate camera elevation using the base elevation and the elevation at the specific coordinate point
			const elevationLast = elevations[Math.floor(elevations.length*phase)];
			const elevationNext = elevations[Math.ceil(elevations.length*phase)] || 0;
			const elevationStepProgress = elevations.length*phase - Math.floor(elevations.length*phase);

			const elevationEstimate = elevationLast + ((elevationNext - elevationLast)*elevationStepProgress);
			const tickElevation = cameraBaseAltitude + 1.4*Math.round(elevationEstimate);

			const alongRoute = along(
				lineString(targetRoute),
				routeDistance * phase
			).geometry.coordinates;
			
			const alongCamera = along(
				lineString(cameraRoute),
				cameraRouteDistance * phase
			).geometry.coordinates;
						
			const bearing = bearingBetween( alongCamera, alongRoute );

			// Generate/position a camera along route, pointed in direction of target point at set pitch
			positionCamera({ map, cameraCoordinates: alongCamera, elevation: tickElevation, pitch: cameraPitch, bearing });

			// This will update the location of the marker on the locator map
			// (may need to add a condition to keep this from updating on every tick, which is probably expensive and not necessary)
			currentLocation.update(() => alongRoute );

			window.requestAnimationFrame(frame);
		}
		
		window.requestAnimationFrame(frame);
	}

	const showExitPoint = ({ map }) => {
		map.flyTo({
			// bearing: (180+map.getBearing()) % 360,
			// pitch: 30,
			bearing: 0,
			pitch: 0,
			zoom: 6
		});

		map.once('moveend', () => {
			vizState.update(() => "uninitialized");
		})
	};

	const getElevations = async (coordinatePath, arrayStep=10) => {

		const elevationCoordinates = coordinatePath.filter((element, index) => {
			return index % arrayStep === 0;
		})

		const responses = await Promise.all(
			elevationCoordinates.map(
				([lng, lat]) => fetch(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?&access_token=pk.eyJ1Ijoic2FtbGVhcm5lciIsImEiOiJja2IzNTFsZXMwaG44MzRsbWplbGNtNHo0In0.BmjC6OX6egwKdm0fAmN_Nw`)
					.then(response => response.json())
			)
		)

		const data = responses.map(res => res.features.slice(-1)[0].properties.ele)
		return data;
	}

	const drawFlowPath = ({ map, featureData }) => {
		const sourceID = 'route'

		if (map.getLayer(sourceID)) {
			map.removeLayer(sourceID);
		}

		if (map.getSource(sourceID)) {
			map.removeSource(sourceID);
		}
		
		addRivers({ map, featureData, lineWidth: 2, sourceID });
	}

	const addRivers = ({ map, featureData, lineColor="steelblue", lineWidth=1, sourceID='route' }) => {
		const features = featureData.map((river) => {
			// Some rivers have multiple linestrings (such as the Mississippi)...
			// their coordinates will be a triple-nested array instead of a double-nested
			const featureType = Array.isArray(river.geometry.coordinates[0][0]) ? 'MultiLineString' : 'LineString';

			return ({
				type: 'Feature',
				properties: river.properties,
				geometry: {
					type: featureType,
					coordinates: river.geometry.coordinates
				}
			})
		});
						
		map.addSource(sourceID, {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features
			}
		});

		map.addLayer({
			id: sourceID,
			type: 'line',
			source: sourceID,
			layout: {
				'line-join': 'round',
				'line-cap': 'round'
			},
			paint: {
				'line-color': lineColor,
				'line-width': lineWidth
			}
		});
	}

	const addTopoLayer = ({ map }) => {
		map.addSource('mapbox-dem', {
			'type': 'raster-dem',
			'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
			'tileSize': 512,
			'maxzoom': 14
		});

		// add the DEM source as a terrain layer with exaggerated height
		map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.8 });

		map.addLayer({
			'id': 'sky',
			'type': 'sky',
			'paint': {
			'sky-type': 'atmosphere',
			'sky-atmosphere-sun': [0.0, 0.0],
			'sky-atmosphere-sun-intensity': 15
			}
		});
	}

	const handleResize = () => {
		mapBounds = map.getBounds();
	};

	const flyToPoint = ({ map, center, bearing=0, pitch=70 }) => {
		map.flyTo({
			center,
			zoom: 13,
			speed: 0.9,
			curve: 1,
			pitch,
			bearing,
			easing(t) {
				return t;
			}
		})
	}

	$: coordinates.update(() => {
		if (mapBounds._sw) {
			return [
				[mapBounds._sw.lat, mapBounds._ne.lat],
				[mapBounds._sw.lng, mapBounds._ne.lng]
			];
		}
	});

</script>

<style>
	div {
		position: absolute;
		width: 100vw;
		height: 100vh;
		z-index: 1;
	}

	@media only screen and (max-width: 600px) {
		div {
			height: 80vh;
			top: 20vh;
		}
	
	}
</style>

<svelte:window on:resize={handleResize} />

<div style="opacity: {visibleIndex ? 1 : 0}" bind:this={container}>
	{#if map}
		<slot />
	{/if}
</div>

<Prompt />