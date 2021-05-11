<script>
    import { onMount } from 'svelte';
    import { Moon } from 'svelte-loading-spinners';
    import { coordinates, riverPath, currentLocation, vizState } from '../state';

    let loading = false;
    let message = "Click to drop a raindrop anywhere on the contiguous United States and watch where it ends up";

    // let state = "uninitialized"; 


    onMount(() => {
        const unsubscribeLocation = currentLocation.subscribe(coordinates => {
            if (coordinates?.lat) {
                message = `Finding downstream flow path from [${coordinates.lng.toFixed(3)}, ${coordinates.lat.toFixed(3)}]`;
                loading = true;
            }
        })

        const unsubscribeState = vizState.subscribe(state => {
            if (state === "running") {
                message = "";
                loading = false;
            }
            else if (state === "uninitialized") {
                message = "Click to drop a raindrop anywhere on the contiguous United States and watch where it ends up";
            }
        });

    })

</script>


<style>

    .message-box {
        background-color: rgba(248, 248, 248, 0.8);
        padding: 1rem;
        border-radius: 3px;
        position: absolute;
        z-index: 20;
        left: 50%;
        transform: translateX(-50%);
        top: 1rem;
        display: flex;
        box-shadow: 4px 2px 2px rgba(56, 56, 56, 0.925);
    }

    .spinner {
        margin-left: 3px;
    }

</style>

<div style={`display: ${message === "" ? "none" : "flex"};`} class="message-box">
    <div class="message-text">{message}</div>
    <span class="spinner" style={`display: ${ loading ? "block" : "none"};`}>
        <Moon size="20" color="#141414" unit="px" duration="1s" />
    </span>
</div>

