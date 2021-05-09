
<!-- <script context="module">
    export const prerender = true;

    export async function preload() {
        const response = await this.fetch('data/detailed_rivers_streams_simplified.json');
        const responseJson = await response.json();
        return {
            riversData: responseJson
        }
    }
</script> -->

<script>
    import * as d3 from 'd3';
    import { onMount } from 'svelte';
    import * as topojson from "topojson-client";

	import { contructCoordinateQuadtree } from './utils';

    import Map from './components/Map.svelte';
	import Loader from './components/Loader.svelte';
    // import riversData from '../data/rivers_simplified.json';

    // export let riversData;

    // const riversGeo = topojson.feature(riversData, riversData.objects.rivers).features;

	const dataFilePromises = [
        d3.json("data/detailed_rivers_streams_simplified.json"),
		d3.csv("data/coordinate_set.csv")
    ];

    const dataLoad = Promise.all(dataFilePromises).then( data => {
        let riversGeo = topojson.feature(data[0], data[0].objects.rivers).features;
		riversGeo = riversGeo.filter(river => river.geometry);

		const quadTree = contructCoordinateQuadtree(data[1])
		// console.log(quadTree);

        return [ riversGeo, quadTree ];
    })

    const getDataBounds = (linestringData) => {
        const allCoordinates = linestringData.map(river => river.geometry.coordinates).flat();

        return [
            [d3.min(allCoordinates, d => d[0]), d3.min(allCoordinates, d => d[1])],
            [d3.max(allCoordinates, d => d[0]), d3.max(allCoordinates, d => d[1])]
        ]
    }

</script>


<!-- <Map bounds={getDataBounds(riversGeo)} featureData={riversGeo} visibleIndex={1} addTopo={true} mapStyle={'mapbox://styles/mapbox/light-v10'}/> -->

{#await dataLoad}
    <Loader />
{:then data }
    <Map bounds={getDataBounds(data[0])} coordinateQuadtree={data[1]} featureData={data[0]} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"}/>
{/await}
