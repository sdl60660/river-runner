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
				const bearing = bearingBetween( river.geometry.coordinates[0], flowlinesData.features.slice(-1)[0].geometry.coordinates.slice(-1)[0] )

				console.log('Clicked on:', e.lngLat, 'Closest point:', originPoint);

				const coordinatePath = flowlinesData.features.map( feature => feature.geometry.coordinates.slice(-1)[0] );

				riverPath.update(() => [ { geometry: { coordinates: coordinatePath }} ]);
				currentLocation.update(() => originPoint );
				vizState.update(() => "running" );
				
				// Draw river lines from flowline features
				drawFlowPath({ map, featureData: flowlinesData.features })

				// Fly to clicked point and pitch camera
				flyToPoint({ map, center: originPoint, bearing });

				const elevationArrayStep = 100;
				const elevations = await getElevations(coordinatePath, elevationArrayStep);

				// map.easeTo({
				// 	center: originPoint,
				// 	pitch: 70,
				// 	bearing,
				// 	zoom: 11
				// });

				const smoothedPath = pathSmoother(coordinatePath, 5);

				const cameraTargetIndexGap = 10;

				// const targetRoute = smoothedPath.slice(cameraTargetIndexGap);
				// const routeDistance = pathDistance(targetRoute);
				// const cameraRoute = calculateCameraPath(smoothedPath, cameraTargetIndexGap, routeDistance);
				
				const targetRoute = smoothedPath.slice(cameraTargetIndexGap);
				const cameraRoute = smoothedPath.slice(0, -cameraTargetIndexGap);
				const maintainedDistance = distance(cameraRoute[0], targetRoute[0]);

				// get the overall distance of each route so we can interpolate along them
				const routeDistance = pathDistance(targetRoute);
				const cameraRouteDistance = pathDistance(cameraRoute);
				const trueRouteDistance = pathDistance(coordinatePath);

				console.log('Distances:', routeDistance, cameraRouteDistance, trueRouteDistance);

				// Maintain a consistent speed using the route distance
				const animationDuration = Math.round(150*routeDistance);

				map.once('moveend', () => {
					console.log('finished flying');
					setTimeout(runRiver({ map, animationDuration, targetRoute, cameraRoute, routeDistance, cameraRouteDistance, elevations, maintainedDistance }), 1000);
				});
			});
        };

		document.head.appendChild(link);

		return () => {
			map.remove();
			link.parentNode.removeChild(link);
		};
	});

	const pathDistance = (coordinateSet) => lineDistance(lineString(coordinateSet));

	const pathSmoother = (coordinateSet, smootherVal=1) => {
		const setLength = coordinateSet.length;
		const smoothedCoordinatePath = coordinateSet.map((coordinate, index) => {
			const coordinateGroup = coordinateSet.slice(Math.max(0, index-smootherVal), index+1+smootherVal);
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

	const runRiver = ({ map, animationDuration, cameraBaseAltitude=4000, targetRoute, cameraRoute, routeDistance, cameraRouteDistance, elevations, maintainedDistance }) => {
		let start;
		let locationUpdateInterval = 200;

		const frame = (time) => {
			if (!start) start = time;
			// phase determines how far through the animation we are
			const phase = (time - start) / animationDuration;

			const elevationLast = elevations[Math.floor(elevations.length*phase)];
			const elevationNext = elevations[Math.ceil(elevations.length*phase)] || 0;
			const elevationStepProgress = elevations.length*phase - Math.floor(elevations.length*phase);

			const elevationEstimate = elevationLast + ((elevationNext - elevationLast)*elevationStepProgress);
			const tickElevation = cameraBaseAltitude + 1.4*Math.round(elevationEstimate);

			// phase is normalized between 0 and 1
			// when the animation is finished, reset start to loop the animation
			if (phase > 1) {
				console.log('done');
				map.interactive = true;

				// wait 5 seconds before looping
				setTimeout(function () {
					// start = 0.0;
					window.cancelAnimationFrame(frame);
				}, 5000);
			}
			
			const alongRoute = along(
				lineString(targetRoute),
				routeDistance * phase
			).geometry.coordinates;
			
			const alongCamera = along(
				lineString(cameraRoute),
				cameraRouteDistance * phase
			).geometry.coordinates;
			
			const camera = map.getFreeCameraOptions();

			const modifiedCameraPosition = projectDistance(alongRoute, alongCamera, maintainedDistance);
			
			// set the position and altitude of the camera
			camera.position = mapbox.MercatorCoordinate.fromLngLat(
				// {
				// 	lng: alongCamera[0],
				// 	lat: alongCamera[1]
				// },
				{
					lng: modifiedCameraPosition[0],
					lat: modifiedCameraPosition[1]
				},
				tickElevation
			);
			
			// tell the camera to look at a point along the route
			camera.lookAtPoint({
				lng: alongRoute[0],
				lat: alongRoute[1]
			});

			// console.log('Point distance:', distance(alongCamera, alongRoute))

			// camera.setPitchBearing({
			// 	pitch: 70,
			// 	bearing: bearingBetween( alongCamera, alongRoute )
			// });
			
			map.setFreeCameraOptions(camera);

			if ((time - start) > locationUpdateInterval) {
				currentLocation.update(() => alongRoute );

				locationUpdateInterval += (time - start);
			}
			
			window.requestAnimationFrame(frame);
		}
		
		window.requestAnimationFrame(frame);
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

	const drawFlowPath = ({ map, featureData }) => {
		const sourceID = 'route'

		if (map.getSource(sourceID)) {
			map.removeSource(sourceID);
		}
		if (map.getLayer(sourceID)) {
			map.removeLayer(sourceID);
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

	const flyToPoint = ({ map, center, bearing=0 }) => {
		map.flyTo({
			center,
			zoom: 12,
			speed: 0.9,
			curve: 1,
			pitch: 70,
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
</style>

<svelte:window on:resize={handleResize} />

<div style="opacity: {visibleIndex ? 1 : 0}" bind:this={container}>
	{#if map}
		<slot />
	{/if}
</div>

<Prompt />