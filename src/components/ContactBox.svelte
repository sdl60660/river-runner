<script>
    export let vizState;

</script>

<style>

    .contact-box {
        background-color: rgba(243, 243, 243, 0.856);
        padding: 1rem;
        border-radius: 3px;

        position: absolute;
        z-index: 30;
        font-size: .9rem;
        bottom: 1.5rem;
        right: 1rem;
        max-width: 32rem;

        /* left: 50%;
        transform: translateX(-50%);
        top: 1rem; */

        /* display: flex;
        box-shadow: 4px 2px 2px rgba(56, 56, 56, 0.925); */

        font-family: "Roboto","Inter", Arial, Helvetica, sans-serif;
    }

    .contact-box a {
        text-decoration: none;
    }

    .contact-box p {
        margin-block-start: 0.7em;
        margin-block-end: 0.7em;
    }

    .icon-img {
        height: 14px;
        width: 14px;
        padding: 0px 2px;
        fill: white;
    }

    a {
        color: rgb(50, 133, 216)
    }

    @media only screen and (max-width: 600px) {
        .contact-box {
            box-sizing: border-box;
            border-radius: 0;
            right: unset;
            bottom: 0;
            padding: 5px;
            background-color: white;
            width: 100%;
            text-align: center;
            height: 1.5rem;
        }
    }

    @media only screen and (max-width: 380px) {
        .contact-box {
            font-size: 0.85rem;
        }
    }

</style>

<div style="display: {vizState === "running" && window.innerWidth > 600 ? "none" : "block"};" class={"contact-box"}>
    {#if window.innerWidth > 600}
        <p><strong>Visualization by <a target="_blank" href="https://bit.ly/main-project-site">Sam Learner</a></strong> |
            <a target="_blank" href="https://twitter.com/sam_learner"><img class="icon-img" src="/images/twitter.svg" alt="twitter link"/></a> |
            <a target="_blank" href="mailto:learnersd@gmail.com"><img class="icon-img" src="/images/email.svg" alt="email link"/></a> |
            <a target="_blank" href="https://github.com/sdl60660"><img class="icon-img" src="/images/github.svg" alt="github link"/></a>
        </p>
        <p>
            <strong>Sources</strong>: The data used in this project comes from the USGS's <a target="_blank" href="https://waterdata.usgs.gov/blog/nldi-intro/">NLDI API</a>, along with additional <a href="https://www.usgs.gov/core-science-systems/ngp/national-hydrography/nhdplus-high-resolution">NHDPlus</a> data.
            Code and data for this project lives <a target="_blank" href={"https://github.com/sdl60660/river-runner/"}>here</a>.
        </p>
    {:else}
        <strong>Visualization by <a target="_blank" href="https://bit.ly/main-project-site">Sam Learner</a></strong> |
        <a target="_blank" href="https://twitter.com/sam_learner"><img class="icon-img" src="/images/twitter.svg" alt="twitter link"/></a> |
        <a target="_blank" href="mailto:learnersd@gmail.com"><img class="icon-img" src="/images/email.svg" alt="email link"/></a> |
        <a target="_blank" href="https://github.com/sdl60660"><img class="icon-img" src="/images/github.svg" alt="github link"/></a> | 
        Data: <a href="https://www.usgs.gov/core-science-systems/ngp/national-hydrography/nhdplus-high-resolution">USGS</a>.
    {/if}
</div>