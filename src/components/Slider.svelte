<script>
    import Slider from 'svelte-slider';

    export let onChangeHandler;
    export let bounds;
</script>

<style>
    :root {
        --sliderPrimary: #FF9800;
        --sliderSecondary: rgba(0, 0, 0, 0.05);
    }
</style>

<Slider on:change={(event) => onChangeHandler(event)} value={bounds} />