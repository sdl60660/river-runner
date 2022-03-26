import mapbox from "mapbox-gl";
import { secondaryToken } from "./access_tokens";

mapbox.accessToken = secondaryToken;
mapbox.setRTLTextPlugin(
  "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js",
  null,
  true // Lazy load the plugin
);

export { mapbox };
