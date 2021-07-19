<script>
import { image } from "d3-fetch";

    export let vizState;

    const logoImages = [
        { src: 'images/iow_branding/iow_logo_horizontal_white.png', alt: "Duke Internet of Water logo"},
        { src: 'images/iow_branding/NIEPS_logo_white.png', alt: "NIEPS Logo" },
        { src: 'images/iow_branding/geoconnex_logo_white.png', alt: "geoconnex logo"}
    ]
</script>

<style>
    .wrapper {
        position: absolute;
        z-index: 50;

        left: 50%;
        bottom: 1rem;
        transform: translate(-50%, 0%);

        display: flex;
        flex-direction: row;
        gap: 3rem;
    }

    .logo-image {
        max-height: 2rem;
        width: auto;
    }
</style>

<div class="wrapper" style="display: {vizState === "running" ? "flex" : "none"}">
    {#each logoImages as { src, alt }, i}
        <img
            class={"logo-image"}
            {src}
            {alt}
        />
    {/each}
</div>