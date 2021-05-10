<script>
	import { onMount } from 'svelte';
	import { mapbox } from '../mapbox.js';
	import { bearingBetween, roundToDigits } from '../utils';

	import { tick } from 'svelte';
	import { coordinates } from '../state';

	export let bounds = [[-122, 25], [-75, 51]];
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
				// https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28-94.713%2038.09%29
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
				addRivers({ map, featureData: flowlinesData.features, lineWidth: 2 })

				// Fly to clicked point and pitch camera
				flyToPoint({ map, center: originPoint, bearing });

				// const coordinatePath = flowlinesData.features.map( feature => feature.geometry.coordinates ).flat();
				const coordinatePath = flowlinesData.features.map( feature => feature.geometry.coordinates.slice(-1)[0] );
				// const coordinatePath = refgageData.features.map( feature => feature.geometry.coordinates );
				
				let index = 0;
				const intervalId = setInterval(() => {
					const center = coordinatePath[index];
					// const bearing = index === coordinatePath.length - 1 ?
					// 	bearingBetween( coordinatePath[index-1], center ) :
					// 	bearingBetween( center, coordinatePath[index+1] );
					
					console.log(center, coordinatePath[index+1], bearing, `${index+1} of ${coordinatePath.length}`);

					map.easeTo({
						center,
						bearing,
						pitch: 75,
						zoom: 12,
						duration: 100
					});

					index += 1;

					if (index === coordinatePath.length) {
						clearInterval(intervalId);
					}

				}, 120)

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

	const addRivers = ({ map, featureData, lineColor="steelblue", lineWidth=1 }) => {
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
						
		map.addSource('route', {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features
			}
		});

		map.addLayer({
			id: 'route',
			type: 'line',
			source: 'route',
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

	// const unsubscribeScroll = scroll.subscribe(({ index, progress }) => {
	//     scrollIndex = index;
	//     scrollProgress = progress;
	// })
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
