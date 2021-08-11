# River Runner

This uses USGS [NHDPlus data](https://www.usgs.gov/core-science-systems/ngp/national-hydrography/nhdplus-high-resolution) and their [NLDI API](https://waterdata.usgs.gov/blog/nldi-intro/) to visualize the path of a rain droplet from any point in the contiguous United States to its end point (usually the ocean, sometimes the Great Lakes, Canada/Mexico, or another inland water feature). It'll find the closest river/stream flowline coordinate to a click/search and then animate along that flowline's downstream path.

I've used mapbox to animate the downstream path, but needed to make all sorts of adjustments for elevation and bearing changes to prevent jerkiness/nausea (just moving from point to point feels a little like flying through turbulence while shaking your head side-to-side).

I've hosted a dataset with NHDPlus [Value Added Attributes](https://www.usgs.gov/core-science-systems/ngp/national-hydrography/value-added-attributes-vaas) on Firebase, which allows me to group flowlines into their parent features and determine distances quickly.

## Examples

Here are a couple of examples of what it looks like in action.

This is a section of the path from Yellowstone National Park out to the Atlantic Ocean:

![Screenshot of the river runner in progress from Yellowstone National Park to the Atlantic Ocean. Mountain features and river are visible.](https://github.com/sdl60660/river-runner/blob/main/public/images/preview_image.png?raw=true)

Here's part of the path from Southwest Arizona down to the Mexican border:

![Screenshot of the river runner in progress from Southwest Arizona to Mexican border. Mountain features, desert, and river are visible.](https://github.com/sdl60660/river-runner/blob/main/public/images/example-2-az.png?raw=true)

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

