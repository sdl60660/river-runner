<script>
    import * as d3 from 'd3';
    import { onMount } from 'svelte';
    import * as topojson from "topojson-client";

	import { contructCoordinateQuadtree } from './utils';

    import Map from './components/Map.svelte';
	import Loader from './components/Loader.svelte';
	import LocatorMap from './components/LocatorMap.svelte';


	const dataFilePromises = [
		d3.tsv("data/huc_names.tsv"),
		d3.json("data/us_states.json")
	]

	const dataLoad = Promise.all(dataFilePromises).then( data => {
		const basinMap = new Map(data[0].map(i => [i.huc, i.basin]));
		const states = topojson.feature(data[1], data[1].objects.states).features;
		
		return [basinMap, states];
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
	<LocatorMap bounds={[[-125, 25], [-67, 50]]} visibleIndex={null} stateBoundaries={data[1]} />
	<Map bounds={[[-125, 24], [-66, 51]]} basins={data[0]} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"} />
    <!-- <Map bounds={getDataBounds(data[0])} coordinateQuadtree={data[1]} featureData={data[0]} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"}/> -->
{/await}