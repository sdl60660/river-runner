<script>
  import resize from 'svelte-actions-resize';
  import { onMount } from "svelte";
  import { mapbox } from "../mapbox.js";
  import { tick } from "svelte";
  import bbox from "@turf/bbox";
  import { lineString } from "@turf/helpers";

  export let bounds = [
    [-125, 24],
    [-66, 51],
  ];
  export let visibleIndex;
  export let mapStyle;
  export let stateBoundaries;

  export let riverPath;
  export let currentLocation;
  export let vizState;

  export let featureGroups;
  export let activeFeatureIndex;

  const maxZoom = 2.8;

  let width = 0;

  let container;
  let map;

  let marker = null;
  let markerEl;

  let containerWidth = "26rem";
  let containerHeight = "14rem";

  const mainPathLayerID = "locator-path";

  $: visibleIndex = vizState === "running" ? 1 : null;
  $: if (riverPath && map) {
    drawFlowPath({ map, featureData: riverPath, sourceID: mainPathLayerID });
  }
  $: if (map && currentLocation && currentLocation !== undefined) {
    plotCurrentLocation({ map, location: currentLocation });
  } else if (marker) {
    marker.remove();
  }
  $: if (map && riverPath) {
    const coordinateSet = lineString(riverPath[0].geometry.coordinates);
    map.fitBounds(bbox(coordinateSet), { animate: false, padding: 30 });

    if (map.getZoom() > maxZoom) {
      map.setZoom(maxZoom);
    }
  }

  $: if (featureGroups.length > 0) {
    // Remove any possible lingering layers from a previous path
    [...Array(15).keys()].forEach((index) => {
      removeLayer(`active-path-${index}`);
    });

    featureGroups.forEach(({ feature_data, index }) => {
      drawFlowPath({
        map,
        featureData: feature_data,
        sourceID: `active-path-${index}`,
        lineColor: "yellow",
        lineWidth: 2,
        visible: false,
      });
    });

    map.moveLayer(mainPathLayerID);
  }

  $: if (activeFeatureIndex !== -1 && featureGroups) {
    // Hide any other indices. Technically we should only need to hide the last one, but we'll do this as a catch-all unless it's too slow or if there's a jump
    [...Array(featureGroups.length).keys()].forEach((previousIndex) => {
      map.setLayoutProperty(
        `active-path-${previousIndex}`,
        "visibility",
        "none"
      );
    });

    // Make the current section visible, unless we're at the stopping feature
    if (activeFeatureIndex < featureGroups.length) {
      map.setLayoutProperty(
        `active-path-${activeFeatureIndex}`,
        "visibility",
        "visible"
      );
    }
  }

  onMount(async () => {
    await tick();

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/mapbox-gl/dist/mapbox-gl.css";

    link.onload = () => {
      map = new mapbox.Map({
        container,
        style: mapStyle || "mapbox://styles/mapbox/dark-v10",
        center: [0, 0],
        zoom: 9,
        interactive: false,
        // pitch: 85,
        // bearing: 80,
      });

      map.fitBounds(bounds, { animate: false, padding: 30 });
      //   map.setMaxBounds(map.getBounds());

      map.on("load", () => {
        drawStateBoundaries({ map, stateBoundaries });
      });

      map.on("click", async (e) => {});

      marker = new mapbox.Marker({ element: markerEl })
        .setLngLat([0, 0])
        .addTo(map);
    };

    document.head.appendChild(link);

    return () => {
      map.remove();
      link.parentNode.removeChild(link);
    };
  });

  const plotCurrentLocation = ({ map, location }) => {
    marker.setLngLat(location);
    marker.addTo(map);
  };

  const removeLayer = (sourceID) => {
    if (map.getLayer(sourceID)) {
      map.removeLayer(sourceID);
    }

    if (map.getSource(sourceID)) {
      map.removeSource(sourceID);
    }
  };

  const drawFlowPath = ({
    map,
    featureData,
    sourceID = "route",
    lineColor = "steelblue",
    lineWidth = 1,
    visible = true,
  }) => {
    removeLayer(sourceID);
    addRivers({ map, featureData, lineWidth, sourceID, lineColor, visible });
  };

  const addRivers = ({
    map,
    featureData,
    lineColor = "steelblue",
    lineWidth = 1,
    sourceID = "route",
    visible = true,
  }) => {
    const features = featureData.map((river) => {
      // Some rivers have multiple linestrings (such as the Mississippi)...
      // their coordinates will be a triple-nested array instead of a double-nested
      const featureType = Array.isArray(river.geometry.coordinates[0][0])
        ? "MultiLineString"
        : "LineString";

      return {
        type: "Feature",
        properties: river.properties,
        geometry: {
          type: featureType,
          coordinates: river.geometry.coordinates,
        },
      };
    });

    map.addSource(sourceID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features,
      },
    });

    map.addLayer({
      id: sourceID,
      type: "line",
      source: sourceID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
        visibility: visible ? "visible" : "none",
      },
      paint: {
        "line-color": lineColor,
        "line-width": lineWidth,
      },
    });
  };

  const drawStateBoundaries = ({
    map,
    stateBoundaries,
    sourceID = "state-boundaries",
  }) => {
    map.addSource(sourceID, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: stateBoundaries,
      },
    });

    map.addLayer({
      id: sourceID,
      source: sourceID,
      type: "line",
      paint: {
        "line-color": "rgba(222,222,222,0.7)",
        "line-width": 0.5,
      },
    });
  };

  const handleResize = () => {
    map.resize();
    const coordinateSet = lineString(riverPath[0].geometry.coordinates);
    map.fitBounds(bbox(coordinateSet), { animate: true, padding: 30 });
  }
</script>

<svelte:window bind:innerWidth={width} />

<div
  class="map"
  style="
    z-index: {visibleIndex ? 10 : -10};
    opacity: {!visibleIndex
      ? 0.0
      : width > 600
      ? 0.9
      : 1.0};
    width: {containerWidth};
    height: {containerHeight};
    "
  bind:this={container}
  use:resize
  on:resize={handleResize}
>
  {#if map}
    <slot />
  {/if}
</div>

<div
  class="marker"
  style="z-index: {visibleIndex ? 10 : -10}; opacity: {!visibleIndex
    ? 0.0
    : width > 600
    ? 0.9
    : 1.0};"
  bind:this={markerEl}
/>

<style>
  .map {
    /* width: 26rem;
    height: 14rem; */
    border-radius: 3px;
    opacity: 0.9;
    /* transition: height 1s linear, width 1s linear; */
  }

  .marker {
    background-color: red;
    opacity: 0.7;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    /* cursor: pointer; */
  }

  /* Mobile */
  @media only screen and (max-width: 600px) {
    .map {
      position: absolute;
      width: 100%;
      height: 20vh;
      top: 0;
      left: 0;
      border-radius: 0;
      opacity: 1;
    }
  }

  /* Keyboard open */
  @media only screen and (max-width: 600px) and (max-height: 400px) {
    .map {
      opacity: 0 !important;
      z-index: -100;
    }
  }

  /* Tablet */
  @media only screen and (min-width: 601px) and (max-width: 1100px) {
    .map {
      width: 20.4rem;
      height: 11rem;
    }
  }
</style>
