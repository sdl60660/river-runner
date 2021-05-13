<script>
    import { onMount } from 'svelte';
import App from '../App.svelte';
    import { vizState, featureGroups, activeFeatureIndex, stoppingFeature, startLocation } from '../state';
import Loader from './Loader.svelte';

    
    let visible = false;
    let screenWidth = 0;

    let features = [];
    let activeIndex = -1;

    let currentStoppingFeature = null;
    let currentStartLocation = null;

    onMount(() => {

        const unsubscribeState = vizState.subscribe(state => {
            if (state === "running") {
                visible = true;
            }
            else if (state === "uninitialized") {
                activeIndex = -1;
                visible = false;
            }
        });

        const unsubscribeFeatureGroups = featureGroups.subscribe(featureData => {
            features = featureData;
        });

        const unsubscribeActiveFeatureIndex = activeFeatureIndex.subscribe(featureIndex => {
            if (activeFeatureIndex !== null) {
                activeIndex = featureIndex;
            }	
        });

        const unsubscribeStoppingFeature = stoppingFeature.subscribe(featureName => {
            currentStoppingFeature = featureName;
        });

        const unsubscribeStartLocation = startLocation.subscribe(startLocation => {
            currentStartLocation = startLocation;
        });

    })

</script>


<style>

    .info-box {
        background-color: rgba(243, 243, 243, 0.856);
        padding: 1rem;
        padding-left: 1.5rem;
        border-radius: 3px;

        position: absolute;
        z-index: 20;
        left: 80%;
        transform: translateX(-50%);
        top: 2rem;

        display: flex;
        box-shadow: 4px 2px 2px rgba(56, 56, 56, 0.925);

        font-family: "Roboto","Inter", Arial, Helvetica, sans-serif;
    }

    .feature-listing {
        margin: auto 8px;
        padding-top: 2px;
        padding-bottom: 2px;
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
        background-color: rgba(56, 56, 56, 0.96);
        padding-left: 6px;
        padding-right: 6px;
        color: white;
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

    @media only screen and (max-width: 600px) {
        .info-box {
            background-color: rgba(243, 243, 243, 0.9);
            z-index: 20;
            border: 1px solid black;
            left: 50%;
            top: 20vh;
            transform: translate(-50%, -50%);
            font-size: 1rem;
            width: 70vw;
            padding: 0.5rem;
            box-shadow: unset;
        }

        .feature-listing {
            font-weight: bold;
            margin: auto;
            text-align: center;
        }
    }

</style>

<svelte:window bind:innerWidth={screenWidth} />

<div style={`display: ${visible === true && (screenWidth > 600 || (activeIndex && features)) ? "block" : "none"};`} class="info-box">

    {#if screenWidth > 600}
        <div class="feature-listing bounding-location">{currentStartLocation}</div>
        {#each features as { name, length_km, index }, i}
            <div style="font-weight:{index === activeIndex ? "bold" : "normal"};" key={i} class="feature-listing">{i+1}. {name} ({length_km} km)</div>
        {/each}
        <div class="feature-listing bounding-location">{currentStoppingFeature}</div>

        {#each [currentStartLocation, ...features, currentStoppingFeature] as progressPoint, i}
            <div style=
                "
                background-color: {activeIndex+1 === i ? "rgb(76, 79, 230)" : activeIndex+1 > i ? "rgb(117, 117, 117)" : "rgb(243, 243, 243)" };
                top: calc(1rem + 4px + ({(i / (features.length + 2))}*(100% - 2rem)));
                "
                class="progress-point"
                key={i}>
            </div>
        {/each}

        <div class="progress-bar"></div>

    {:else if activeIndex >= 0 && features}
        <div class="feature-listing">{features[activeIndex].name} ({features[activeIndex].length_km} km)</div>
    {/if}

</div>

