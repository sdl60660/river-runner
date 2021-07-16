<script>
	import * as d3 from 'd3';
	import * as topojson from "topojson-client";

	import Map from './components/Map.svelte';
	import Loader from './components/Loader.svelte';

	// import { stateAbbreviations } from './utils';
	import SplashBanner from './components/SplashBanner.svelte';

	let bannerVisible = true;

	// const getActiveNWISSites = async (stateAbbreviation) => {
	// 	const requestURL = `https://waterservices.usgs.gov/nwis/site/?format=gm,1.0&stateCd=${stateAbbreviation}&period=P7D&outputDataTypeCd=iv&parameterCd=00060&siteType=ST&siteStatus=active&hasDataTypeCd=iv`;
	// 	const response = await d3.xml(requestURL);
	// 	const stateIDs = [...response.documentElement.getElementsByTagName("Placemark")];

	// 	return stateIDs.map(a => a.getAttribute("id"));
	// }

	const dataFilePromises = [
		d3.json("data/us_states.json"),
		d3.json("data/stopping_features.json"),
		d3.json("data/active_nwis_sites.json"),
		// d3.csv("data/compressed_flowrate.csv")
		// ...stateAbbreviations.map(state => getActiveNWISSites(state.toLowerCase()))
	]

	const dataLoad = Promise.all(dataFilePromises).then( async (data) => {
		const states = topojson.feature(data[0], data[0].objects.states).features;
		const stoppingFeatures = topojson.feature(data[1], data[1].objects.stopping_features).features;

		const activeNWISSites = data[2].sites;
		// const activeNWISSites = data.slice(2).flat();
		
		return [states, stoppingFeatures, activeNWISSites];
	})

	const closeBanner = () => {
		bannerVisible = false;
	}
</script>

{#await dataLoad}
    <Loader />
{:then data }
	<SplashBanner
		{bannerVisible}
		on:close-banner={closeBanner}
	/>
	<Map
		bounds={[[-125, 24], [-66, 51]]}
		stateBoundaries={data[0]}
		stoppingFeatures={data[1]}
		activeNWISSites={data[2]}
		visibleIndex={1}
		addTopo={true}
		mapStyle={"mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y"}
		{bannerVisible}
		{closeBanner}
	/>
{/await}