<script>
  import resize from "svelte-actions-resize";
  import { onMount, createEventDispatcher } from "svelte";
  import { stoppingFeature, startLocation } from "../state";
  import { mapbox } from "../mapbox.js";
  import { tick } from "svelte";
  import bbox from "@turf/bbox";
  import { lineString } from "@turf/helpers";

  import CloseButton from "./CloseButton.svelte";

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
  export let startCoordinates;

  export let suggestionModalActive;

  const maxZoom = 2.8;

  let width = 0;

  let container;
  let map;

  let marker = null;
  let markerEl;

  let suggestionFormData = {};
  let userEmail = "";

  let currentStartLocation = null;
  let currentStoppingFeature = null;

  $: containerWidth = width > 700 ? "26rem" : "100%";
  $: containerHeight = width > 700 ? "14rem" : "20vh";

  const mainPathLayerID = "locator-path";
  const colorPalette = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
  ];

  const dispatch = createEventDispatcher();

  const hideSuggestionModal = () => {
    const suggestionData = Object.values(suggestionFormData)
      .filter((item) => item.suggested_name !== item.current_name)
      .map((data) => {
        const suggestion = {
          ...data,
          route_start: JSON.stringify(startCoordinates),
        };

        if (userEmail !== "") {
          suggestion.user_email = userEmail;
        }

        return suggestion;
      });

    fetch(
      "https://river-runner-name-suggestions.herokuapp.com/api/suggestions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(suggestionData),
      }
    );

    dispatch("hide-suggestion-modal");
    suggestionFormData = {};
  };

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
        attributionControl: false,
        // pitch: 85,
        // bearing: 80,
      });

      map.fitBounds(bounds, { animate: false, padding: 30 });

      map.on("load", () => {
        drawStateBoundaries({ map, stateBoundaries });
      });

      map.on("click", async (e) => {});

      marker = new mapbox.Marker({ element: markerEl })
        .setLngLat([0, 0])
        .addTo(map);
      
      const unsubscribeStoppingFeature = stoppingFeature.subscribe(
        (featureName) => {
          currentStoppingFeature = featureName;
        }
      );

      const unsubscribeStartLocation = startLocation.subscribe(
        (startLocation) => {
          currentStartLocation = startLocation;
        }
      );
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
    if (map && riverPath) {
      map.setMaxBounds(null);
      map.resize();

      const coordinateSet = lineString(riverPath[0].geometry.coordinates);
      const boundProps = { animate: true, padding: 30, speed: 1.2 };
      if (suggestionModalActive === false) {
        boundProps.maxZoom = maxZoom
      };
      map.fitBounds(bbox(coordinateSet), boundProps);

      map.once("moveend", () => {
        map.setMaxBounds(map.getBounds());
      });

      if (suggestionModalActive) {
        map.scrollZoom.enable();
        map.dragPan.enable();

        map.setLayoutProperty(mainPathLayerID, "visibility", "none");

        [...Array(featureGroups.length).keys()].forEach((previousIndex) => {
          map.setLayoutProperty(
            `active-path-${previousIndex}`,
            "visibility",
            "visible"
          );

          map.setPaintProperty(
            `active-path-${previousIndex}`,
            "line-color",
            colorPalette[previousIndex % colorPalette.length]
          );

          map.setPaintProperty(`active-path-${previousIndex}`, "line-width", 1);
        });
      } else {
        map.scrollZoom.disable();
        map.dragPan.disable();

        map.setLayoutProperty(mainPathLayerID, "visibility", "visible");

        [...Array(featureGroups.length).keys()].forEach((previousIndex) => {
          map.setPaintProperty(
            `active-path-${previousIndex}`,
            "line-color",
            "yellow"
          );

          map.setPaintProperty(`active-path-${previousIndex}`, "line-width", 2);

          map.setLayoutProperty(
            `active-path-${previousIndex}`,
            "visibility",
            "none"
          );
        });

        map.setLayoutProperty(
          `active-path-${activeFeatureIndex}`,
          "visibility",
          "visible"
        );
      }
    }
  };

  const handleKeyDown = (event) => {
    if (
      (event.key === "Escape" || event.key === "Enter") &&
      suggestionModalActive
    ) {
      hideSuggestionModal();
    }
  };

  const updateFormData = (event, currentName, nameid) => {
    suggestionFormData[nameid] = {
      nameid,
      suggested_name: event.target.value,
      current_name: currentName,
      has_existing_name: !currentName.startsWith("Unidentified River"),
    };
  };

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
    map.setMaxBounds(null);
    map.fitBounds(bbox(coordinateSet), {
      animate: false,
      padding: 30,
      maxZoom,
    });
  }

  $: if (featureGroups.length > 0) {
    // Remove any possible lingering layers from a previous path
    [...Array(20).keys()].forEach((index) => {
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
</script>

<svelte:window bind:innerWidth={width} on:keydown={handleKeyDown} />

{#if visibleIndex && suggestionModalActive}
  <div class="clickable-underlay" on:click={hideSuggestionModal} />
{/if}

<div
  class="map"
  style="
    z-index: {visibleIndex ? (suggestionModalActive ? 50 : 10) : -10};
    opacity: {!visibleIndex ? 0.0 : width > 700 ? 0.9 : 1.0};
    width: {suggestionModalActive ? 'calc(100vw - 4rem)' : containerWidth};
    height: {suggestionModalActive ? 'calc(100vh - 4rem)' : containerHeight};
    "
  bind:this={container}
  use:resize
  on:resize={handleResize}
  aria-label={`Inset map showing the flowpath from ${currentStartLocation} to ${currentStoppingFeature}.`}
  tabindex="0"
>
  {#if map}
    <slot />
  {/if}

  {#if visibleIndex && suggestionModalActive}
    <form
      class="suggestion-feature-list"
      on:submit|preventDefault={hideSuggestionModal}
    >
      <p class="instructions">
        The data this tool uses is incomplete! If you know the name(s) of any of
        the unidentified rivers, you can help by making suggestions in the boxes
        below.
      </p>
      <div class="feature-inputs">
        {#each featureGroups as feature, i}
          <input
            type="text"
            value={feature.name}
            id={feature.levelpathi}
            class="suggestion-feature"
            style="
            border: 3px solid {colorPalette[
              i % colorPalette.length
            ]} !important;
            "
            on:mouseenter={() => {
              map.setPaintProperty(`active-path-${i}`, "line-width", 5);
            }}
            on:mouseleave={() => {
              map.setPaintProperty(`active-path-${i}`, "line-width", 1);
            }}
            on:input={(e) =>
              updateFormData(e, feature.name, feature.levelpathi)}
          />
        {/each}
      </div>
      <input
        type="text"
        placeholder="Your Email (optional)"
        id={"submitter-email"}
        bind:value={userEmail}
      />
      <button
        class="submit-button"
        type="submit"
        on:click={hideSuggestionModal}
        on:keydown={handleKeyDown}
      >
        Submit
      </button>
    </form>

    <CloseButton callback={hideSuggestionModal} />
  {/if}
</div>

<div
  class="marker"
  style="z-index: {visibleIndex ? 10 : -10}; opacity: {!visibleIndex
    ? 0.0
    : width > 700
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
    overflow: visible !important;
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

  .suggestion-feature-list {
    position: absolute;
    right: 15px;
    top: 15px;
    color: black;
    /* background-color: white; */
    display: flex;
    flex-direction: column;
    gap: 0;
    z-index: 20;
    max-width: 300px;
  }

  .suggestion-feature-list .submit-button {
    font-size: 0.9rem;
    cursor: pointer;
  }

  .suggestion-feature-list input {
    width: 100%;
    box-sizing: border-box;
    font-size: 0.9rem;
  }

  .feature-inputs {
    margin-bottom: 15px;
  }

  .instructions {
    font-size: 0.9rem;
    background-color: white;
    width: 100%;
    padding: 10px;
    box-sizing: border-box;
    border-radius: 2px;
    line-height: 1.25;
    font-family: "Roboto", "Inter", Arial, Helvetica, sans-serif;
    margin: 10px 0 15px;
  }

  .clickable-underlay {
    position: absolute;

    height: 100vh;
    width: 100vw;
    opacity: 0;
    z-index: 0;

    margin-top: -2rem;
    margin-left: -2rem;
  }

  /* Mobile */
  @media only screen and (max-width: 700px) {
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
  @media only screen and (max-width: 700px) and (max-height: 400px) {
    .map {
      opacity: 0 !important;
      z-index: -100;
    }
  }

  /* Tablet */
  @media only screen and (min-width: 701px) and (max-width: 1100px) {
    .map {
      width: 20.4rem;
      height: 11rem;
    }
  }
</style>
