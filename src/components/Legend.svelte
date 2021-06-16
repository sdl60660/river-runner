<script>
    export let vizState;
    export let activeFeatureIndex;
    export let siteTypeData;
    export let siteTypes = [];

    export let toggleSiteLayer;

</script>

<style>
    .legend {
        padding: 1rem;
        background-color: rgba(221, 221, 221, 0.89);
        border-radius: 4px;
        z-index: 50;
        display: flex;
        flex-direction: column;
    }

    .site-type-listing {
        display: grid;
        grid-template-columns: 1fr 8fr 1fr;
        grid-gap: 4px;
        cursor: pointer;
    }

    .site-type-icon {
        align-self: center;
        justify-self: center;
        height: 10px;
        width: 10px;
        border: 1px solid black;
    }

    .site-type-name {
        font-family: 'Roboto', 'Inter', Arial, Helvetica, sans-serif;
        font-weight: bold;
        justify-self: left;
    }

    .hidden {
        opacity: 0.2;
    }

    .hidden .site-type-name {
        text-decoration: line-through;
    }

    .link-icon {
        height: 1rem;
        vertical-align: middle;
    }

    .helper {
        display: inline-block;
        height: 100%;
        vertical-align: middle;
    }
</style>


<div class="legend" style="display: {activeFeatureIndex >= 0 && vizState === "running" ? "flex" : "none"}" >
    {#each siteTypes as site, i}
        <div
            class="site-type-listing"
            class:hidden={siteTypeData[site].hidden}
            on:click={() => { toggleSiteLayer(siteTypeData[site].layerID, site); }}
        >
            <div class="site-type-icon" style="background-color: {siteTypeData[site].color};"></div>
            <div class="site-type-name">{siteTypeData[site].displayName}</div>
            <div class="icon-wrapper">
                <a href="{siteTypeData[site].informationLink}" target="_blank" on:click|stopPropagation={() => {}}>
                    <img class="link-icon" src="/images/link.svg" alt="site-type-information-link">
                </a>
            </div>
        </div>
    {/each}
</div>