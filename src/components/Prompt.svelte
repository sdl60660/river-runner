<script>
  import { Moon } from "svelte-loading-spinners";
  import { stoppingFeature, startLocation } from "../state";

  import config from "../config.json";

  export let currentLocation;
  export let vizState;
  export let errorStatus;
  export let bannerVisible;

  let windowWidth;

  let loading = false;
  let eventActionName =
    windowWidth > config.mobile_breakpoint ? "Click" : "Tap";
  let message = `${eventActionName} to drop a raindrop anywhere in the world and watch where it ends up`;

  $: if (currentLocation?.lat && message !== "") {
    findLocation({ coordinates: currentLocation });
  }

  $: if (vizState === "running") {
    message = "";
    loading = false;
  } else if (vizState === "overview") {
    message =
      windowWidth > config.mobile_breakpoint
        ? ""
        : "Run the path again, copy a link to share, or exit and try another path using the buttons below.";
    loading = false;
  } else if (vizState === "uninitialized") {
    resetPrompt();
  } else if (vizState === "error") {
    if (errorStatus?.status === "API error") {
      message =
        "Routing Server is down! Sorry, this is likely due to high volume, try again in a bit.";
    } else {
      message =
        "Unable to find a flowpath for that location. Please try somewhere else.";
    }
    loading = false;
  }

  const findLocation = async ({ coordinates }) => {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates.lng},${coordinates.lat}.json?access_token=pk.eyJ1Ijoic2FtbGVhcm5lciIsImEiOiJja2IzNTFsZXMwaG44MzRsbWplbGNtNHo0In0.BmjC6OX6egwKdm0fAmN_Nw`
    );
    const addressData = await response.json();

    const placeName = addressData.features.find((d) =>
      d.place_type.includes("place")
    )?.text;
    const countyName = addressData.features.find((d) =>
      d.place_type.includes("district")
    )?.text;
    const stateName = addressData.features.find((d) =>
      d.place_type.includes("region")
    )?.text;
    const countryName = addressData.features.find((d) =>
      d.place_type.includes("country")
    )?.text;

    const place = placeName || countyName;
    const locationStringComponents = [place, stateName, countryName].filter(
      (d) => d
    );

    const fullLocationString =
      locationStringComponents.length > 0
        ? locationStringComponents.join(", ")
        : "Unknown Territory";

    startLocation.update(() => fullLocationString);

    message = `Finding downstream path from ${fullLocationString}`;
    loading = true;
  };

  const resetPrompt = () => {
    message = `${eventActionName} to drop a raindrop anywhere in the world and watch where it ends up`;
    loading = false;
  };

  const displayCountryError = () => {
    message =
      "Sorry! Can only trace from points in the contiguous United States.";
    loading = false;
    setTimeout(() => {
      resetPrompt();
    }, 2500);
  };
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div
  class="wrapper"
  style="display: {bannerVisible ? 'none' : 'block'};"
  tabindex="0"
  aria-label="prompt and information box"
>
  <div
    style={`display: ${message === "" ? "none" : "flex"};`}
    class="message-box"
  >
    <div class="message-text">{message}</div>
    <span class="spinner" style={`display: ${loading ? "block" : "none"};`}>
      <Moon size="20" color="#141414" unit="px" duration="1s" />
    </span>
  </div>

  <div
    style="display:{vizState === 'uninitialized' &&
    loading === false &&
    windowWidth > config.mobile_breakpoint
      ? 'block'
      : 'none'};"
    class="scroll-helper"
  >
    (scroll or pinch to zoom)
  </div>
</div>

<style type="text/scss">
  @import "../settings.scss";

  .wrapper {
    font-family: "Roboto", "Inter", Arial, Helvetica, sans-serif;

    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    position: absolute;
    z-index: 20;
    left: 50%;
    transform: translateX(-50%);
    top: 1rem;
  }

  .message-box {
    background-color: rgba(243, 243, 243, 0.856);
    padding: 1rem;
    border-radius: 3px;

    display: flex;
    box-shadow: 4px 2px 2px rgba(56, 56, 56, 0.925);

    font-family: "Roboto", "Inter", Arial, Helvetica, sans-serif;
  }

  /* .spinner {
        margin-left: 20px;
    } */

  .message-text {
    margin: auto 8px;
  }

  .scroll-helper {
    color: white;
    text-align: center;
    font-size: 0.85rem;
  }

  /* Mobile */
  @media only screen and (max-width: $mobile-breakpoint) {
    .scroll-helper {
      display: none;
    }

    .wrapper {
      top: 0;
      left: 0;
      border-radius: 0;
      transform: unset;
    }

    .message-box {
      padding: 1rem 2rem;
      width: calc(100% - 4rem);
      height: calc(20vh - 2rem);

      box-shadow: unset;

      font-size: 1rem;
    }

    .spinner {
      position: absolute;
      right: 10%;
      bottom: 15%;
    }
  }

  /* Keyboard open */
  @media only screen and (max-width: $mobile-breakpoint) and (max-height: 400px) {
    .message-box {
      opacity: 0 !important;
      z-index: -100;
    }
  }

  /* Tablet */
  @media only screen and (min-width: 701px) and (max-width: 1100px) {
    .wrapper {
      top: 1.5rem;
      transform: translateX(-85%);
    }
  }
</style>
