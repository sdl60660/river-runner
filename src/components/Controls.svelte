<script>
    export let vizState;
    export let activeFeatureIndex;

    export let paused;
    export let togglePause;

    export let playbackSpeed;
    export let setPlaybackSpeed;

    export let altitudeMultiplier;
    export let setAltitudeMultipier;

</script>

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

</style>

<div class="wrapper" style="display: {activeFeatureIndex >= 0 ? "grid" : "none"};">

    <div class="button-wrapper">
        <button class="control-button rewind-button" class:button-active={playbackSpeed === -1} on:click={() => setPlaybackSpeed(-1)}><img class="svg-icon-img" src="/images/rewind.svg" alt="rewind button"/></button>
        <button class="control-button pause-button" on:click={togglePause}>{(paused || playbackSpeed !== 1) ? "▶" : "| |"}</button>
        <button class="control-button fastforward-button" class:button-active={playbackSpeed === 2} on:click={() => setPlaybackSpeed(2)}><img class="svg-icon-img" src="/images/fast-forward.svg" alt="fast-forward button"/></button>
    </div>

    <div class="detail-speed-slider">
        <!-- <label for="altitude">Camera Altitude</label> -->
        <input type="range" id="altitude" name="altitude" min="0.6" max="5" step="0.01" value={altitudeMultiplier} on:input={(e) => setAltitudeMultipier(e)}>
        <div class="slider-label slider-label-left">More Detail</div>
        <div class="slider-label slider-label-right">Faster</div>
    </div>

</div>
