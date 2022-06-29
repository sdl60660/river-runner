<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
  const abortRun = () => {
    dispatch("abort-run");
  };

  export let callback = abortRun;
</script>

<!-- style="display: {activeIndex >= 0 ? "block" : "none"};" -->
<button on:click={callback} class="close" />

<!-- Styling mostly from here: https://svelte.dev/repl/fdbb69a2c3744cfe956a370c824eb4df?version=3.15.0 -->
<style type="text/scss">
  @import "../settings.scss";

  .close {
    display: block;
    position: absolute;
    z-index: 100;
    top: 0;
    right: 0;
    transform: translate(50%, -50%);
    cursor: pointer;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    border: 0;
    color: black;
    border-radius: 1.5rem;
    background: white;
    box-shadow: 0 0 0 1px black;
    /* transition: transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
                    background 0.2s cubic-bezier(0.25, 0.1, 0.25, 1); */
    -webkit-appearance: none;
  }

  .close:before,
  .close:after {
    content: "";
    display: block;
    box-sizing: border-box;
    position: absolute;
    top: 50%;
    width: 1rem;
    height: 1px;
    background: black;
    transform-origin: center;
    /* transition: height 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
                    background 0.2s cubic-bezier(0.25, 0.1, 0.25, 1); */
  }

  .close:before {
    -webkit-transform: translate(0, -50%) rotate(45deg);
    -moz-transform: translate(0, -50%) rotate(45deg);
    transform: translate(0, -50%) rotate(45deg);
    left: 0.25rem;
  }

  .close:after {
    -webkit-transform: translate(0, -50%) rotate(-45deg);
    -moz-transform: translate(0, -50%) rotate(-45deg);
    transform: translate(0, -50%) rotate(-45deg);
    left: 0.25rem;
  }

  .close:hover {
    background: black;
  }

  .close:hover:before,
  .close:hover:after {
    height: 2px;
    background: white;
  }

  .close:focus {
    border-color: #3399ff;
    box-shadow: 0 0 0 2px #3399ff;
  }

  /* .close:active {
        transform: scale(0.9);
    } */

  .close:hover,
  .close:focus,
  .close:active {
    outline: none;
  }

  @media only screen and (max-width: $mobile-breakpoint) {
    .close {
      top: 50%;
    }
  }
</style>
