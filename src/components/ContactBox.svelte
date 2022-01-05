<script>
  export let vizState;
</script>

<div
  style="display: {vizState === 'running' && window.innerWidth > 700
    ? 'none'
    : 'block'};"
  class={"contact-box"}
>
  {#if window.innerWidth > 700}
    <p>
      <strong
        >Visualization by <a
          target="_blank"
          href="https://bit.ly/main-project-site">Sam Learner</a
        ></strong
      >
      |
      <a target="_blank" href="https://twitter.com/sam_learner"
        ><img
          class="icon-img"
          src="/images/twitter.svg"
          alt="twitter link"
        /></a
      >
      ·
      <a target="_blank" href="mailto:learnersd+river-runner@gmail.com"
        ><img class="icon-img" src="/images/email.svg" alt="email link" /></a
      >
      ·
      <a target="_blank" href="https://github.com/sdl60660"
        ><img class="icon-img" src="/images/github.svg" alt="github link" /></a
      >
      ·
      <a target="_blank" href="https://ko-fi.com/samlearner"
        ><img class="icon-img" src="/images/kofi.svg" alt="ko-fi link" /></a
      >
    </p>
    <p>
      <strong>Sources</strong>: The data used in this project comes from the
      River Runner API, which is based on several open source projects and
      datasets and developed by 
      <a href="https://www.usgs.gov/staff-profiles/david-l-blodgett" target="_blank" rel="noreferrer">Dave Blodgett</a>, 
      <a href="https://internetofwater.org/about/people/kyle-onda/" target="_blank" rel="noreferrer">Kyle Onda</a>, and 
      <a href="https://github.com/webb-ben" target="_blank" rel="noreferrer">Ben Webb</a>. 
      Learn about it
      <a href="https://ksonda.github.io/global-river-runner/" target="_blank"
        >here</a
      >. Code and data for this project lives
      <a target="_blank" href={"https://github.com/sdl60660/river-runner/tree/global"}
        >here</a
      >.
    </p>
    <p>
      This version of the app is in beta. Report any issues you experience <a
        rel="noreferrer"
        target="_blank"
        href="https://forms.gle/p67Z2fSSZp7GbVr6A">here</a
      >.
    </p>
  {:else}
    <strong
      >Project by <a
        target="_blank"
        href="https://bit.ly/main-project-site"
        rel="noreferrer"
      >
        Sam Learner
      </a></strong
    >
    | Data:
    <a
      href="https://ksonda.github.io/global-river-runner/"
      target="_blank"
      rel="noreferrer"
    >
      USGS/IoW
    </a>
    |
    <a
      rel="noreferrer"
      target="_blank"
      href="https://forms.gle/p67Z2fSSZp7GbVr6A"
    >
      Report Issues
    </a>
  {/if}
</div>

<style>
  .contact-box {
    background-color: rgba(243, 243, 243, 0.856);
    padding: 1rem;
    border-radius: 3px;

    position: absolute;
    z-index: 30;
    font-size: 0.9rem;
    bottom: 1.5rem;
    right: 1rem;
    max-width: 32rem;

    /* left: 50%;
        transform: translateX(-50%);
        top: 1rem; */

    /* display: flex;
        box-shadow: 4px 2px 2px rgba(56, 56, 56, 0.925); */

    font-family: "Roboto", "Inter", Arial, Helvetica, sans-serif;
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
    color: rgb(50, 133, 216);
  }

  @media only screen and (max-width: 1000px) and (min-width: 701px) {
    .contact-box {
      font-size: 0.82rem;
    }
  }

  @media only screen and (max-width: 700px) {
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
