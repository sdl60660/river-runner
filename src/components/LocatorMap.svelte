<script>
	import { onMount } from 'svelte';
	import { mapbox } from '../mapbox.js';

	import { tick } from 'svelte';
	import { riverPath, currentLocation, vizState } from '../state';

	export let bounds = [[-125, 24], [-66, 51]];
	export let visibleIndex;
	export let mapStyle;
    export let stateBoundaries;

	console.log(bounds);

	let container;
	let map;
	let mapBounds = bounds;
    
    let marker = null;
    let markerEl;

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

			map.fitBounds(bounds, { animate: false, padding: 6 });
			map.setMaxBounds(map.getBounds());
			mapBounds = map.getBounds();


            map.on('load', () => {

                drawStateBoundaries({ map, stateBoundaries })

            });

			map.on('click', async (e) => {
				
			});

            const unsubscribeRiverPath = riverPath.subscribe(featureData => {
                if (featureData) {
                    drawFlowPath({ map, featureData, sourceID: 'locatorPath' });
                }
            });

            const unsubscribeLocation = currentLocation.subscribe(location => {
                if (location) {
                    // visibleIndex = 1;
                    plotCurrentLocation({ map, location });
                } 
                else if (marker) {
                    marker.remove();
                }

                // if (location && !location.lat) {
                //     visibleIndex = 1;
                // }
            });

            // marker = new mapbox.Marker()
            marker = new mapbox.Marker({element: markerEl})
                .setLngLat([0,0])
                .addTo(map);
        };

		document.head.appendChild(link);

		const unsubscribeVizState = vizState.subscribe(state => {
			visibleIndex = state === "running" ? 1 : null;
		});

		return () => {
			map.remove();
			link.parentNode.removeChild(link);
		};
	});

    const plotCurrentLocation = ({ map, location }) => {
        marker.setLngLat(location);
        marker.addTo(map);
    }

	const drawFlowPath = ({ map, featureData }) => {
		const sourceID = 'route'

		if (map.getLayer(sourceID)) {
			map.removeLayer(sourceID);
		}

		if (map.getSource(sourceID)) {
			map.removeSource(sourceID);
		}
		
		addRivers({ map, featureData, lineWidth: 1, sourceID });
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

    const drawStateBoundaries = ({ map, stateBoundaries, sourceID='state-boundaries' }) => {

        map.addSource(sourceID, {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': stateBoundaries
            }
        });

        map.addLayer({
            id: sourceID,
            source: sourceID,
            type: 'line',
            paint: {
                'line-color': 'rgba(222,222,222,0.7)',
                'line-width': 0.5
            }
        })
    }

</script>

<style>
	.map {
		position: absolute;
		width: 26rem;
		height: 14rem;
        top: 2rem;
        left: 2rem;
        /* z-index: 10; */
        border-radius: 3px;
        opacity: 0.9;
	}

    .marker {
        background-color: red;
        opacity: 0.7;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        /* cursor: pointer; */
    }

	@media only screen and (max-width: 600px) {
		.map {
			width: 100%;
			height: 12rem;
			top: 0;
			left: 0;
		}
	}

</style>


<!-- <svelte:window on:resize={handleResize} /> -->

<div class="map" style="opacity: {visibleIndex ? 1 : 0}; z-index: {visibleIndex ? 10 : -10}" bind:this={container}>
	{#if map}
		<slot />
	{/if}
</div>

<div class="marker" bind:this={markerEl}></div>