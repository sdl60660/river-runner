<script>
    import { onMount } from 'svelte';
    import { vizState, featureGroups, activeFeatureIndex } from '../state';

    let features = [];
    let activeIndex = null;
    let visible = false;
    let screenWidth = 0;

    onMount(() => {

        const unsubscribeState = vizState.subscribe(state => {
            if (state === "running") {
                visible = true;
            }
            else if (state === "uninitialized") {
                activeIndex = null;
                visible = false;
            }
        });

        const unsubscribeFeatureGroups = featureGroups.subscribe(featureData => {
            features = featureData;
        })

        const unsubscribeActiveFeatureIndex = activeFeatureIndex.subscribe(featureIndex => {
            if (activeFeatureIndex !== null) {
                activeIndex = featureIndex;
            }	
        })

    })

</script>


<style>

    .info-box {
        background-color: rgba(243, 243, 243, 0.856);
        padding: 1rem;
        border-radius: 3px;

        position: absolute;
        z-index: 20;
        left: 83%;
        transform: translateX(-50%);
        top: 2rem;

        display: flex;
        box-shadow: 4px 2px 2px rgba(56, 56, 56, 0.925);

        font-family: "Roboto","Inter", Arial, Helvetica, sans-serif;
    }

    .feature-listing {
        margin: auto 8px;
    }

    @media only screen and (max-width: 600px) {
        .info-box {
            background-color: rgba(243, 243, 243, 0.9);
            z-index: 20;
            border: 1px solid black;
            left: 50%;
            top: 20vh;
            transform: translate(-50%, -50%);
            font-size: 14px;
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
        {#each features as { name, length_km, index }, i}
            <div style="font-weight:{index === activeIndex ? "bold" : "normal"};" key={i} class="feature-listing">{i+1}. {name} ({length_km} km)</div>
        {/each}
    {:else if activeIndex && features}
        <div class="feature-listing">{features[activeIndex].name} ({features[activeIndex].length_km} km)</div>
    {/if}

</div>

