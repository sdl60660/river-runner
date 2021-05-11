<script>
    import { onMount } from 'svelte';
    import { coordinates, riverPath, currentLocation, vizState } from '../state';

    let message = "Click to drop a raindrop anywhere on the contiguous United States and watch where it ends up";

    onMount(() => {
        const unsubscribeLocation = currentLocation.subscribe(coordinates => {
            if (coordinates?.lat) {
                message = `Finding downstream flow path from [${coordinates.lng.toFixed(3)}, ${coordinates.lat.toFixed(3)}]...`;
            }
        })

        const unsubscribeState = vizState.subscribe(state => {
            if (state === "running") {
                message = "";
            }
            else if (state === "uninitialized") {
                message = "Click to drop a raindrop anywhere on the contiguous United States and watch where it ends up";
            }
        })
    })

</script>


<style>

    .message-box {
        position: absolute;
        z-index: 20;
        background-color: rgba(248, 248, 248, 0.8);
        padding: 1rem;
        border-radius: 10px;
        left: 50%;
        transform: translateX(-50%);
        top: 1rem;
    }

</style>

<div style={`display: ${message === "" ? "none" : "block"};`} class="message-box">{message}</div>

