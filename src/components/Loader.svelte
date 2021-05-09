<script>
    import { Plane } from 'svelte-loading-spinners';
</script>


<style>
    .loader-wrapper {
        width: 100vw;
        height: 100vh;
        margin: auto;
    }

    .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
    }

    .load-spinner {
        margin-bottom: 1rem;
    }
</style>

<div class="loader-wrapper">
    <div class="loader">
        <div class="load-spinner">
            <Plane size="80" color="#80C5DE" unit="px" duration="1s" />
        </div>
        <div class="load-text">Loading data...</div>
    </div>
</div>
