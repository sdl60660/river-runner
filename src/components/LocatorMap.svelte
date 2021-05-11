<script>
	import { onMount } from 'svelte';
	import { mapbox } from '../mapbox.js';

	import { tick } from 'svelte';
	import { featureData } from '../state';

	export let bounds = [[-125, 24], [-66, 51]];
	export let visibleIndex;
	export let mapStyle;

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
				style: mapStyle || 'mapbox://styles/mapbox/dark-v10',
				center: [0, 0],
				zoom: 9,
                interactive: false
				// pitch: 85,
				// bearing: 80,
			});

			map.fitBounds(bounds, { animate: false, padding: 30 });
			map.setMaxBounds(map.getBounds());
			mapBounds = map.getBounds();


            map.on('load', () => {

            });

			map.on('click', async (e) => {

				
			});
        };

		document.head.appendChild(link);

		return () => {
			map.remove();
			link.parentNode.removeChild(link);
		};
	});



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

</script>

<!-- <svelte:window on:resize={handleResize} /> -->

<div style="opacity: {visibleIndex ? 1 : 0}" bind:this={container}>
	{#if map}
		<slot />
	{/if}
</div>

<style>
	div {
		position: absolute;
		width: 25rem;
		height: 17rem;
        top: 2rem;
        left: 2rem;
        z-index: 10;
        border-radius: 3px;
        opacity: 0.9;
	}
</style>
