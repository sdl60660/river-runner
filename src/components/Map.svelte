<script>
	import { onMount } from 'svelte';
	import { mapbox } from '../mapbox.js';
	import { tick } from 'svelte';
	import * as d3 from 'd3';

	import { bearingBetween, distanceToPolygon } from '../utils';
	import { coordinates, stoppingFeature } from '../state';
	
	import Prompt from './Prompt.svelte';
	import NavigationInfo from './NavigationInfo.svelte';
	import LocatorMap from './LocatorMap.svelte';

	import along from '@turf/along';
	import { featureCollection, lineString } from '@turf/helpers';
	import lineDistance from '@turf/line-distance';
	import distance from '@turf/distance';
	import destination from '@turf/destination';

	export let bounds;
	export let stateBoundaries;
	export let stoppingFeatures;
	export let featureData = undefined;
	export let visibleIndex;
	export let mapStyle;
	export let addTopo;

	let container;
	let map;
	let mapBounds = bounds;

	let aborted = false;
	let vizState = "uninitialized";

	let riverPath;
	let currentLocation;
	let featureGroups = [];
	let activeFeatureIndex = -1;
	let totalLength;

	let phaseJump;

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
				zoom: 9
			});

			map.fitBounds(bounds, { animate: false, padding: 30 });
			map.setMaxBounds(map.getBounds());
			mapBounds = map.getBounds();

            map.on('load', () => {
				if (featureData) {
					addRivers({ map, featureData, lineWidth: 1 });
				}

				if (addTopo) {
					addTopoLayer({ map });
				}

				const geocoder = initGeocoder({ map });		
            });

			map.on('click', async (e) => {
				initRunner({ map, e });
			});
        };

		document.head.appendChild(link);

		return () => {
			map.remove();
			link.parentNode.removeChild(link);
		};
	});

	const initGeocoder = ({ map }) => {
		const geocoder = new MapboxGeocoder({
			accessToken: "pk.eyJ1Ijoic2FtbGVhcm5lciIsImEiOiJja2IzNTFsZXMwaG44MzRsbWplbGNtNHo0In0.BmjC6OX6egwKdm0fAmN_Nw",
			countries: 'us',
			bbox: bounds.flat(),
			mapboxgl: mapbox,
			placeholder: "Search for any location",
			marker: false,
			flyTo: false
		});

		geocoder.on('result', (e) => { 
			const result = e.result;
			result.lngLat = {
				lng: result.geometry.coordinates[0],
				lat: result.geometry.coordinates[1]
			};
			geocoder.clear();

			initRunner({ map, e: result });
		});

		const position = window.innerWidth > 600 ? 'top-right' : 'bottom-left';
		map.addControl(geocoder, position);				
	}

	const initRunner = async ({ map, e }) => {
		if (map.interactive === false) {
			return;
		}

		map.interactive = false;
		map.scrollZoom.disable();
		d3.select(".mapboxgl-ctrl-geocoder").style("display", "none");

		currentLocation = e.lngLat;
		
		const closestFeature = await findClosestFeature(e);
		console.log(closestFeature);

		if (!closestFeature) {
			vizState = "error";
			setTimeout(() => resetMapState({ map }), 1500);
			return;
		}

		// try {
		// 	const closestFeatureURL = `https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28${e.lngLat.lng.toFixed(4)}%20${e.lngLat.lat.toFixed(4)}%29`;
		// 	const coordinateResponse = await fetch(closestFeatureURL)
		// 	const data = await coordinateResponse.json()
		// 	closestFeature = data.features[0];
		// }
		// catch {
		// 	console.log('coordinate error');

		// 	const closestFeatureURL = `https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28${e.lngLat.lng.toFixed(0)}%20${e.lngLat.lat.toFixed(0)}%29`;
		// 	const coordinateResponse = await fetch(closestFeatureURL);

		// 	console.log(e.lngLat.lng.toFixed(0),e.lngLat.lat.toFixed(0) );

		// 	console.log(await coordinateResponse.json());
		// 	resetMapState({ map });
		// 	return;
		// }
		
		const flowlinesURL = closestFeature.properties.navigation + '/DM/flowlines?f=json&distance=6000';
		const flowlinesResponse = await fetch(flowlinesURL);
		let flowlinesData = await flowlinesResponse.json();
		flowlinesData.features = await addVAAData(flowlinesData.features);
		
		totalLength = flowlinesData.features[0].properties.pathlength > 0 ? flowlinesData.features[0].properties.pathlength : undefined;
		const riverFeatures = getFeatureGroups(flowlinesData);
		featureGroups = riverFeatures;

		const river = flowlinesData.features[0];
		const originPoint = river.geometry.coordinates[0];
		const destinationPoint = flowlinesData.features.slice(-1)[0].geometry.coordinates.slice(-1)[0];

		console.log('Clicked on:', e.lngLat, 'Closest point:', originPoint);

		const coordinatePath = flowlinesData.features.length > 3 ? flowlinesData.features.map( feature => feature.geometry.coordinates.slice(-1)[0] )
															 : flowlinesData.features.map( feature => feature.geometry.coordinates).flat().filter((d,i) => i % 10 === 0);

		riverPath = [{ geometry: { coordinates: coordinatePath }}];
		currentLocation = originPoint;
		vizState = "calculating";

		const pathStoppingFeature = determineStoppingFeature({ destinationPoint, stoppingFeatures });
		stoppingFeature.update(() => pathStoppingFeature);
		
		// Draw river lines from flowline features
		// drawFlowPath({ map, featureData: [ { geometry: { coordinates: coordinatePath }}]});
		drawFlowPath({ map, featureData: flowlinesData.features, lineWidth: 2 })

		const smoothedPath = pathSmoother(coordinatePath, Math.min(9, Math.floor(coordinatePath.length / 2)));
		const cameraTargetIndexGap = Math.min(Math.floor(smoothedPath.length / 2), 11);
		const artificalCameraStartPoints = createArticialCameraPoints(smoothedPath, coordinatePath, cameraTargetIndexGap, originPoint);
		
		const targetRoute = smoothedPath;
		const cameraRoute = artificalCameraStartPoints.concat(smoothedPath.slice(0, -cameraTargetIndexGap));
		
		// get the overall distance of each route so we can interpolate along them
		const routeDistance = pathDistance(targetRoute);
		const cameraRouteDistance = pathDistance(cameraRoute);
		const trueRouteDistance = pathDistance(coordinatePath);

		console.log('Distances:', routeDistance, cameraRouteDistance, trueRouteDistance);

		const initialBearing = bearingBetween( cameraRoute[0], targetRoute[0] );

		const cameraBaseAltitude = 4300;
		const elevationArrayStep = 100;
		const elevations = await getElevations(coordinatePath, elevationArrayStep);
		const initialElevation = cameraBaseAltitude + 1.25*Math.round(elevations[0]);

		// We'll calculate the pitch based on the altitude/distance from camera to target
		const cameraPitch = calculatePitch(initialElevation, 1000*distance(cameraRoute[0], targetRoute[0]));
		// console.log('Calculated Pitch:', cameraPitch, 'Elevation:', initialElevation, 'Distance:', 1000*distance(cameraRoute[0], targetRoute[0]))
		const { zoom, center } = precalculateInitialCamera({ map, cameraStart: cameraRoute[0], initialElevation, initialBearing, cameraPitch });

		// Fly to clicked point and pitch camera (initial "raindrop" animation)
		// flyToPoint({ map, center, zoom, bearing: initialBearing, pitch: cameraPitch });
		map.flyTo({center, zoom, speed: 0.9, curve: 1, pitch: cameraPitch, bearing: initialBearing,
			easing(t) {
				return t;
			}
		});
		vizState = "running";
		// const locationTracerPoint = addLocationMarker({ map, origin: coordinatePath[0] });

		// Maintain a consistent speed using the route distance. The higher the speed coefficient, the slower the runner will move.
		const speedCoefficient = smoothedPath.length < 50 ? 200 : 125 - (cameraPitch - 65);
		const animationDuration = Math.round(speedCoefficient*routeDistance);

		map.once('moveend', () => {
			// When "raindrop" animation is finished, begin river run
			runRiver({
				map,
				animationDuration,
				cameraBaseAltitude,
				cameraPitch,
				targetRoute,
				cameraRoute,
				coordinatePath,
				routeDistance,
				cameraRouteDistance,
				trueRouteDistance,
				elevations,
				riverFeatures
			});
		});
	}

	const findClosestFeature = async (e) => {
		let closestFeature;
		let resultFound = false;
		let roundingDigits = 5;
		while (resultFound === false && roundingDigits >= 0) {
			roundingDigits -= 1;

			try {
				const closestFeatureURL = `https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28${e.lngLat.lng.toFixed(roundingDigits)}%20${e.lngLat.lat.toFixed(roundingDigits)}%29`;
				const coordinateResponse = await fetch(closestFeatureURL)
				const data = await coordinateResponse.json()
				closestFeature = data.features[0];
				
				resultFound = true;
			}
			catch {
				console.log(`Error while rounding coordinates to ${roundingDigits} digits. Trying again with less precise coordinates.`);
			}
		}

		return closestFeature;
	}

	const determineStoppingFeature = ({ destinationPoint, stoppingFeatures }) => {
		let minDistance = 10000000;
		let closestFeature = null;
		let oceanDistance = null;

		// Find the distance from each polygon in the stop feature dataset
		stoppingFeatures.forEach(feature => {
			const featureDistance = distanceToPolygon({ startPoint: destinationPoint, targetPolygon: feature });

			if (featureDistance < minDistance) {
				minDistance = featureDistance;
				closestFeature = feature;
			}

			if (feature.properties.stop_feature_name === "Ocean") {
				oceanDistance = featureDistance;
			}
		})

		// If the closest feature in the stop feature set is more than 100 km away, this is landing on an unidentified inland water feature
		if (minDistance > 100000) {
			return "Inland Water Feature";
		}
		// Sometimes there's a large inlet/bay that creates artificial distance between the destination point and my imperfect ocean shapefile polygon
		// It may then think that another feature, like a lake is the "stop feature", (this happens in the Alabama gulf, for example).
		// We're going to say that if the ocean is within 50km of the stop point, it's very likely the true end point
		else if (closestFeature.properties.stop_feature_name === "Ocean" || oceanDistance < 50000) {
			return destinationPoint[0] > -100 ? "Atlantic Ocean" : "Pacific Ocean";
		}
		else {
			return closestFeature.properties.stop_feature_name;
		}
	}

	const getFeatureGroups = (flowlinesData) => {
		const featureNames = flowlinesData.features.filter( feature => feature.properties.feature_name ).map( feature => feature.properties.feature_name );
		const fullDistance = flowlinesData.features[0].properties.pathlength;

		let riverFeatures = featureNames.filter((item, i, ar) => ar.indexOf(item) === i).map((feature, index) => {
			
			const featureData = flowlinesData.features.find(item => item.properties.feature_name === feature);
			const featureIndex = flowlinesData.features.findIndex(item => item.properties.feature_name === feature);

			return ({
				feature_data_index: featureIndex,
				progress: fullDistance === -999 ? (featureIndex / flowlinesData.features.length) : ((fullDistance - featureData.properties.pathlength) / fullDistance),
				name: feature,
				distance_from_destination: featureData.properties.pathlength === -9999 ? 0 : featureData.properties.pathlength,
				index,
				stream_level: featureData.properties.streamlvl,
				active: false
			})
		});

		// Because I'm not sampling every flowline, sometimes I get weird results at the end of the flowpath where, for example, there's a flowline
		// that's part of the Mississippi Delta, but isn't technically isn't grouped under the Mississippi river, and it considers it the last step
		// Here, I'm going to treat anyting with streamlevel 1 (which means it's a terminal feature) as the last feature in the sequence, but add an 
		// exception case for paths that stop at inland lakes, just in case their last feature isn't encoded as stream level 1
		let trueStopFeatureIndex = riverFeatures.findIndex(feature => feature.stream_level === 1);
		if (trueStopFeatureIndex === -1) {
			trueStopFeatureIndex = riverFeatures.length-1;
		};
		riverFeatures = riverFeatures.slice(0, trueStopFeatureIndex+1);

		riverFeatures.forEach( (feature, i) => {
			if (i === riverFeatures.length - 1) {
				feature.length_km = Math.round(feature.distance_from_destination);
				feature.stop_point = null;

				feature.feature_data = [ { geometry: { coordinates: flowlinesData.features.slice(feature.feature_data_index).map( feature => feature.geometry.coordinates.slice(-1)[0] ) }} ];
			}
			else {
				const featureLength = feature.distance_from_destination - riverFeatures[i+1].distance_from_destination;
				feature.length_km = Math.round(featureLength);
				feature.stop_point = riverFeatures[i+1].progress;

				feature.feature_data = [ { geometry: { coordinates: flowlinesData.features.slice(feature.feature_data_index, riverFeatures[i+1].feature_data_index).map( feature => feature.geometry.coordinates.slice(-1)[0] ) }} ];
			}
		})

		return riverFeatures;
	}

	const addLocationMarker = ({ map, origin, pointID='location-marker' }) => {
		if (map.getLayer(pointID)) {
			map.removeLayer(pointID);
		}

		if (map.getSource(pointID)) {
			map.removeSource(pointID);
		}

		const point = {
			'type': 'FeatureCollection',
			'features': [
				{
					'type': 'Feature',
					'properties': {},
					'geometry': {
						'type': 'Point',
						'coordinates': origin
					}
				}
			]
		};

		map.addSource(pointID, {
			'type': 'geojson',
			'data': point
		});

		map.addLayer({
			'id': pointID,
			'source': pointID,
			'type': 'circle',
			'paint': {
				'circle-radius': {
					'base': 2,
					'stops': [
						[7, 2],
						[14, 10]
					]
				},
				'circle-color': "#ff0000"
			}
		});

		return point;
	}

	const getFeatureVAA = async (feature, index) => {
		if (index > 40 && index % 10 !== 0) {
			return feature;
		}
		else {
			const baseUrl = 'https://river-runner-20db3-default-rtdb.firebaseio.com/';
			const response = await fetch(baseUrl + feature.properties.nhdplus_comid + '.json');
			const featureData = await response.json();

			feature.properties = {
				...feature.properties,
				...featureData,
				// feature_name: featureData.gnis_name || `Unnamed River/Stream (${featureData.levelpathid})`
				feature_name: featureData.gnis_name || `Unnamed River/Stream`

			};

			return feature;
		}
	}

	const addVAAData = (flowlineFeatures) => {
		return Promise.all(
			flowlineFeatures.map(async (feature, i) => await getFeatureVAA(feature, i))
		)
	}

	const createArticialCameraPoints = (smoothedPath, coordinatePath, cameraTargetIndexGap, originPoint) => {
		const firstPointsBearing = bearingBetween( coordinatePath[1], coordinatePath[0] );
		const pointDistances = smoothedPath.slice(0, Math.min(50, smoothedPath.length-1)).map((coordinate, index) => {
			return distance(coordinate, smoothedPath[index+1]);
		});  
		const averagePointDistance = pointDistances.reduce((a,b) => a + b, 0) / pointDistances.length; 

		return [...Array(cameraTargetIndexGap).keys()].reverse().map(index => {
			const offsetDistance = averagePointDistance*(index+1);
			return destination(originPoint, offsetDistance, firstPointsBearing).geometry.coordinates;
		})
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

	const precalculateInitialCamera = ({ map, cameraStart, initialElevation, initialBearing, cameraPitch }) => {
		// Store current camera info
		const currentZoom = map.getZoom();
		const currentCenter = map.getCenter();
		const currentBearing = map.getBearing();
		const currentPitch = map.getPitch();

		// Position the camera how it will be positioned on the first tick of the run
		positionCamera({ map, cameraCoordinates: cameraStart, elevation: initialElevation, bearing: initialBearing, pitch: cameraPitch });

		// Log the zoom/center
		const zoom = map.getZoom();
		const center = map.getCenter();

		// Send the camera back to where it came from, without user seeing anything
		map.jumpTo({
			zoom: currentZoom,
			center: currentCenter,
			bearing: currentBearing,
			pitch: currentPitch
		});

		// Return zoom and center so that we can fly to the exact start point and it won't be jarring when the run starts
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

	const calculatePitch = (elevation, distance) => (90 - Math.atan(elevation / distance) * (180 / Math.PI));

	const calculateCameraPath = (coordinatePath, cameraTargetDistance, routeDistance) => {
		const cameraPathCoordinates = coordinatePath.slice(0, -cameraTargetDistance);
		const distanceGap = routeDistance - pathDistance(cameraPathCoordinates);

		return cameraPathCoordinates.map((coordinate, index) => {
			return projectDistance(coordinatePath[index + cameraTargetDistance], coordinate, distanceGap);
		})
	}

	const runRiver = ({ map, animationDuration, cameraBaseAltitude=4300, cameraPitch=70, targetRoute, cameraRoute, coordinatePath, routeDistance, cameraRouteDistance, trueRouteDistance, elevations, riverFeatures }) => {
		let start;

		const stopPoints = riverFeatures.map(d => d.stop_point)
		activeFeatureIndex = 0;
		let stopPoint = stopPoints[0];

		// let featureIndex = 0;
		// let currentFeature = riverFeatures[0];
		// dispatchFeatureGroupUpdate(riverFeatures, currentFeature);

		const frame = (time) => {
			if (!start) start = time;

			if (phaseJump !== undefined) {
				const currentProgress = (time - start);
				const newProgress = phaseJump * animationDuration;

				start += currentProgress - newProgress;
				stopPoint = stopPoints[activeFeatureIndex];

				console.log(start, stopPoint, phaseJump)

				phaseJump = undefined;
			}

			// phase determines how far through the animation we are
			const phase = (time - start) / animationDuration;

			// When finished, exit animation loop and zoom out to show ending point
			if (phase > 1 || aborted === true) {
				exitNavigation({ map });
				return;
			}

			if (stopPoint && phase >= stopPoint) {
				activeFeatureIndex += 1;
				stopPoint = stopPoints[activeFeatureIndex]
			}

			// Calculate camera elevation using the base elevation and the elevation at the specific coordinate point
			const elevationLast = elevations[Math.floor(elevations.length*phase)];
			const elevationNext = elevations[Math.ceil(elevations.length*phase)] || 0;
			const elevationStepProgress = elevations.length*phase - Math.floor(elevations.length*phase);

			const elevationEstimate = elevationLast + ((elevationNext - elevationLast)*elevationStepProgress);
			const tickElevation = cameraBaseAltitude + 1.25*Math.round(elevationEstimate);

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
			currentLocation = alongRoute;

			window.requestAnimationFrame(frame);
		}
		
		window.requestAnimationFrame(frame);
	}

	const exitNavigation = ({ map }) => {
		if (!aborted) {
			activeFeatureIndex += 1;
		}

		map.flyTo({
			// bearing: (180+map.getBearing()) % 360,
			// pitch: 30,
			bearing: 0,
			pitch: 0,
			zoom: 6
		});

		// vizState = "finished";

		map.once('moveend', () => {
			resetMapState({ map });
		})
	};

	const resetMapState = ({ map }) => {
		map.interactive = true;
		map.scrollZoom.enable();
		aborted = false;

		currentLocation = undefined;
		activeFeatureIndex = -1;
		vizState = "uninitialized";

		d3.select(".mapboxgl-ctrl-geocoder").style("display", "block");
	}

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

	const drawFlowPath = ({ map, featureData, lineWidth=2 }) => {
		const sourceID = 'route'

		if (map.getLayer(sourceID)) {
			map.removeLayer(sourceID);
		}

		if (map.getSource(sourceID)) {
			map.removeSource(sourceID);
		}
		
		addRivers({ map, featureData, lineWidth, sourceID });
	}

	const addRivers = ({ map, featureData, lineColor="steelblue", lineWidth=1, sourceID='route' }) => {
		const features = featureData.map((river) => {
			// Some rivers in some files have multiple linestrings (such as the Mississippi)...
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

	const exitFunction = () => {
		aborted = true;
	}

	const handleJump = (e) => {
		// console.log(e.detail);

		activeFeatureIndex = e.detail.featureIndex;
		phaseJump = e.detail.pathProgress;
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
	.map-wrapper {
		position: absolute;
		width: 100vw;
		height: 100vh;
		z-index: 1;
	}

	@media only screen and (max-width: 600px) {
		.map-wrapper {
			/* this prevents some weird stuff on mobile screens when the geolocator search suggestons come up*/
			height: max(400px, calc(100% - 20vh));
			top: 20vh;
		}
	
	}

</style>

<svelte:window on:resize={handleResize} />

<div class="map-wrapper" style="opacity: {visibleIndex ? 1 : 0}" bind:this={container}>
	{#if map}
		<slot />
	{/if}
</div>

<Prompt {vizState} {currentLocation} />
<NavigationInfo on:abort-run={exitFunction} on:progress-set={(e) => handleJump(e) } {vizState} {activeFeatureIndex} {featureGroups} {totalLength} />
<LocatorMap {bounds} {stateBoundaries} visibleIndex={null} {riverPath} {currentLocation} {vizState} {activeFeatureIndex} {featureGroups} />