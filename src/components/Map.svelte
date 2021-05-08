<script>
	import { onMount, setContext } from 'svelte';
	import { mapbox } from '../mapbox.js';
	import { tick } from 'svelte';
	import { coordinates } from '../state';

	export let bounds;
	export let featureData;
	export let visibleIndex;
	export let mapStyle;
	export let addTopo;

	let container;
	let map;
	let mapBounds = bounds;
	// let scrollIndex = 0;
	// let scrollProgress = 0;

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

            map.on('load', () => {
				addRivers({ map, featureData, lineWidth: 2 });

				if (addTopo) {
					addTopoLayer({ map });
				}
            });

			map.on('click', (e) => {

				// Fly to clicked point and pitch camera
				map.flyTo({
					center: e.lngLat,
					zoom: 11,
					speed: 0.8,
					curve: 1,
					pitch: 85,
					// bearing: 80,
					easing(t) {
						return t;
					}
				})
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

		// console.log(features.length, features);
						
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
		map.addSource('dem', {
			type: 'raster-dem',
			url: 'mapbox://mapbox.terrain-rgb'
		});

		map.addLayer({
			id: 'hillshading',
			source: 'dem',
			type: 'hillshade',
			'hillshade-exaggeration': 2.2
		});

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
