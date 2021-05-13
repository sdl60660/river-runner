<script>
    import * as d3 from 'd3';
    import { onMount } from 'svelte';
    import * as topojson from "topojson-client";

	import { contructCoordinateQuadtree } from './utils';

    import Map from './components/Map.svelte';
	import Loader from './components/Loader.svelte';
	// import LocatorMap from './components/LocatorMap.svelte';
	// import NavigationInfo from './components/NavigationInfo.svelte';


	const dataFilePromises = [
		// d3.tsv("data/huc_names.tsv"),
		d3.json("data/us_states.json"),
		d3.json("data/stopping_features.json")
	]

	const dataLoad = Promise.all(dataFilePromises).then( data => {
		// const basinMap = new Map(data[0].map(i => [i.huc, i.basin]));
		const states = topojson.feature(data[0], data[0].objects.states).features;
		const stoppingFeatures = topojson.feature(data[1], data[1].objects.stopping_features).features;
		
		return [states, stoppingFeatures];
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
	<Map bounds={[[-125, 24], [-66, 51]]} stateBoundaries={data[0]} stoppingFeatures={data[1]} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"} />
    <!-- <NavigationInfo /> -->
	<!-- <Map bounds={getDataBounds(data[0])} coordinateQuadtree={data[1]} featureData={data[0]} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"}/> -->
{/await}