# River Runner

This uses USGS [NHDPlus data](https://www.usgs.gov/core-science-systems/ngp/national-hydrography/nhdplus-high-resolution) and their [NLDI API](https://waterdata.usgs.gov/blog/nldi-intro/) to track the path of a rain droplet from any point in the contiguous United States to its end point (usually the ocean, sometimes the Great Lakes, Canada/Mexico, or another inland water feature). It'll find the closest river/stream flowline point and then animate along that flowline's downstream path.

I've used mapbox to animate the downstream path, but needed to make all sorts of adjustments for elevation and bearing changes to prevent jerkiness/nausea (just moving from point to point feels a little like flying through turbulence while shaking your head side-to-side).

I've hosted a dataset with NHDPlus [Value Added Attributes](https://www.usgs.gov/core-science-systems/ngp/national-hydrography/value-added-attributes-vaas) on Firebase, which allows me to group flowlines into their parent features and determine distances quickly.

Here's a section of the path from Yellowstone National Park out to the Atlantic Oean:

![Screenshot of the river runner in progress from Yellowstone National Park to the Atlantic Ocean. Mountain features and river are visible.](https://github.com/sdl60660/river-runner/public/images/preview_image.png?raw=true)
