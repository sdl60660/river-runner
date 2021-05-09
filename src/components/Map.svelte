<script>
	import { onMount, setContext } from 'svelte';
	import { mapbox } from '../mapbox.js';
	import { bearingBetween, roundToDigits } from '../utils';

	import { tick } from 'svelte';
	import { coordinates } from '../state';

	export let bounds;
	export let featureData;
	export let coordinateQuadtree;
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

            map.on('load', () => {
				addRivers({ map, featureData, lineWidth: 2 });

				if (addTopo) {
					addTopoLayer({ map });
				}
            });

			map.on('click', (e) => {
				// Search quadtree for closest river coordiate to click location
				const originPoint = coordinateQuadtree.find(e.lngLat.lat, e.lngLat.lng, 5);
				// console.log('Clicked on:', e.lngLat, 'Closest point:', originPoint);

				// Find the river that this coordinate belongs to, using the coordinate's feature_id
				const river = featureData.slice(Math.max(0, originPoint.feature_id - 200), originPoint.feature_id)
										 .find(a => a.properties.OBJECTID === +originPoint.feature_id);

				// Find where this coordinate sits in the river
				const coordinateIndex = river.geometry.coordinates.findIndex(([lng, lat]) => {
					// There's some discrepancies between coordinate pairs on the feature objects and in the coordinate dataset because of types/rounding
					return roundToDigits(lng, 5) === +originPoint.lng && roundToDigits(lat, 5) === +originPoint.lat;
				});

				// Determine the bearing from this coordinate to the river's next point
				// NOTE: this will break for now if coordinate is last one of river, but that will get fixed once river network flow is mapped
				const bearing = bearingBetween( [ originPoint.lng, originPoint.lat ], river.geometry.coordinates[coordinateIndex+1] );
				// console.log('River', river, 'Coordinate Index', coordinateIndex, 'Total Coordinates:', river.geometry.coordinates.length, 'Bearing:', bearing );
				
				// Fly to clicked point and pitch camera
				flyToPoint({ map, center: originPoint, bearing });
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
