<script>
  import * as d3 from "d3";
  import * as topojson from "topojson-client";

  import Map from "./components/Map.svelte";
  import Loader from "./components/Loader.svelte";


  const dataFilePromises = [
    d3.json("data/us_states.json"),
    d3.json("data/stopping_features.json"),
    d3.json("data/active_nwis_sites.json"),
  ];

  const dataLoad = Promise.all(dataFilePromises).then(async (data) => {
    const states = topojson.feature(data[0], data[0].objects.states).features;
    const stoppingFeatures = topojson.feature(
      data[1],
      data[1].objects.stopping_features
    ).features;

    const activeNWISSites = data[2].sites;

    return [states, stoppingFeatures, activeNWISSites];
  });
</script>

{#await dataLoad}
  <Loader />
{:then data}
  <Map
    bounds={[
      [-125, 24],
      [-66, 51],
    ]}
    stateBoundaries={data[0]}
    stoppingFeatures={data[1]}
    activeNWISSites={data[2]}
    visibleIndex={1}
    addTopo={false}
    mapStyle={"mapbox://styles/samlearner/cl102hmrx002o14o0oa29kqfw"}
    advancedFeaturesOn={false}
  />
{/await}
