<script>
  export let activeFeatureIndex;
  export let vizState;
  export let featureGroupLength;

  export let paused;
  export let togglePause;

  export let playbackSpeed;
  export let setPlaybackSpeed;

  export let jumpIndex;

  export let altitudeMultiplier;
  export let setAltitudeMultipier;
</script>

<div
  class="wrapper"
  style="display: {activeFeatureIndex >= 0 && vizState === 'running'
    ? 'grid'
    : 'none'};"
>
  <div class="button-wrapper">
    <button
      class="control-button skip-back-button"
      class:button-active={false}
      on:click={() => {
        jumpIndex("backward");
      }}
      disabled={activeFeatureIndex <= 0}
      ><img
        class="svg-icon-img"
        src="/images/skip-back.svg"
        alt="skip back button"
      /></button
    >
    <button
      class="control-button rewind-button"
      class:button-active={playbackSpeed === -1}
      on:click={() => setPlaybackSpeed(-1)}
      ><img
        class="svg-icon-img"
        src="/images/rewind.svg"
        alt="rewind button"
      /></button
    >
    <button class="control-button pause-button" on:click={togglePause}
      ><img
        class="svg-icon-img"
        src={paused || playbackSpeed !== 1
          ? "/images/play.svg"
          : "/images/pause.svg"}
        alt={paused || playbackSpeed !== 1 ? "play button" : "pause button"}
      /></button
    >
    <!-- <button class="control-button slow-button" class:button-active={playbackSpeed === 0.5} on:click={() => { console.log("slow motion") }}><img class="svg-icon-img" src="/images/slow-motion.svg" alt={"slow motion button"} /></button> -->
    <button
      class="control-button fastforward-button"
      class:button-active={playbackSpeed === 2}
      on:click={() => setPlaybackSpeed(2)}
      ><img
        class="svg-icon-img"
        src="/images/fast-forward.svg"
        alt="fast-forward button"
      /></button
    >
    <button
      class="control-button skip-forward-button"
      class:button-active={false}
      on:click={() => {
        jumpIndex("forward");
      }}
      disabled={activeFeatureIndex >= featureGroupLength - 1}
      ><img
        class="svg-icon-img"
        src="/images/skip-forward.svg"
        alt="skip forward button"
      /></button
    >
  </div>

  <div class="detail-speed-slider">
    <input
      type="range"
      id="altitude"
      name="altitude"
      min="0.6"
      max="5"
      step="0.01"
      value={altitudeMultiplier}
      on:input={(e) => setAltitudeMultipier(e)}
    />
    <div class="slider-label slider-label-left">More Detail</div>
    <div class="slider-label slider-label-right">Faster</div>
  </div>
</div>

<style>
  .wrapper {
    background-color: rgba(221, 221, 221, 0.89);
    padding: 0.5rem 0.8rem;
    border-radius: 4px;

    /* position: absolute; */
    /* right: 3rem; */
    /* top: 40%; */
    /* z-index: 20; */
    /* display: grid; */
    grid-gap: 0.4rem;
    grid-template-columns: 1fr;
    justify-items: center;
    align-items: center;
  }

  .detail-speed-slider {
    display: grid;
    grid-template-columns: 2fr 1fr 2fr;
    font-size: 0.8rem;
    width: 100%;
  }

  .control-button {
    padding: 0.5rem;
    border-radius: 8rem;
    /* border: 1px solid black; */
    width: 2.5rem;
    height: 2.5rem;
    font-weight: bold;
    cursor: pointer;
    margin: auto;
    border: unset;
  }

  #altitude {
    padding: 0;
    width: 100%;
    grid-column: 1 / 4;
  }

  .slider-label-left {
    grid-column: 1 / 2;
    justify-self: left;
  }

  .slider-label-right {
    grid-column: 3 / 4;
    justify-self: right;
  }

  .button-wrapper {
    display: flex;
    gap: 4px;
  }

  .button-active {
    background-color: rgb(205 179 143);
    border: 1px solid black;
  }

  .svg-icon-img {
    height: 100%;
    width: auto;
    margin: auto;
  }

  /* .slow-button {
    height: 1rem;
    width: 1rem;
    position: absolute;
  } */

  .skip-back-button,
  .skip-forward-button {
    display: none;
  }

  @media only screen and (max-width: 700px) {
    /* .slow-button {
      display: none;
    } */

    .detail-speed-slider {
      display: none;
    }

    .wrapper {
      background-color: none;
    }

    .button-wrapper {
      z-index: 30;
      position: absolute;
      left: 50%;
      bottom: 7vh;
      transform: translate(-50%, 50%);
      gap: 1.5rem;
      /* display: none; */
    }

    .control-button {
      /* padding: 0.2rem; */
      border-radius: 8rem;
      /* border: 1px solid black; */
      width: 2.5;
      height: 2.5rem;
      font-weight: bold;
      /* font-size: 0.8rem; this is just until I replace the pause icon with an svg */
      cursor: pointer;
      margin: auto;
      border: 1px solid black;
    }

    .svg-icon-img {
      height: 90%;
      width: auto;
      margin: auto;
    }

    .skip-back-button,
    .skip-forward-button {
      display: block;
    }

    .skip-back-button img,
    .skip-forward-button img {
      height: 80%;
    }
  }

  /* Tablet */
  @media only screen and (min-width: 701px) and (max-width: 1100px) {
    .wrapper {
      margin-top: auto;
    }
  }
</style>
