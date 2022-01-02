<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { stoppingFeature, startLocation } from "../state";
  import { copyTextToClipboard } from "../utils";

  import CloseButton from "./CloseButton.svelte";

  export let vizState;
  export let postRun;
  export let runTimeout;

  export let featureGroups = [];
  export let activeFeatureIndex;
  export let totalLength;

  export let startCoordinates;

  let visible = false;
  let screenWidth = 0;

  let currentStoppingFeature = null;
  let currentStartLocation = null;

  let copyPopupVisible = false;

  let xStart = 24;
  let yStart = 4;
  let radius = 20;

  let autoplayDisrupted = false;

  $: visible =
    vizState === "running" || vizState === "overview"
      ? true
      : vizState === "uninitialized"
      ? false
      : visible;

  const dispatch = createEventDispatcher();

  const runNavigationPath = () => {
    autoplayDisrupted = false;
    dispatch("run-path");
  };

  const exitNavigationPath = () => {
    dispatch("exit-path");
    autoplayDisrupted = false;
  };

  const highlightFeature = (featureIndex) => {
    dispatch("highlight-feature", { featureIndex });
  };

  const removeHighlight = () => {
    dispatch("remove-highlight");
  };

  const showSuggestionModal = () => {
    dispatch("show-suggestion-modal");
  };

  const setPhase = (featureIndex, coordinate) => {
    if (activeFeatureIndex >= 0) {
      dispatch("progress-set", { featureIndex, coordinate });
    }
  };

  const copyPathLink = () => {
    const urlPath = window.location.href.split("?")[0];
    copyTextToClipboard(
      `${urlPath}?lng=${startCoordinates.lng}&lat=${startCoordinates.lat}`
    );
    copyPopupVisible = true;
    setTimeout(() => {
      copyPopupVisible = false;
    }, 1200);
  };

  const disruptAutoplay = () => {
    clearTimeout(runTimeout);
    autoplayDisrupted = true;
  };

  onMount(() => {
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
  });
</script>

<svelte:window bind:innerWidth={screenWidth} />

<div
  class="navbox-wrapper"
  style={`display: ${
    visible === true &&
    (screenWidth > 700 ||
      vizState === "overview" ||
      (activeFeatureIndex >= 0 && featureGroups))
      ? "block"
      : "none"
  };`}
  tabindex="0"
  aria-label="navigation box with flowpath details"
>
  <div
    class="total-length"
    style="display: {screenWidth > 700 && totalLength ? 'block' : 'none'}"
    tabindex="0"
    aria-label="total length of flowpath"
  >
    Total Length: {Math.round(totalLength)} km
  </div>

  <div
    class="info-box"
    style="display: {screenWidth <= 700 && vizState === 'overview'
      ? 'none'
      : 'block'}"
  >
    <!-- Desktop/Tablet -->
    {#if screenWidth > 700}
      <div class="feature-listing bounding-location" tabindex="0" aria-label="starting location">
        {currentStartLocation}
      </div>
      {#each featureGroups as { name, length_km, index, first_coordinate }, i}
        <div
          style="font-weight:{index === activeFeatureIndex
            ? 'bold'
            : 'normal'};"
          key={i}
          class="feature-listing river-feature"
          class:river-feature={activeFeatureIndex >= 0 &&
            vizState === "running"}
          class:hover-feature={vizState === "overview"}
          on:click={() => setPhase(index, first_coordinate)}
          on:mouseenter={() => {
            if (vizState === "overview") {
              highlightFeature(index);
            }
          }}
          on:mouseleave={() => {
            if (vizState === "overview") {
              removeHighlight();
            }
          }}
          tabindex="0"
          aria-label="flowpath section"
        >
          {i + 1}. {name} ({length_km} km)
        </div>
      {/each}
      <div class="feature-listing bounding-location" tabindex="0" aria-label="stopping feature">
        {currentStoppingFeature}
      </div>

      {#each [currentStartLocation, ...featureGroups, currentStoppingFeature] as progressPoint, i}
        <div
          style="
                    background-color: {activeFeatureIndex + 1 === i
            ? 'rgb(76, 79, 230)'
            : activeFeatureIndex + 1 > i
            ? 'rgb(117, 117, 117)'
            : 'rgb(243, 243, 243)'};
                    top: calc(1rem + 8px + ({i /
            (featureGroups.length + 2)}*(100% - 2rem - 6px)));
                    "
          class="progress-point"
          key={i}
        />
      {/each}

      <div class="progress-bar" />

      <!-- Mobile (simpler, only displays name of current feature) -->
    {:else if activeFeatureIndex >= 0 && featureGroups}
      {#if activeFeatureIndex >= featureGroups.length}
        <div class="feature-listing">{currentStoppingFeature}</div>
      {:else}
        <div class="feature-listing">
          {featureGroups[activeFeatureIndex].name} ({featureGroups[
            activeFeatureIndex
          ].length_km} km)
        </div>
      {/if}

      {#each featureGroups as progressPoint, i}
        <div
          style="
                    background-color: {activeFeatureIndex === i
            ? 'rgb(76, 79, 230)'
            : activeFeatureIndex > i
            ? 'rgb(117, 117, 117)'
            : 'rgb(243, 243, 243)'};
                    left: {featureGroups.length === 1
            ? '50%'
            : `calc(10% + (${i / (featureGroups.length - 1)}*80%))`};
                    "
          class="progress-point"
          key={i}
        />
      {/each}
    {/if}
  </div>
  {#if activeFeatureIndex >= 0 && vizState === "running"}
    <CloseButton on:abort-run />
  {/if}

  <div
    class="pre-run-controls"
    style="display: {vizState === 'overview' ? 'flex' : 'none'}"
  >
    {#if postRun}
      <button class="control-button start-button" on:click={runNavigationPath}>
        <img
          class="svg-icon-img"
          src="/images/repeat.svg"
          alt={"restart river run"}
          title={"Restart river run"}
        />
      </button>
    {:else if autoplayDisrupted}
      <button class="control-button start-button" on:click={runNavigationPath}>
        <img
          class="svg-icon-img left-shift"
          src="/images/play.svg"
          alt={"start river run"}
          title={"Start river run"}
        />
      </button>
    {:else}
      <button class="control-button start-button" on:click={disruptAutoplay}>
        <img
          class="svg-icon-img"
          src="/images/pause.svg"
          alt={"stop river run auto-play"}
          title={"Stop river run auto-play"}
        />
        <svg class="svg-wrapper">
          <path
            class="path"
            stroke="steelblue"
            stroke-width="5px"
            fill="none"
            d={`M ${xStart},${yStart} a ${radius} ${radius} 0 1 1 0 ${
              radius * 2
            } ${radius} ${radius} 0 1 1 0 ${-radius * 2} z`}
          />
        </svg>
      </button>
    {/if}

    <button class="control-button share-button" on:click={copyPathLink}>
      <div
        class="copy-popup"
        style="display: {copyPopupVisible ? 'block' : 'none'};"
      >
        Link copied!
      </div>
      <img
        class="svg-icon-img"
        src="/images/link.svg"
        alt={"copy a link to this path"}
        title={"Share this path"}
      />
    </button>
    <button
      class="control-button exit-button"
      on:click={postRun
        ? exitNavigationPath
        : () => {
            disruptAutoplay();
            exitNavigationPath();
          }}
      ><img
        class="svg-icon-img"
        src="/images/x.svg"
        alt={"exit this path"}
        title={"Exit this path"}
      /></button
    >
  </div>
</div>
<div
  style="
    display: {screenWidth > 700 &&
  vizState === 'running' &&
  featureGroups
    .map(({ name }) => name.toLowerCase().includes('unidentified'))
    .some((d) => d)
    ? 'block'
    : 'none'};
    opacity: {vizState === 'running' && activeFeatureIndex >= 0 ? 1 : 0};
    cursor: {vizState === 'running' && activeFeatureIndex >= 0
    ? 'pointer'
    : 'default'};
    z-index: {vizState === 'running' && activeFeatureIndex >= 0
    ? 'unset'
    : -10};
    "
  class="name-suggestion-tooltip"
  on:click={vizState === "running" && activeFeatureIndex >= 0
    ? showSuggestionModal
    : () => {}}
>
  Know one of these missing river names? Make a suggestion!
</div>

<style>
  .navbox-wrapper {
    position: relative;
    /* position: absolute; */
    /* z-index: 20; */
    /* left: calc(100% - 375px); */
    /* right: 3rem; */
    /* transform: translateX(-50%); */
    /* top: 2rem; */
  }

  .info-box {
    background-color: rgba(243, 243, 243, 0.856);
    padding: 1rem;
    padding-left: 1.5rem;
    /* padding-bottom: 3rem; */
    border-radius: 3px;

    display: block;
    box-shadow: 3px 2px 2px rgba(56, 56, 56, 0.925);

    font-family: "Roboto", "Inter", Arial, Helvetica, sans-serif;
  }

  .name-suggestion-tooltip {
    display: block;
    padding: 7px;
    background-color: #c2c2a4;
    border-radius: 3px;
    margin-top: -14px;
    color: black;
    font-size: 0.85rem;
    /* cursor: pointer; */
  }

  .feature-listing {
    margin: 2px 10px;
    padding-top: 2px;
    padding-bottom: 2px;
    font-size: 0.95rem;
  }

  .river-feature {
    cursor: pointer;
  }

  .river-feature:hover {
    color: rgb(76, 79, 230);
    font-weight: 600;
  }

  .hover-feature:hover {
    color: yellow;
    font-weight: 700;
    cursor: default;
  }

  .progress-bar {
    position: absolute;
    z-index: 25;
    top: 1rem;
    left: 15px;
    height: calc(100% - 2rem);
    width: 6px;
    background-color: rgba(56, 56, 56, 0.96);
    border-radius: 10px;
  }

  .bounding-location {
    /* background-color: rgba(56, 56, 56, 0.96); */
    /* color: white; */

    background-color: white;
    border: 1px solid rgb(56, 56, 56);
    border-radius: 2px;

    padding-left: 6px;
    padding-right: 6px;
    border-radius: 2px;
    display: inline-block;
  }

  .progress-point {
    position: absolute;
    z-index: 30;

    left: 18px;
    transform: translate(-50%, 0);

    border: 0.5px solid rgba(90, 90, 90, 0.815);
    border-radius: 13px;
    height: 13px;
    width: 13px;
  }

  .total-length {
    font-weight: 600;
    position: absolute;
    color: white;

    /* width: 100%; */
    text-align: center;
    margin: 3px 0 0 3px;

    top: -5px;
    transform: translate(0, -100%);

    /* bottom: 0.5rem; */
  }

  .pre-run-controls {
    position: absolute;
    display: flex;
    width: calc(100% - 2rem);
    margin-left: 1rem;
  }

  .control-button {
    /* position: absolute; */
    /* bottom: 0; */
    /* padding: 0.2rem; */
    border-radius: 8rem;
    /* border: 1px solid black; */
    width: 2.5rem;
    height: 2.5rem;
    font-weight: bold;
    /* font-size: 0.8rem; this is just until I replace the pause icon with an svg */
    cursor: pointer;
    margin: auto;
    border: 1px solid black;

    transform: translate(0, -30%);
  }

  .svg-icon-img {
    height: 100%;
    width: auto;
  }

  .left-shift {
    margin-left: 2px;
  }

  .copy-popup {
    position: absolute;
    bottom: 0;
    left: 50%;
    font-size: 0.8rem;
    font-family: "Courier New";
    background-color: white;
    border: 1px solid black;
    padding: 2px;
    width: 8rem;
    transform: translate(-50%, 110%);
    border-radius: 2px;
    opacity: 0.95;
  }

  .svg-wrapper {
    position: absolute;
    left: -5px;
    top: -5px;
    width: 50px;
    height: 50px;
    z-index: 100;
  }

  .path {
    stroke-dasharray: 125.6;
    stroke-dashoffset: 125.6;
    animation: dash 5s linear forwards;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 0;
    }
  }

  /* Mobile */
  @media only screen and (max-width: 700px) {
    .pre-run-controls {
      display: none;
    }

    .navbox-wrapper {
      position: absolute;
      z-index: 20;
      right: 1.3rem;
      left: 1.3rem;
      top: 18vh;
      /* transform: translate(-50%, -50%); */
    }

    .info-box {
      background-color: rgba(243, 243x, 243, 0.9);
      z-index: 20;
      border: 1px solid black;
      font-size: 1rem;
      /* width: 70vw; */
      padding: 0.5rem 1rem;
      box-shadow: unset;
    }

    .feature-listing {
      font-weight: bold;
      margin: auto;
      text-align: center;
      cursor: unset;
    }

    .progress-point {
      left: unset;
      bottom: 0;
      transform: translate(-50%, 50%);
      height: 10px;
      width: 10px;
    }
  }

  /* Tablet */
  @media only screen and (min-width: 701px) and (max-width: 1100px) {
    .navbox-wrapper {
      /* right: 3rem; */
    }
  }
</style>
