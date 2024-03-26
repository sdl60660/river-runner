# River Runner

This project visualizes the path of a rain droplet from any point in the world to its end point (usually an ocean or an inland water features). It will find the closest river/stream flowline coordinate to a click/search and then animate along that flowline's downstream path. The data used in this project comes from the [River Runner API](https://ksonda.github.io/global-river-runner/), which is based on several open source projects and datasets. Similar data, initially used for the project, came from the USGS's [NHDPlus data](https://www.usgs.gov/core-science-systems/ngp/national-hydrography/nhdplus-high-resolution) and their [NLDI API](https://waterdata.usgs.gov/blog/nldi-intro/) 

I've used mapbox to animate the downstream path, but needed to make all sorts of adjustments for elevation and bearing changes to prevent jerkiness/nausea (just moving from point to point feels a little like flying through turbulence while shaking your head side-to-side).

I've hosted a dataset with NHDPlus [Value Added Attributes](https://www.usgs.gov/core-science-systems/ngp/national-hydrography/value-added-attributes-vaas) on Firebase, which allows me to group flowlines into their parent features and determine distances quickly.

**Note**: The newly-released, global version of this project is in beta. We currently have relatively poor coverage of river names outside of the United States, which we are hoping to fill out, as well as some UX edge-cases and bugs that we hope to resolve.

## Examples

Here are a couple of examples of what it looks like in action.

This is a section of the path from eastern Turkey to the Persian Gulf:

![Screenshot of the river runner in progress from eastern Turkey to the Persian Gulf. Mountain features and river are visible.](https://github.com/sdl60660/river-runner/blob/main/public/images/preview_image.png?raw=true)

Here's part of the path from Southwest Arizona down to the Mexican border:

![Screenshot of the river runner in progress from Southwest Arizona to Mexican border. Mountain features, desert, and river are visible.](https://github.com/sdl60660/river-runner/blob/main/public/images/example-2-az.png?raw=true)

You can look at a heatmap of previous searches [here](https://river-runner-query-heatmap.vercel.app/) or find a list of some of our favorite paths [here](https://docs.google.com/document/d/1EqRNDvvCwJdfNvejHzw-0zCd6Ax-0i7nyHkU4h0M9Kg/edit?usp=sharing)

## Running this on your own

If you'd like to run this locally and play around with it, just run the following commands in your terminal (assuming you have [npm](https://www.npmjs.com/get-npm) installed):

1. `git clone https://github.com/sdl60660/river-runner.git`
2. `cd river-runner`
3. `npm install`
4. `npm run dev` (then follow the link to the local server, probably `http://localhost:5000`).
5. If you're running this on your own or forking into a new app, please replace the Mapbox Access Token strings in `src/access_tokens.js` with your own. You can generate a couple of tokens (for free), by creating a Mapbox account and visiting [this page](https://account.mapbox.com/access-tokens/). You'll need to generate two separate tokens to replace the ones in the existing file, but it does not matter which serves as the primary token and which serves as the secondary token.

## Supporters

Thank you to [Mapbox](https://www.mapbox.com/) for sponsoring this project!

<img src="https://user-images.githubusercontent.com/12772904/129089126-5c528d47-961f-427f-820f-df58974d15c3.png" alt="mapbox-logo-black" width="300"/>

## Updates
* **January 2022**: The [global version](https://river-runner-global.samlearner.com/) of this tool is now released and in beta! While some lingering issues are resolved and it remains in beta, it can be found on this branch, while the original, US-only version is preserved [here](https://github.com/sdl60660/river-runner/tree/us-only) in Github, and at its original URL: https://river-runner.samlearner.com/. This is to avoid any breaking changes to existing share links/paths due to any discrepancies and because minor US issues persist on the global version, mainly when paths involve dams, canals, or conduits.

If you'd like to be notified about major updates to the tool, you can sign up for an email list [here](https://tinyletter.com/samlearner)
