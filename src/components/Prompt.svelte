<script>
    import { onMount } from 'svelte';
    import { Moon } from 'svelte-loading-spinners';
    import { coordinates, riverPath, currentLocation, vizState } from '../state';

    let loading = false;
    let message = "Click to drop a raindrop anywhere on the contiguous United States and watch where it ends up";

    // let state = "uninitialized"; 


    onMount(() => {
        const unsubscribeLocation = currentLocation.subscribe( async (coordinates )=> {
            if (coordinates?.lat) {
                const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates.lng},${coordinates.lat}.json?access_token=pk.eyJ1Ijoic2FtbGVhcm5lciIsImEiOiJja2IzNTFsZXMwaG44MzRsbWplbGNtNHo0In0.BmjC6OX6egwKdm0fAmN_Nw`)
                const addressData = await response.json();
                
                const placeName = addressData.features.find(d => d.place_type.includes('place')).text;
                const countyName = addressData.features.find(d => d.place_type.includes('district')).text;
                const stateName = addressData.features.find(d => d.place_type.includes('region')).text;

                const fullLocationString = placeName ? `${placeName}, ${stateName}` : `${countyName}, ${stateName}`;

                message = `Finding downstream flow path from ${fullLocationString}`;
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
        background-color: rgba(248, 248, 248, 0.85);
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

    @media only screen and (max-width: 600px) {
        .message-box {
            width: calc(100% - 2rem - 6px);

            top: 3px;
            left: 3px;
            
            transform: unset;
        }
    }

</style>

<div style={`display: ${message === "" ? "none" : "flex"};`} class="message-box">
    <div class="message-text">{message}</div>
    <span class="spinner" style={`display: ${ loading ? "block" : "none"};`}>
        <Moon size="20" color="#141414" unit="px" duration="1s" />
    </span>
</div>

