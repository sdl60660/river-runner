
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
import LocatorMap from './components/LocatorMap.svelte';


	// const dataFilePromises = [
    //     d3.json("data/detailed_rivers_streams_simplified.json"),
	// 	d3.csv("data/coordinate_set.csv")
    // ];

    // const dataLoad = Promise.all(dataFilePromises).then( data => {
    //     let riversGeo = topojson.feature(data[0], data[0].objects.rivers).features;
	// 	riversGeo = riversGeo.filter(river => river.geometry);

	// 	const quadTree = contructCoordinateQuadtree(data[1])
	// 	// console.log(quadTree);

    //     return [ riversGeo, quadTree ];
    // })

	const dataFilePromises = [
		d3.tsv("data/huc_names.tsv")
	]

	const dataLoad = Promise.all(dataFilePromises).then( data => {
		const basinMap = new Map(data[0].map(i => [i.huc, i.basin]));
		console.log(basinMap);
		return [basinMap];
	})

    const getDataBounds = (linestringData) => {
        const allCoordinates = linestringData.map(river => river.geometry.coordinates).flat();

        return [
            [d3.min(allCoordinates, d => d[0]), d3.min(allCoordinates, d => d[1])],
            [d3.max(allCoordinates, d => d[0]), d3.max(allCoordinates, d => d[1])]
        ]
    }

</script>


{#await dataLoad}
    <Loader />
{:then data }
	<LocatorMap bounds={[[-125, 24], [-66, 51]]} visibleIndex={1} />
	<Map bounds={[[-125, 24], [-66, 51]]} basins={data[0]} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"} />
    <!-- <Map bounds={getDataBounds(data[0])} coordinateQuadtree={data[1]} featureData={data[0]} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"}/> -->
{/await}