
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

    import Map from './components/Map.svelte';
    // import riversData from '../data/rivers_simplified.json';

    // export let riversData;

    // const riversGeo = topojson.feature(riversData, riversData.objects.rivers).features;

    const dataLoad = d3.json("data/detailed_rivers_streams_simplified.json").then( data => {
        const riversGeo = topojson.feature(data, data.objects.rivers).features;
        return riversGeo.filter(river => river.geometry);
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
    <p>Loading Data...</p>
{:then riversGeo}
    <Map bounds={getDataBounds(riversGeo)} featureData={riversGeo} visibleIndex={1} addTopo={true} mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"}/>
{/await}
