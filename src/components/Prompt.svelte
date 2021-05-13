<script>
    import { Moon } from 'svelte-loading-spinners';
    import { stoppingFeature, startLocation } from '../state';

    export let currentLocation;
    export let vizState;

    let loading = false;
    let eventActionName = window.innerWidth > 600 ? "Click" : "Tap"
    let message = `${eventActionName} to drop a raindrop anywhere on the contiguous United States and watch where it ends up`;

    $: if (currentLocation?.lat && message !== "") {
        findLocation({ coordinates: currentLocation, })
    }

    $: if (vizState === "running") {
        message = "";
        loading = false;
    }
    else if (vizState === "uninitialized") {
        resetPrompt();
    }
    else if (vizState === "error" ) {
        message = "Unable to find a flowpath for that location. Please try somewhere else.";
        loading = false;
    }

    const findLocation = async ({ coordinates }) => {
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates.lng},${coordinates.lat}.json?access_token=pk.eyJ1Ijoic2FtbGVhcm5lciIsImEiOiJja2IzNTFsZXMwaG44MzRsbWplbGNtNHo0In0.BmjC6OX6egwKdm0fAmN_Nw`)
        const addressData = await response.json();

        const country = addressData.features.find(d => d.place_type.includes('country'))?.text;
        if (country !== "United States") {
            displayCountryError();
            return;
        }   

        const placeName = addressData.features.find(d => d.place_type.includes('place'))?.text;
        const countyName = addressData.features.find(d => d.place_type.includes('district'))?.text;
        const stateName = addressData.features.find(d => d.place_type.includes('region'))?.text;

        const fullLocationString = placeName ? `${placeName}, ${stateName}` : `${countyName}, ${stateName}`;

        startLocation.update(() => fullLocationString);

        message = `Finding downstream path from ${fullLocationString}`;
        loading = true;
    };

    const resetPrompt = () => {
        message = `${eventActionName} to drop a raindrop anywhere on the contiguous United States and watch where it ends up`;
        loading = false;
    }

    const displayCountryError = () => {
        message = "Sorry! Can only trace from points in the contiguous United States.";
        loading = false;
        setTimeout(() => { resetPrompt() }, 2500);
    }

</script>


<style>

    .message-box {
        background-color: rgba(243, 243, 243, 0.856);
        padding: 1rem;
        border-radius: 3px;

        position: absolute;
        z-index: 20;
        left: 50%;
        transform: translateX(-50%);
        top: 1rem;

        display: flex;
        box-shadow: 4px 2px 2px rgba(56, 56, 56, 0.925);

        font-family: "Roboto","Inter", Arial, Helvetica, sans-serif;
    }

    /* .spinner {
        margin-left: 20px;
    } */

    .message-text {
        margin: auto 8px;
    }

    @media only screen and (max-width: 600px) {
        .message-box {
            width: calc(100% - 2rem);
            height: calc(20vh - 2rem);

            top: 0;
            left: 0;
            border-radius: 0;

            transform: unset;
            box-shadow: unset;

            font-size: 1rem;
        }

        .spinner {
            position: absolute;
            right: 10%;
            bottom: 15%;
        }
    }

</style>

<div style={`display: ${message === "" ? "none" : "flex"};`} class="message-box">
    <div class="message-text">{message}</div>
    <span class="spinner" style={`display: ${ loading ? "block" : "none"};`}>
        <Moon size="20" color="#141414" unit="px" duration="1s" />
    </span>
</div>

