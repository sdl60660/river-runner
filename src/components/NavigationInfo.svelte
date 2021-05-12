<script>
    import { onMount } from 'svelte';
    import { vizState, featureGroups, activeFeatureIndex } from '../state';

    let features = [];
    let activeIndex = null;
    let visible = false;

    onMount(() => {

        const unsubscribeState = vizState.subscribe(state => {
            if (state === "running") {
                visible = true;
            }
            else if (state === "uninitialized") {
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
        /* font-weight: bold; */
    }

    /* .spinner {
        margin-left: 20px;
    } */

    .feature-listing {
        margin: auto 8px;
    }

    @media only screen and (max-width: 600px) {
        .info-box {
            
        }

        .feature-listing {

        }
    }

</style>

<div style={`display: ${visible === true ? "block" : "none"};`} class="info-box">
    {#each features as { name, length_km, index }, i}
        <div style="font-weight:{index === activeIndex ? "bold" : "normal"};" key={i} class="feature-listing">{i+1}. {name} ({length_km} km)</div>
    {/each}
</div>

