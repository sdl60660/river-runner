<script>
  import { tick, onMount } from "svelte";
  import { mapbox } from "../mapbox.js";
  import { mapboxAccessToken } from "../access_tokens";
  import * as d3 from "d3";

  import along from "@turf/along";
  import { lineString } from "@turf/helpers";
  import distance from "@turf/distance";

  import { distanceToPolygon, getDataBounds } from "../utils";
  import { coordinates, stoppingFeature } from "../state";

  import Prompt from "./Prompt.svelte";
  import NavigationInfo from "./NavigationInfo.svelte";
  import LocatorMap from "./LocatorMap.svelte";
  import ContactBox from "./ContactBox.svelte";
  import Controls from "./Controls.svelte";
  import Legend from "./Legend.svelte";
  import WaterLevelDisplay from "./WaterLevelDisplay.svelte";

  import {
    nwisPopupFormat,
    wqpPopupFormat,
    caGagePopupFormat,
    wadePopupFormat,
  } from "./utils/popupFormats";
  import {
    getElevations,
    getElevationsMapQuery,
    addFeatureExtrusions,
    addTopoLayer,
    clearRiverLines,
    drawFlowPath,
    addRivers,
  } from "./utils/mapboxUtils";
  import {
    bearingBetween,
    pathSmoother,
    calculatePitch,
    pathDistance,
    findArtificialCameraPoint,
  } from "./utils/geoUtils";

  export let bounds;
  export let stateBoundaries;
  export let activeNWISSites;
  export let stoppingFeatures;
  export let featureData = undefined;
  export let visibleIndex;
  export let mapStyle;
  export let addTopo;
  export let advancedFeaturesOn;

  const urlParams = new URLSearchParams(window.location.search);
  let startingSearch = urlParams.has("lat")
    ? { lngLat: { lat: +urlParams.get("lat"), lng: +urlParams.get("lng") } }
    : null;

  let container;
  let map;
  let mapBounds = bounds;
  let geocoder = null;
  let runSettings = {};

  let aborted = false;
  let vizState = "uninitialized";
  let postRun = false;
  let runTimeout;

  let riverPath;
  let currentLocation;
  let startCoordinates;
  let featureGroups = [];
  let activeFeatureIndex = -1;
  let totalLength;

  let phaseJump;

  // Zoom level won't be adjustable on mobile, but it will be set slightly higher to avoid jiterriness
  const defaultAltitudeMultiplier = window.innerWidth < 600 ? 1.1 : 0.8;
  let altitudeMultiplier = defaultAltitudeMultiplier;
  let altitudeChange = false;
  let paused = false;
  let playbackSpeed = 1;

  // let currentFlowrateIndex = 0;
  let currentFlowrate = { level: 10000, index: 0 };
  let maxFlowrate = 20000;
  let flowrates = [];
  // let pitchMutiplier = 1; // this one might be a bad idea

  let siteTypes = [];
  let siteTypeData = {};

  onMount(async () => {
    await tick();

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/mapbox-gl/dist/mapbox-gl.css";

    link.onload = () => {
      map = new mapbox.Map({
        container,
        style: mapStyle || "mapbox://styles/mapbox/light-v10",
        center: [0, 0],
        zoom: 9,
      });

      map.fitBounds(bounds, { animate: false, padding: 30 });
      map.setMaxBounds(map.getBounds());
      mapBounds = map.getBounds();

      map.on("load", () => {
        // If there's feature data passed in as a prop (doesn't really happen anymore), render rivers on load
        if (featureData) {
          addRivers({ map, featureData, lineWidth: 1 });
        }

        // Add 3D topo layer if flag is set (should basically always be)
        if (addTopo) {
          addTopoLayer({ map });
        }

        // Add geocoder search bar to search for location/address instead of clicking
        geocoder = initGeocoder({ map });

        // Initialize and add explicit zoom controls in top-left corner, if not on mobile
        const nav = new mapbox.NavigationControl({
          showCompass: false,
          visualizePitch: true,
        });
        if (window.innerWidth > 600) {
          map.addControl(nav, "top-left");
        }

        // If starting coordinates were passed in as a parameter (from a shared link), load starting path
        if (startingSearch) {
          initRunner({ map, e: startingSearch });
          startingSearch = null;
        }
      });

      map.on("click", async (e) => {
        if (vizState === "uninitialized") {
          initRunner({ map, e });
        }
      });
    };

    document.head.appendChild(link);

    siteTypeData = {
      "NWIS Surface Water Sites": {
        color: "green",
        layerID: "nwis-points",
        formatterFunction: nwisPopupFormat,
        markerRadius: 0.1,
        markerHeight: 80,
        displayName: "USGS Monitoring Locations",
        informationLink: "https://waterdata.usgs.gov/nwis",
      },
      "Water Quality Portal": {
        color: "yellow",
        layerID: "wqp-points",
        formatterFunction: wqpPopupFormat,
        markerRadius: 0.06,
        markerHeight: 50,
        displayName: "Water Quality Portal sites",
        informationLink: "https://www.waterqualitydata.us/",
      },
      "Water Data Exchange 2.0 Sites": {
        color: "#9e0e0e",
        layerID: "wade-points",
        formatterFunction: wadePopupFormat,
        markerRadius: 0.06,
        markerHeight: 50,
        displayName: "Points of Diversion",
        informationLink: "https://westernstateswater.org/wade/",
      },
      "Streamgage catalog for CA SB19": {
        color: "blue",
        layerID: "ca-gage-points",
        formatterFunction: caGagePopupFormat,
        markerRadius: 0.06,
        markerHeight: 50,
        displayName: "California Stream Gages",
        informationLink:
          "https://gispublic.waterboards.ca.gov/portal/home/item.html?id=32dfb85bd2744487affe6e3475190093",
      },
    };

    return () => {
      map.remove();
      link.parentNode.removeChild(link);
    };
  });

  const initGeocoder = ({ map }) => {
    const geocoderControl = new MapboxGeocoder({
      accessToken: mapboxAccessToken,
      countries: "us",
      bbox: bounds.flat(),
      mapboxgl: mapbox,
      placeholder: "Search for any location",
      marker: false,
      flyTo: false,
    });

    if (window.innerWidth < 600) {
      geocoderControl.setLimit(4);
    }

    geocoderControl.on("result", (e) => {
      const result = e.result;
      result.lngLat = {
        lng: result.geometry.coordinates[0],
        lat: result.geometry.coordinates[1],
      };
      geocoderControl.clear();

      initRunner({ map, e: result });
    });

    const position = window.innerWidth > 600 ? "top-right" : "bottom-left";
    map.addControl(geocoderControl, position);

    return geocoderControl;
  };

  const fetchNLDI = async (closestFeature, featureTypes) => {
    let [flowlinesData, nwisData, caGageData, wqpData, wadeData] =
      await Promise.all(
        featureTypes.map((siteType) => getSiteData(closestFeature, siteType))
      );

    // Determine which NWIS Sites have display images, based on the active gage data stored in a static data file
    if (nwisData) {
      nwisData.features.forEach((feature) => {
        feature.properties.display_image = activeNWISSites.includes(
          feature.properties.identifier.slice(5)
        );
      });
    }

    // Gather the true station metadata web links for any CA gages
    if (caGageData) {
      const weblinkResponses = await Promise.all(
        caGageData.features.map((gage) => {
          return async () => {
            try {
              const response = await fetch(
                `https://sb19.linked-data.internetofwater.dev/collections/ca_gages/items/${gage.properties.identifier}?f=json`
              );
              return response;
            } catch (e) {
              console.log("Error fetching CA Gage data:", e);
              return { status: 500 };
            }
          };
        })
      );

      const weblinkData = await Promise.all(
        weblinkResponses.map((a) => (a.status === 200 ? a.json() : null))
      );

      caGageData.features.forEach((d, i) => {
        d.properties.weblink =
          weblinkData[i] === null ? null : weblinkData[i].properties.weblink;
      });

      caGageData.features = caGageData.features
        .slice()
        .filter((d) => d.properties.weblink !== null);
    }

    // For each site type that exists on a given run, plot it the points and add them to a data array for the legend to use
    siteTypes = [];
    [nwisData, wqpData, wadeData, caGageData].forEach((featureSet) => {
      if (featureSet && featureSet?.features?.length > 0) {
        const sourceName = featureSet.features[0].properties.sourceName;

        siteTypes.push(sourceName);
        const siteData = siteTypeData[sourceName];

        addFeatureExtrusions({ map, featureSet, ...siteData });
      }
    });

    return flowlinesData;
  };

  const initRunner = async ({ map, e }) => {
    // If a click is in the middle of processing, just return
    if (map.interactive === false) {
      return;
    }

    // Turn off map interactivity
    map.interactive = false;
    map.scrollZoom.disable();
    d3.selectAll(".mapboxgl-ctrl-geocoder").style("display", "none");
    d3.select(".mapboxgl-ctrl-top-left").style("display", "none");

    currentLocation = e.lngLat;
    startCoordinates = e.lngLat;

    // Use the NLDI API to find the closest flowline coordinate to the click
    const closestFeature = await findClosestFeature(e);

    if (aborted === true) {
      resetMapState({ map, error: true });
      return;
    }

    // If no feature can be found, even after rounding coordinates off, send error message and reset
    if (!closestFeature) {
      vizState = "error";
      resetMapState({ map, error: true });
      return;
    }

    // Get downstream flowline path from origin point, as well as any data on NWIS Sites, Reference Gages, WQP Sites, WaDE Sites
    const featureTypes = advancedFeaturesOn
      ? ["flowlines", "nwissite", "ca_gages", "wqp", "wade"]
      : ["flowlines"];
    // const featureTypes = ["flowlines", "nwissite", "ca_gages", "wqp", "wade"];
    const flowlinesData = await fetchNLDI(closestFeature, featureTypes);

    // Append VAA data/flowrate data from firebase to flowline data
    flowlinesData.features = await addVAAData(flowlinesData.features);

    if (advancedFeaturesOn === true) {
      flowlinesData.features = await getFlowrateData(flowlinesData.features);
    }
    flowrates = flowlinesData.features.map((d) => d.properties.flowrate);

    // Set max flowrate for gauge. Max defaults to 20,000 cubic feet/second, but will go up if there's a higher value in the current path's set
    maxFlowrate = Math.max(...flowrates, 20000);
    // currentFlowrateIndex = 0;

    // Find the parent features of flowlines along the path
    totalLength =
      flowlinesData.features[0].properties.pathlength > 0
        ? flowlinesData.features[0].properties.pathlength
        : undefined;
    const riverFeatures = getFeatureGroups(flowlinesData);
    featureGroups = riverFeatures;

    // Find start and end points
    const startRiver = flowlinesData.features[0];
    const originPoint = startRiver.geometry.coordinates[0];
    const destinationPoint = flowlinesData.features
      .slice(-1)[0]
      .geometry.coordinates.slice(-1)[0];

    // Construct full coordinate path by taking the first coordinate in each flowline (each coordinate in the flowline is an unnecessary level of detail)
    const coordinatePath =
      flowlinesData.features.length > 3
        ? [
            flowlinesData.features[0].geometry.coordinates[0],
            ...flowlinesData.features.map(
              (feature) => feature.geometry.coordinates.slice(-1)[0]
            ),
          ]
        : flowlinesData.features
            .map((feature) => feature.geometry.coordinates)
            .flat()
            .filter((d, i) => i % 2 === 0);

    // Update props used by child components
    riverPath = [{ geometry: { coordinates: coordinatePath } }];
    currentLocation = originPoint;
    vizState = "calculating";

    // Determine stopping feature by finding closest feature in stopping feature dataset
    const pathStoppingFeature = determineStoppingFeature({
      destinationPoint,
      stoppingFeatures,
    });
    stoppingFeature.update(() => pathStoppingFeature);

    // Draw river lines from flowline features. Combining them aboids mapbox simplification on low zoom levels that creates a choppy looking flow path.
    const combinedFlowlines = flowlinesData.features[0];
    combinedFlowlines.geometry.coordinates = flowlinesData.features
      .map((a) => a.geometry.coordinates)
      .flat();
    drawFlowPath({ map, featureData: [combinedFlowlines], lineWidth: 3 });

    let terrainElevationMultiplier = 1;
    let cameraBaseAltitude = 3600;
    const elevationArrayStep = Math.min(coordinatePath.length / 2 - 1, 100);

    // const elevations = await getElevations(coordinatePath, elevationArrayStep);
    let elevations = getElevationsMapQuery(
      coordinatePath,
      map,
      elevationArrayStep
    );
    if (elevations.includes(null)) {
      elevations = await getElevations(coordinatePath, elevationArrayStep);
      cameraBaseAltitude = 4300;
      terrainElevationMultiplier = 1.25;
    }

    // Take base altitude and then adjust up based on the elevation of the first coordinate
    // The multiplier is necessary for higher elevations since they tend to be mountainous areas, as well, requiring additional height for the camera
    const initialElevation =
      cameraBaseAltitude +
      altitudeMultiplier *
        terrainElevationMultiplier *
        Math.round(elevations[0]);

    const targetPitch = 69;
    const distanceGap =
      (initialElevation * Math.tan((targetPitch * Math.PI) / 180)) / 1000;

    // Create smoothed path by averaging coordinates with their neighbors. This helps reduce horizontal movement with bendy rivers.
    // const smoothedPath = pathSmoother(coordinatePath, Math.min(9, Math.floor(coordinatePath.length / 2)));
    const smoothedPath = pathSmoother(
      coordinatePath,
      Math.min(
        Math.floor(9 * altitudeMultiplier),
        Math.floor(coordinatePath.length / 2)
      )
    );

    const routeDistance = pathDistance(smoothedPath);
    const trueRouteDistance = pathDistance(coordinatePath);

    let firstBearingPoint = along(
      lineString(smoothedPath),
      routeDistance * 0.00005
    ).geometry.coordinates;

    if (firstBearingPoint === smoothedPath[0]) {
      firstBearingPoint = smoothedPath[1];
    }
    const cameraStart = findArtificialCameraPoint({
      distanceGap: altitudeMultiplier * distanceGap,
      originPoint: smoothedPath[0],
      targetPoint: firstBearingPoint,
    });

    const initialBearing = bearingBetween(cameraStart, smoothedPath[0]);

    // We'll calculate the pitch based on the altitude/distance from camera to target
    const cameraPitch = calculatePitch(
      initialElevation,
      1000 * distance(cameraStart, smoothedPath[0])
    );

    // Hide geocoder if still visible (share link)
    d3.selectAll(".mapboxgl-ctrl-geocoder").style("display", "none");

    // Pre-calculate initial camera center/zoom based on starting coordinates, so that flyTo function can end in correct place
    const { zoom, center } = precalculateInitialCamera({
      map,
      cameraStart,
      initialElevation,
      initialBearing,
      cameraPitch,
      smoothedPath,
      distanceGap,
      routeDistance,
    });

    runSettings = {
      zoom,
      center,
      cameraBaseAltitude,
      cameraPitch,
      coordinatePath,
      initialBearing,
      smoothedPath,
      routeDistance,
      distanceGap,
      elevations,
      terrainElevationMultiplier,
      riverFeatures,
      flowrates,
    };

    // When using the vizState change/return instead of startRun, it displays the overview before automatically starting the run
    // We'll do this with a countdown timer on desktop, and just right into it on mobile
    if (window.innerWidth > 600) {
      vizState = "overview";
      map.scrollZoom.enable();

      postRun = false;
      runTimeout = setTimeout(() => {
        startRun({ map, ...runSettings });
      }, 5100);
    } else {
      startRun({ map, ...runSettings });
    }
  };

  const startRun = ({
    map,
    zoom,
    center,
    cameraBaseAltitude,
    cameraPitch,
    coordinatePath,
    initialBearing,
    smoothedPath,
    routeDistance,
    distanceGap,
    elevations,
    terrainElevationMultiplier,
    riverFeatures,
    flowrates,
  }) => {
    map.scrollZoom.disable();

    altitudeMultiplier = defaultAltitudeMultiplier;
    paused = false;
    playbackSpeed = 1;

    // Fly to clicked point and pitch camera (initial "raindrop" animation)
    map.flyTo({
      center,
      zoom,
      speed: 0.9,
      curve: 1,
      pitch: cameraPitch,
      bearing: initialBearing,
      easing(t) {
        return t;
      },
    });

    vizState = "running";

    // Maintain a consistent speed using the route distance. The higher the speed coefficient, the slower the runner will move.
    const speedCoefficient =
      smoothedPath.length < 50 ? 200 : 185 - 5 * (cameraPitch - 70);
    const animationDuration = Math.round(speedCoefficient * routeDistance);

    map.once("moveend", () => {
      map.interactive = true;

      // When "raindrop" animation (flyto) is finished, begin the river run
      runRiver({
        map,
        animationDuration,
        cameraBaseAltitude,
        cameraPitch,
        coordinatePath,
        routeDistance,
        distanceGap,
        elevations,
        terrainElevationMultiplier,
        riverFeatures,
        flowrates,
      });
    });
  };

  const findClosestFeature = async (e) => {
    let closestFeature;
    let resultFound = false;
    let roundingDigits = 6;
    while (resultFound === false && roundingDigits >= 0 && aborted === false) {
      roundingDigits -= 1;

      try {
        const closestFeatureURL = `https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28${e.lngLat.lng.toFixed(
          roundingDigits
        )}%20${e.lngLat.lat.toFixed(roundingDigits)}%29`;
        const coordinateResponse = await fetch(closestFeatureURL);
        const data = await coordinateResponse.json();
        closestFeature = data.features[0];

        resultFound = true;
      } catch {
        console.log(
          `Error while rounding coordinates to ${roundingDigits} digits. Trying again with less precise coordinates.`
        );
      }
    }

    return closestFeature;
  };

  const getSiteData = async (closestFeature, siteType) => {
    const siteURL =
      closestFeature.properties.navigation +
      "/DM/" +
      siteType +
      "?f=json&distance=6000";
    const response = await fetch(siteURL);

    try {
      const data = await response.json();
      return data;
    } catch {
      return null;
    }
  };

  const determineStoppingFeature = ({ destinationPoint, stoppingFeatures }) => {
    let minDistance = 10000000;
    let closestFeature = null;
    let oceanDistance = null;

    // Find the distance from each polygon in the stop feature dataset
    stoppingFeatures.forEach((feature) => {
      const featureDistance = distanceToPolygon({
        startPoint: destinationPoint,
        targetPolygon: feature,
      });

      if (featureDistance < minDistance) {
        minDistance = featureDistance;
        closestFeature = feature;
      }

      if (feature.properties.stop_feature_type === "ocean") {
        oceanDistance = featureDistance;
      }
    });

    // If the closest feature in the stop feature set is more than 10 km away, this is landing on an unidentified inland water feature
    if (
      minDistance > 10000 &&
      closestFeature.properties.stop_feature_type !== "ocean"
    ) {
      return "Inland Water Feature";
    }
    // Sometimes there's a large inlet/bay that creates artificial distance between the destination point and my imperfect ocean shapefile polygon
    // It may then think that another feature, like a lake is the "stop feature", (this happens in the Alabama gulf, for example).
    // We're going to say that if the ocean is within 50km of the stop point, it's very likely the true end point
    else if (
      closestFeature.properties.stop_feature_type === "ocean" ||
      oceanDistance < 50000
    ) {
      if (closestFeature.properties.stop_feature_name === "San Francisco Bay") {
        return "San Francisco Bay";
      }
	  else if (closestFeature.properties.stop_feature_name === "Delaware Bay") {
		return "Delaware Bay";
	  }

      // Gulf of Mexico: lng < -82 && lat < 31
      // Chesapeake Bay: -75.6 > lng > -77.68 && 39.61 > lat > 37.79
      // Delaware Bay: -74.87 > lng > -75.54 && 39.53 > lat > 38.77
      // Otherwise split by Texas, basically, between Atlantic/Pacific
      return destinationPoint[0] < -82 && destinationPoint[1] < 31
        ? "Gulf of Mexico"
        : destinationPoint[0] < -75.6330075 &&
          destinationPoint[0] > -77.684621 &&
          destinationPoint[1] > 37.793247 &&
          destinationPoint[1] < 39.61332
        ? "Chesapeake Bay"
        : destinationPoint[0] < -74.872 &&
          destinationPoint[0] > -75.542 &&
          destinationPoint[1] > 38.771 &&
          destinationPoint[1] < 39.525
        ? "Delaware Bay"
        : destinationPoint[0] > -100
        ? "Atlantic Ocean"
        : "Pacific Ocean";
    } else {
      return closestFeature.properties.stop_feature_name;
    }
  };

  const getFeatureGroups = (flowlinesData) => {
    const featurePoints = flowlinesData.features.filter(
      (feature) => feature.properties.feature_id
    );
    const featureNames = featurePoints.map(
      (feature) => feature.properties.feature_id
    );
    let uniqueFeatureNames = featureNames.filter(
      (item, i, ar) => ar.indexOf(item) === i
    );
    const fullDistance = flowlinesData.features[0].properties.pathlength;

    // This fixes a rare, but frustrating bug, where because I don't sample each flowline for VAA data, and because...
    // I assume once a feature starts that it continues until the next unique feature, this function gets confused by...
    // Long rivers sandwiching small unnames features, like the snake river in Idaho, and thinks that the small feature interruption
    // Is the new main feature until it hits the next unique feature name. This is sort of difficult to explain, but just trust that it's necessary.
    uniqueFeatureNames = uniqueFeatureNames.filter((name, i) => {
      if (i === 0) {
        return true;
      } else {
        const firstOccurence = featurePoints.findIndex(
          (point) => point.properties.feature_id === name
        );
        const featureData = featurePoints.find(
          (point) => point.properties.feature_id === name
        );

        const sandwichOccurence = featurePoints
          .slice(firstOccurence)
          .findIndex(
            (point) => point.properties.feature_id === uniqueFeatureNames[i - 1]
          );
        const surroundingFeatureData = featurePoints
          .slice(firstOccurence)
          .find(
            (point) => point.properties.feature_id === uniqueFeatureNames[i - 1]
          );

        if (
          sandwichOccurence > 0 &&
          surroundingFeatureData.properties.streamlvl ===
            featureData.properties.streamlvl
        ) {
          return false;
        } else {
          return true;
        }
      }
    });

    let riverFeatures = uniqueFeatureNames.map((feature, index) => {
      const featureData = flowlinesData.features.find(
        (item) => item.properties.feature_id === feature
      );
      const featureIndex = flowlinesData.features.findIndex(
        (item) => item.properties.feature_id === feature
      );

      return {
        feature_data_index: featureIndex,
        progress:
          fullDistance === -999
            ? featureIndex / flowlinesData.features.length
            : (fullDistance - featureData.properties.pathlength) / fullDistance,
        name: featureData.properties.feature_name,
        distance_from_destination:
          featureData.properties.pathlength === -9999
            ? 0
            : featureData.properties.pathlength,
        index,
        stream_level: featureData.properties.streamlvl,
        active: false,
      };
    });

    // Because I'm not sampling every flowline, sometimes I get weird results at the end of the flowpath where, for example, there's a flowline
    // that's part of the Mississippi Delta, but isn't technically isn't grouped under the Mississippi river, and it considers it the last step
    // Here, I'm going to treat anyting with streamlevel 1 (which means it's a terminal feature) as the last feature in the sequence, but add an
    // exception case for paths that stop at inland lakes, just in case their last feature isn't encoded as stream level 1
    let trueStopFeatureIndex = riverFeatures.findIndex(
      (feature) => feature.stream_level === 1
    );
    if (trueStopFeatureIndex === -1) {
      trueStopFeatureIndex = riverFeatures.length - 1;
    }
    riverFeatures = riverFeatures.slice(0, trueStopFeatureIndex + 1);

    riverFeatures.forEach((feature, i) => {
      if (i === riverFeatures.length - 1) {
        feature.length_km = Math.round(feature.distance_from_destination);
        feature.stop_point = null;

        feature.feature_data = [
          {
            geometry: {
              coordinates: flowlinesData.features
                .slice(feature.feature_data_index)
                .map((feature) => feature.geometry.coordinates)
                .flat(),
            },
          },
        ];
      } else {
        const featureLength =
          feature.distance_from_destination -
          riverFeatures[i + 1].distance_from_destination;
        feature.length_km = Math.round(featureLength);
        feature.stop_point = riverFeatures[i + 1].progress;

        feature.feature_data = [
          {
            geometry: {
              coordinates: flowlinesData.features
                .slice(
                  feature.feature_data_index,
                  riverFeatures[i + 1].feature_data_index
                )
                .map((feature) => feature.geometry.coordinates)
                .flat(),
            },
          },
        ];
      }
    });

    return riverFeatures;
  };

  const getFeatureVAA = async (feature, index, thinningIndex) => {
    if (index > 50 && index % thinningIndex !== 0) {
      return feature;
    }

    const baseUrl = "https://river-runner-20db3-default-rtdb.firebaseio.com/";
    const response = await fetch(
      baseUrl + feature.properties.nhdplus_comid + ".json"
    );
    const featureData = await response.json();

    feature.properties = {
      ...feature.properties,
      ...featureData,
      // feature_name: featureData.gnis_name || `Unnamed River/Stream (${featureData.levelpathid})`
      feature_name: featureData.gnis_name || `Unnamed River/Stream`,
      feature_id: featureData.gnis_name || featureData.levelpathid,
    };

    return feature;
  };

  const addVAAData = (flowlineFeatures) => {
    const thinningIndex = Math.ceil(flowlineFeatures.length / 250);
    return Promise.all(
      flowlineFeatures.map(
        async (feature, i) => await getFeatureVAA(feature, i, thinningIndex)
      )
    );
  };

  const getFeatureFlowrate = async (
    feature,
    index,
    thinningIndex,
    bufferSize = 50
  ) => {
    if (index > bufferSize && index % thinningIndex !== 0) {
      return feature;
    }

    const baseUrl = "https://river-runner-flowrates.firebaseio.com/";
    const response = await fetch(
      baseUrl + feature.properties.nhdplus_comid + ".json"
    );
    const featureData = await response.json();

    feature.properties = {
      ...feature.properties,
      flowrate: parseFloat(featureData.flowrate),
    };

    return feature;
  };

  const getFlowrateData = async (
    flowlineFeatures,
    thinningIndex = 4,
    bufferSize = 50
  ) => {
    // Gather a sample of flowline flowrate data from firebase server, using thinningIndex
    const flowrateData = await Promise.all(
      flowlineFeatures.map(
        async (feature, i) =>
          await getFeatureFlowrate(feature, i, thinningIndex, bufferSize)
      )
    );

    // Interpolate gathered data to fill values for flowlines filtered out by thinningIndex
    flowrateData.forEach((feature, i) => {
      if (i > bufferSize && i % thinningIndex !== 0) {
        const lastIndex = thinningIndex * Math.floor(i / thinningIndex);
        const nextIndex = thinningIndex * Math.ceil(i / thinningIndex);

        const lastValue = flowrateData[lastIndex].properties.flowrate;
        const nextValue = flowrateData[nextIndex]?.properties?.flowrate;

        let interpolatedValue = nextValue
          ? lastValue +
            (nextValue - lastValue) * ((i % thinningIndex) / thinningIndex)
          : lastValue;
        interpolatedValue = Math.ceil(interpolatedValue);

        feature.properties.flowrate = interpolatedValue;
      }
    });

    return flowrateData;
  };

  const positionCamera = ({
    map,
    cameraCoordinates,
    elevation,
    pitch,
    bearing,
  }) => {
    const camera = map.getFreeCameraOptions();

    // set the position and altitude of the camera
    camera.position = mapbox.MercatorCoordinate.fromLngLat(
      {
        lng: cameraCoordinates[0],
        lat: cameraCoordinates[1],
      },
      elevation
    );

    camera.setPitchBearing(pitch, bearing);
    map.setFreeCameraOptions(camera);
  };

  const precalculateInitialCamera = ({
    map,
    cameraStart,
    initialElevation,
    initialBearing,
    cameraPitch,
    smoothedPath,
    distanceGap,
    routeDistance,
  }) => {
    // Store current camera info
    const currentZoom = map.getZoom();
    const currentCenter = map.getCenter();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();

    let alongTarget = along(lineString(smoothedPath), routeDistance * 0.000005)
      .geometry.coordinates;

    if (alongTarget === smoothedPath[0]) {
      alongTarget = smoothedPath[1];
    }

    const alongCamera = findArtificialCameraPoint({
      distanceGap: altitudeMultiplier * distanceGap,
      originPoint: smoothedPath[0],
      targetPoint: alongTarget,
    });

    const bearing = bearingBetween(alongCamera, alongTarget);

    // Position the camera how it will be positioned on the first tick of the run
    positionCamera({
      map,
      cameraCoordinates: alongCamera,
      elevation: initialElevation,
      bearing,
      pitch: cameraPitch,
    });

    // Log the zoom/center
    const zoom = map.getZoom();
    const center = map.getCenter();

    // Send the camera back to where it came from, without user seeing anything
    map.jumpTo({
      zoom: currentZoom,
      center: currentCenter,
      bearing: currentBearing,
      pitch: currentPitch,
    });

    // Return zoom and center so that we can fly to the exact start point and it won't be jarring when the run starts
    return { zoom, center };
  };

  const runRiver = ({
    map,
    animationDuration,
    cameraBaseAltitude = 4300,
    cameraPitch = 70,
    distanceGap,
    coordinatePath,
    elevations,
    terrainElevationMultiplier,
    riverFeatures,
    flowrates,
  }) => {
    let start;

    const startPoints = riverFeatures.map((d) => d.progress);
    let startPoint = startPoints[0];

    const stopPoints = riverFeatures.map((d) => d.stop_point);
    let stopPoint = stopPoints[0];
    activeFeatureIndex = 0;

    let route = pathSmoother(
      coordinatePath,
      Math.min(
        Math.floor(9 * altitudeMultiplier),
        Math.floor(coordinatePath.length / 2)
      )
    );
    let routeDistance = pathDistance(route);

    let phase = 0;
    let tick = 0;
    let lastTime;
    let phaseGap = distanceGap / routeDistance;

    // This adjusts the run speed based on the altitude. It seems *very* complicated, but it's the closest I've come to keeping perceptual speed consistent.
    let speedCoefficient =
      1 / Math.pow(1 + 1.1 * Math.log(altitudeMultiplier), 1.25);

    const frame = (time) => {
      if (!start) {
        start = lastTime = time;
      }

      // If a user has clicked one of the features in the navigation box, we'll need to adjust the "phase" to jump to that feature
      if (phaseJump !== undefined) {
        phase = phaseJump;

        startPoint = startPoints[activeFeatureIndex];
        stopPoint = stopPoints[activeFeatureIndex];

        phaseJump = undefined;
      }

      if (altitudeChange) {
        route = pathSmoother(
          coordinatePath,
          Math.min(
            Math.floor(9 * altitudeMultiplier),
            Math.floor(coordinatePath.length / 2)
          )
        );
        routeDistance = pathDistance(route);

        phaseGap = distanceGap / routeDistance;

        // This adjusts the run speed based on the altitude. It seems *very* complicated, but it's the closest I've come to keeping perceptual speed consistent.
        speedCoefficient =
          1 / Math.pow(1 + 1.1 * Math.log(altitudeMultiplier), 1.25);

        altitudeChange = false;
      }

      // phase determines how far through the animation we are
      if (!paused) {
        phase +=
          playbackSpeed *
          ((time - lastTime) / (animationDuration * speedCoefficient));
      }

      // If rewinding and user rewinds past the start, this will puase it and keep it from bugging out
      if (phase < 0) {
        phase = 0;
        playbackSpeed = 1;
        paused = true;
      }

      lastTime = time;

      const adjustedTargetPhase = altitudeMultiplier * phaseGap + phase;

      // When finished, exit animation loop and zoom out to show ending point
      if (phase > 1 || aborted === true) {
        exitNavigation({ map, coordinatePath });
        return;
      }

      // When you hit next feature group, adjust index
      if (stopPoint && phase >= stopPoint) {
        activeFeatureIndex += 1;
        startPoint = stopPoint;
        stopPoint = stopPoints[activeFeatureIndex];
      }

      // If winding in reverse, and encountering a feature group change, do the reverse
      if (startPoint && phase <= startPoint) {
        activeFeatureIndex -= 1;
        stopPoint = startPoint;
        startPoint = startPoints[activeFeatureIndex];
      }

      // Calculate camera elevation using the base elevation and the elevation at the specific coordinate point
      const elevationLast = elevations[Math.floor(elevations.length * phase)];
      const elevationNext =
        elevations[Math.ceil(elevations.length * phase)] ||
        elevations[Math.ceil(elevations.length * phase) - 1];
      const elevationStepProgress =
        elevations.length * phase - Math.floor(elevations.length * phase);

      const elevationEstimate =
        elevationLast + (elevationNext - elevationLast) * elevationStepProgress;
      const tickElevation =
        cameraBaseAltitude +
        altitudeMultiplier *
          terrainElevationMultiplier *
          Math.round(elevationEstimate);

      let alongTarget = along(
        lineString(route),
        routeDistance * (phase === 0 ? 0.000005 : phase)
      ).geometry.coordinates;

      if (alongTarget === route[0]) {
        alongTarget = route[1];
      }

      const alongCamera =
        phase - altitudeMultiplier * phaseGap < 0
          ? findArtificialCameraPoint({
              distanceGap: altitudeMultiplier * distanceGap,
              originPoint: route[0],
              targetPoint: alongTarget,
            })
          : along(
              lineString(route),
              routeDistance * (phase - altitudeMultiplier * phaseGap)
            ).geometry.coordinates;

      const bearing = bearingBetween(alongCamera, alongTarget);

      // Generate/position a camera along route, pointed in direction of target point at set pitch
      positionCamera({
        map,
        cameraCoordinates: alongCamera,
        elevation: tickElevation,
        pitch: cameraPitch,
        bearing,
      });

      // Set new flowrate value for water level gauge
      currentFlowrate = {
        level: flowrates[Math.floor(flowrates.length * phase)],
        index: Math.floor(flowrates.length * phase),
      };

      // This will update the location of the marker on the locator map
      if (tick % 5 === 0) {
        currentLocation = alongTarget;
      }
      tick += 1;

      window.requestAnimationFrame(frame);
    };

    window.requestAnimationFrame(frame);
  };

  const exitNavigation = ({ map, coordinatePath }) => {
    if (!aborted) {
      activeFeatureIndex += 1;
    } else {
      activeFeatureIndex = -1;
    }

    aborted = false;
    const bounds = getDataBounds(coordinatePath, true);

    map.fitBounds(bounds, {
      bearing: 0,
      pitch: 0,
      padding: 70,
      maxZoom: 12,
      offset: window.innerWidth < 600 ? [0, -20] : [0, 0], // On mobile, the search bar will get in the way so we actually want it a little off center
    });

    map.once("moveend", () => {
      vizState = "overview";
      postRun = true;
      // map.interactive = true;
      map.scrollZoom.enable();
      // resetMapState({ map });
    });
  };

  const resetMapState = ({ map, error = false }) => {
    map.interactive = true;
    map.scrollZoom.enable();
    aborted = false;

    clearRiverLines({ map });

    currentLocation = undefined;
    activeFeatureIndex = -1;

    if (error) {
      setTimeout(() => {
        vizState = "uninitialized";
      }, 2000);
    } else {
      vizState = "uninitialized";
    }

    d3.select(".mapboxgl-ctrl-geocoder").style("display", "block");
    d3.select(".mapboxgl-ctrl-top-left").style("display", "block");
  };

  const highlightRiverFeature = (featureIndex) => {
    drawFlowPath({
      map,
      featureData: featureGroups[featureIndex].feature_data,
      lineColor: "yellow",
      lineWidth: 4,
      sourceID: "highlighted-section",
    });
  };

  const resetRiverHighlight = () => {
    clearRiverLines({ map, sourceID: "highlighted-section" });
  };

  const handleResize = () => {
    mapBounds = map.getBounds();
  };

  const exitFunction = () => {
    aborted = true;
  };

  const handleJump = (e) => {
    activeFeatureIndex = e.detail.featureIndex;
    phaseJump = e.detail.pathProgress;
  };

  const jumpIndex = (direction) => {
    if (
      direction === "forward" &&
      activeFeatureIndex + 1 < featureGroups.length
    ) {
      activeFeatureIndex = Math.min(
        activeFeatureIndex + 1,
        featureGroups.length - 1
      );
      phaseJump = featureGroups[activeFeatureIndex].progress;
    } else if (direction === "backward" && activeFeatureIndex - 1 >= 0) {
      activeFeatureIndex = Math.max(activeFeatureIndex - 1, 0);
      phaseJump = featureGroups[activeFeatureIndex].progress;
    }
  };

  const setAltitudeMultipier = (e) => {
    // console.log(e.target.value);
    altitudeChange = true;
    altitudeMultiplier = e.target.value;
  };

  const togglePause = () => {
    if (playbackSpeed !== 1) {
      playbackSpeed = 1;
      paused = false;
    } else {
      paused = !paused;
    }
  };

  const setPlaybackSpeed = (newVal) => {
    paused = false;
    playbackSpeed = newVal;
  };

  const toggleSiteLayer = (layerID, siteName) => {
    const currentVisibility = map.getLayoutProperty(layerID, "visibility");

    // Toggle layer visibility by changing the layout object's visibility property.
    if (!currentVisibility || currentVisibility === "visible") {
      siteTypeData[siteName].hidden = true;
      map.setLayoutProperty(layerID, "visibility", "none");
    } else {
      siteTypeData[siteName].hidden = false;
      map.setLayoutProperty(layerID, "visibility", "visible");
    }
  };

  $: coordinates.update(() => {
    if (mapBounds._sw) {
      return [
        [mapBounds._sw.lat, mapBounds._ne.lat],
        [mapBounds._sw.lng, mapBounds._ne.lng],
      ];
    }
  });
</script>

<svelte:window on:resize={handleResize} />

<div
  class="map-wrapper"
  style="opacity: {visibleIndex ? 1 : 0}"
  bind:this={container}
>
  {#if map}
    <slot />
  {/if}
</div>

<Prompt
  on:abort-run={exitFunction}
  {vizState}
  {currentLocation}
/>
<ContactBox {vizState} />

<div class="left-column" style="z-index: {vizState === 'running' ? 10 : -10};">
  <LocatorMap
    {bounds}
    {stateBoundaries}
    visibleIndex={null}
    {riverPath}
    {currentLocation}
    {vizState}
    {activeFeatureIndex}
    {featureGroups}
  />
  {#if window.innerWidth > 600 && advancedFeaturesOn === true}
    <WaterLevelDisplay
      {currentFlowrate}
      {maxFlowrate}
      {flowrates}
      {vizState}
      {activeFeatureIndex}
    />
  {/if}
</div>

<div class="right-column">
  <NavigationInfo
    on:highlight-feature={(e) => highlightRiverFeature(e.detail.featureIndex)}
    on:remove-highlight={resetRiverHighlight}
    on:run-path={() => {
      startRun({ map, ...runSettings });
    }}
    on:exit-path={() => resetMapState({ map })}
    on:abort-run={exitFunction}
    on:progress-set={(e) => handleJump(e)}
    {vizState}
    {activeFeatureIndex}
    {featureGroups}
    {totalLength}
    {startCoordinates}
    {postRun}
    {runTimeout}
  />
  <Controls
    {setAltitudeMultipier}
    {altitudeMultiplier}
    {jumpIndex}
    {playbackSpeed}
    {setPlaybackSpeed}
    {paused}
    {togglePause}
    {activeFeatureIndex}
    {vizState}
    featureGroupLength={featureGroups.length}
  />

  {#if siteTypes.length > 0}
    <Legend
      {vizState}
      {activeFeatureIndex}
      {siteTypeData}
      {siteTypes}
      {toggleSiteLayer}
    />
  {/if}
</div>

<style>
  .map-wrapper {
    position: absolute;
    width: 100vw;
    height: 100vh;
    z-index: 1;
  }

  :global(.mapboxgl-canvas) {
    cursor: pointer;
  }

  :global(.mapboxgl-ctrl-top-left .mapboxgl-ctrl) {
    margin: 1rem 0 0 1rem !important;
  }

  :global(.mapboxgl-popup-content) {
    padding: 1rem 1rem 1rem !important;
    box-shadow: 3px 3px 2px 1px rgba(34, 34, 34, 0.4) !important;
    font-size: 0.85rem;
    font-family: "Roboto", "Inter", Arial, Helvetica, sans-serif;
  }

  :global(.mapboxgl-popup-content h3) {
    font-size: 1.1rem;
    margin: 0.5rem 0;
    font-weight: bold;
  }

  @media only screen and (min-width: 601px) {
    .right-column,
    .left-column {
      display: flex;
      position: absolute;
      flex-direction: column;
      gap: 1rem;
    }

    .right-column {
      right: 3rem;
      top: 3rem;
      z-index: 20;
    }

    .left-column {
      left: 2rem;
      top: 2rem;
      justify-content: space-between;
      bottom: 2rem;
    }
  }

  @media only screen and (max-width: 600px) {
    .map-wrapper {
      /* this prevents some weird stuff on mobile screens when the geolocator search suggestons come up*/
      /* height: max(400px, calc(100% - 20vh)); */
      height: calc(100% - 20vh - 1.5rem);
      top: 20vh;
      bottom: 1.5rem;
    }
  }

  /* Keyboard open */
  @media only screen and (max-width: 600px) and (max-height: 400px) {
    .map-wrapper {
      height: 100%;
      top: 0;
    }
  }

  /* Tablet */
  @media only screen and (min-width: 601px) and (max-width: 1100px) {
    .right-column {
      bottom: 3rem;
    }

    :global(.mapboxgl-ctrl-top-left .mapboxgl-ctrl) {
      margin: 1.5rem 0 0 1rem !important;
    }
  }
</style>
