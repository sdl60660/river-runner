<script>
	import { onMount } from 'svelte';
	import { mapbox } from '../mapbox.js';
	import { bearingBetween, roundToDigits } from '../utils';

	import { tick } from 'svelte';
	import { coordinates } from '../state';

	import along from '@turf/along';
	import { lineString } from '@turf/helpers';
	import lineDistance from '@turf/line-distance';

	import * as d3 from 'd3';

	export let bounds = [[-125, 24], [-66, 51]];
	export let basins;
	export let featureData = undefined;
	export let coordinateQuadtree = undefined;
	export let visibleIndex;
	export let mapStyle;
	export let addTopo;

	console.log(bounds);

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

				// https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28-155.5514478014136%2019.503028809053873%29
				// https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/800004144/navigation/DM/flowlines?f=json&distance=1800
				// https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/800004144/navigation/DM/ref_gage?f=json&distance=1800
				// https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/800004144/navigation/DM/huc12pp?f=json&distance=1800

				const closestFeatureURL = `https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28${e.lngLat.lng}%20${e.lngLat.lat}%29`;
				const coordinateResponse = await fetch(closestFeatureURL)
    			const closestFeature = (await coordinateResponse.json()).features[0];
				
				const flowlinesURL = closestFeature.properties.navigation + '/DM/flowlines?f=json&distance=5000';
				const flowlinesResponse = await fetch(flowlinesURL);
				const flowlinesData = await flowlinesResponse.json();

				const refgageURL = closestFeature.properties.navigation + '/DM/ref_gage?f=json&distance=5000';
				const refgageResponse = await fetch(refgageURL);
				const refgageData = await refgageResponse.json();

				// ['flowlines', 'ref_gage'].map(featureType => {

				// })

				console.log(flowlinesData, refgageData);

				const river = flowlinesData.features[0];
				const originPoint = river.geometry.coordinates[0];
				// const bearing = bearingBetween( river.geometry.coordinates[0], river.geometry.coordinates[1] );
				const bearing = bearingBetween( river.geometry.coordinates[0], flowlinesData.features.slice(-1)[0].geometry.coordinates.slice(-1)[0] )

				console.log('Clicked on:', e.lngLat, 'Closest point:', originPoint);
				
				// Draw river lines from flowline features
				drawFlowPath({ map, featureData: flowlinesData.features })

				// Fly to clicked point and pitch camera
				flyToPoint({ map, center: originPoint, bearing });

				// const coordinatePath = flowlinesData.features.map( feature => feature.geometry.coordinates ).flat();
				const coordinatePath = flowlinesData.features.map( feature => feature.geometry.coordinates.slice(-1)[0] );
				// const coordinatePath = refgageData.features.map( feature => feature.geometry.coordinates );
				
				// let index = 0;
				// const intervalId = setInterval(() => {
					// const center = coordinatePath[index];
				// 	// const bearing = index === coordinatePath.length - 1 ?
				// 	// 	bearingBetween( coordinatePath[index-1], center ) :
				// 	// 	bearingBetween( center, coordinatePath[index+1] );
					
				// 	console.log(center, coordinatePath[index+1], bearing, `${index+1} of ${coordinatePath.length}`);

				// 	map.easeTo({
				// 		center,
				// 		bearing,
				// 		pitch: 75,
				// 		zoom: 12,
				// 		duration: 100
				// 	});

				// 	index += 1;

				// 	if (index === coordinatePath.length) {
				// 		clearInterval(intervalId);
				// 	}

				// }, 120)

				const elevationArrayStep = 25;
				const elevations = await getElevations(coordinatePath, elevationArrayStep);

				map.easeTo({
					center: originPoint,
					pitch: 70,
					bearing,
					zoom: 11
				});

				const targetRoute = coordinatePath.slice(5);
				const cameraRoute = coordinatePath.slice(0, -5);

				// get the overall distance of each route so we can interpolate along them
				const routeDistance = lineDistance(
					lineString(targetRoute)
				);
				const cameraRouteDistance = lineDistance(
					lineString(cameraRoute)
				);

				console.log('Distances:', routeDistance, cameraRouteDistance);

				// Maintain a consistent speed using the route distance
				const animationDuration = Math.round(200*routeDistance);

				setTimeout(runRiver({ map, animationDuration, targetRoute, cameraRoute, routeDistance, cameraRouteDistance, elevations }), 4500);

				// map.on('moveend', () => {
				// 
				// });
			});
        };

		document.head.appendChild(link);

		return () => {
			map.remove();
			link.parentNode.removeChild(link);
		};
	});

	const runRiver = ({ map, animationDuration, targetRoute, cameraRoute, routeDistance, cameraRouteDistance, elevations }) => {
		let start;
		const cameraBaseAltitude = 4000;

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

				// wait 1.5 seconds before looping
				setTimeout(function () {
					start = 0.0;
				}, 5000);
			}
			
			// use the phase to get a point that is the appropriate distance along the route
			// this approach syncs the camera and route positions ensuring they move
			// at roughly equal rates even if they don't contain the same number of points
			const alongRoute = along(
				lineString(targetRoute),
				routeDistance * phase
			).geometry.coordinates;
			
			const alongCamera = along(
				lineString(cameraRoute),
				cameraRouteDistance * phase
			).geometry.coordinates;
			
			const camera = map.getFreeCameraOptions();
			
			// set the position and altitude of the camera
			camera.position = mapbox.MercatorCoordinate.fromLngLat(
				{
					lng: alongCamera[0],
					lat: alongCamera[1]
				},
				tickElevation
			);
			
			// tell the camera to look at a point along the route
			camera.lookAtPoint({
				lng: alongRoute[0],
				lat: alongRoute[1]
			});
			
			map.setFreeCameraOptions(camera);

			console.log(phase);
			
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
		// map.addSource('dem', {
		// 	type: 'raster-dem',
		// 	url: 'mapbox://mapbox.terrain-rgb'
		// });

		// map.addLayer({
		// 	id: 'hillshading',
		// 	source: 'dem',
		// 	type: 'hillshade',
		// 	'hillshade-exaggeration': 2.2
		// });

		map.addSource('mapbox-dem', {
			'type': 'raster-dem',
			'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
			'tileSize': 512,
			'maxzoom': 14
		});

		// add the DEM source as a terrain layer with exaggerated height
		map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 2.2 });

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
			zoom: 13,
			speed: 0.8,
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

<svelte:window on:resize={handleResize} />

<div style="opacity: {visibleIndex ? 1 : 0}" bind:this={container}>
	{#if map}
		<slot />
	{/if}
</div>

<style>
	div {
		position: absolute;
		width: 100vw;
		height: 100vh;
	}
</style>
