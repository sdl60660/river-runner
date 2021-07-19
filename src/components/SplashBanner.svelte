<script>
    import { createEventDispatcher } from 'svelte';

    export let bannerVisible = true;
    let width;

    const dispatch = createEventDispatcher();
    const closeBanner = () => {
        dispatch('close-banner')
    }
</script>


<style>
    .banner {
        /* width: 100vw; */

        position: absolute;
        z-index: 25;
        /* top: 15%; */
        /* transform: translate(0%, -0%); */

        width: 100vw;
        height: 100vh;
    }

    .image-wrapper {
        position: absolute;
        top: 15%;
    }

    .banner-image {
        max-width: 100vw;
        height: auto;
    }

    .advance-button {
        /* margin: auto; */
        cursor: pointer;
        font-size: 1.2rem;
        font-family: 'Roboto', sans-serif;

        position: absolute;
        top: 100%;
        left: 50%;
        transform: translate(-50%, -50%);

        /* Display */
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: start;

        /* Visual */
        background-color: rgb(223, 223, 223);
        color: rgb(39, 38, 38);
        border-radius: 4px;
        box-shadow: 0 3px 5px rgba(0, 0, 0, 0.18);

        /* Size */
        padding: 0.25em 0.75em;
        min-width: 10rem;
        min-height: 3rem;

        /* Text */
        text-align: center;
        line-height: 1.1;

        transition: 100ms all ease-in-out;
    }

    .advance-button:hover, .advance-button:active {
        background-color: #ffffff;
    }

    @media only screen and (max-width: 600px) {
        .image-wrapper {
            top: 10vh;
            transform: translate(0%, -50%);
            height: 20vh;
            background-color: #000000;
        }

        .banner-image {
            padding-top: 3vh;
        }

        .advance-button {
            position: absolute;
            top: 100%;
            left: 50%;
            /* transform: translate(-50%, -0%); */
            font-size: 1rem;
            min-height: 35px;
        }
    }

</style>

<svelte:window bind:innerWidth={width} />

<div class="banner" on:click={closeBanner} style="display: {bannerVisible ? "block" : "none"};">
    <div
        class="image-wrapper"
    >
        <img
            class="banner-image"
            src="images/iow_branding/banner_with_logos.png"
            alt="Banner with title of app (River Runner) and logos for Duke's internet of water lab. Press button below to close banner and start using app."
            width={width}
            height="auto"
        />
        <button
            class="advance-button"
            aria-label="button to close banner and start interacting with app"
            on:click={closeBanner}
        >
            Start
        </button>
    </div>
</div>
