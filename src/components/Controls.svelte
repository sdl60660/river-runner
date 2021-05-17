<script>
    // import Slider from './Slider.svelte';
    export let altitudeMultiplier;
    export let setAltitudeMultipier;

</script>

<style>
    .wrapper {
        background-color: rgba(221, 221, 221, 0.89);
        padding: 0.5rem 1rem;
        border-radius: 4px;

        position: absolute;
        right: 2rem;
        top: 40%;
        z-index: 20;
    }

    input {
        padding: 0;
    }

</style>

<div class="wrapper">
    <label for="altitude">Camera Altitude</label>
    <input type="range" id="altitude" name="altitude" min="0.7" max="5" step="0.02" value={altitudeMultiplier} on:input={(e) => setAltitudeMultipier(e)}>
</div>
