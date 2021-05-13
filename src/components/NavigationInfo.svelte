<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { stoppingFeature, startLocation } from '../state';

    import CloseButton from './CloseButton.svelte';

    export let vizState;
    export let featureGroups = [];
    export let activeFeatureIndex;
    export let totalLength;
    
    let visible = false;
    let screenWidth = 0;

    let currentStoppingFeature = null;
    let currentStartLocation = null;

    $: visible = (vizState === "running") ? true : (vizState === "uninitialized") ? false : visible;

    const dispatch = createEventDispatcher();
    const setPhase = (pathProgress, featureIndex) => {
        if ( activeFeatureIndex >= 0 ) {
            dispatch('progress-set', { pathProgress, featureIndex })
        }
    }

    onMount(() => {

        const unsubscribeStoppingFeature = stoppingFeature.subscribe(featureName => {
            currentStoppingFeature = featureName;
        });

        const unsubscribeStartLocation = startLocation.subscribe(startLocation => {
            currentStartLocation = startLocation;
        });
    })

</script>


<style>

    .navbox-wrapper {
        position: absolute;
        z-index: 20;
        /* left: calc(100% - 375px); */
        right: 3rem;
        /* transform: translateX(-50%); */
        top: 2rem;
    }

    .info-box {
        background-color: rgba(243, 243, 243, 0.856);
        padding: 1rem;
        padding-left: 1.5rem;
        /* padding-bottom: 3rem; */
        border-radius: 3px;

        display: block;
        box-shadow: 3px 2px 2px rgba(56, 56, 56, 0.925);

        font-family: "Roboto","Inter", Arial, Helvetica, sans-serif;
    }

    .feature-listing {
        margin: auto 8px;
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
        font-weight: bold;
        position: absolute;
        color: white;

        /* width: 100%; */
        text-align: center;
        margin: 3px 0 0 3px;

        /* bottom: 0.5rem; */
    }

    /* Mobile */
    @media only screen and (max-width: 600px) {
        .navbox-wrapper {
            right: 1.3rem;
            left: 1.3rem;
            top: 18vh;
            /* transform: translate(-50%, -50%); */
        }

        .info-box {
            background-color: rgba(243, 243, 243, 0.9);
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
    }

    /* Tablet */
    @media only screen and (min-width: 601px) and (max-width: 1100px) {
        .navbox-wrapper {
            right: 3rem;
        }
    }

</style>

<svelte:window bind:innerWidth={screenWidth} />

<div class="navbox-wrapper" style={`display: ${visible === true && (screenWidth > 600 || (activeFeatureIndex >= 0 && featureGroups)) ? "block" : "none"};`}>

    <div class="info-box">

        <!-- Desktop/Tablet -->
        {#if screenWidth > 600}
            <div class="feature-listing bounding-location">{currentStartLocation}</div>
            {#each featureGroups as { name, length_km, index, progress }, i}
                <div
                    style="font-weight:{index === activeFeatureIndex ? "bold" : "normal"};"
                    key={i}
                    class="feature-listing river-feature"
                    class:river-feature="{activeFeatureIndex >= 0}"
                    on:click={() => setPhase(progress, index)}
                >
                    {i+1}. {name} ({length_km} km)
                </div>
            {/each}
            <div class="feature-listing bounding-location">{currentStoppingFeature}</div>

            {#each [currentStartLocation, ...featureGroups, currentStoppingFeature] as progressPoint, i}
                <div style=
                    "
                    background-color: {activeFeatureIndex+1 === i ? "rgb(76, 79, 230)" : activeFeatureIndex+1 > i ? "rgb(117, 117, 117)" : "rgb(243, 243, 243)" };
                    top: calc(1rem + 4px + ({(i / (featureGroups.length + 2))}*(100% - 2rem)));
                    "
                    class="progress-point"
                    key={i}>
                </div>
            {/each}

            <div class="progress-bar"></div>

        <!-- Mobile (simpler, only displays name of current feature) -->
        {:else if activeFeatureIndex >= 0 && featureGroups}
            {#if activeFeatureIndex >= featureGroups.length}
                <div class="feature-listing">{currentStoppingFeature}</div>
            {:else}
                <div class="feature-listing">{featureGroups[activeFeatureIndex].name} ({featureGroups[activeFeatureIndex].length_km} km)</div>
            {/if}
        {/if}

    </div>
    
    <div style="display: {activeFeatureIndex >= 0 ? "block" : "none"};">
        <CloseButton on:abort-run />
    </div>

    <div class="total-length" style="display: {screenWidth > 600 && totalLength ? "block" : "none"}">Total Length: {Math.round(totalLength)} km</div>
</div>
