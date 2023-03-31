import mapboxgl from "mapbox-gl";
import { mapbox } from "../../mapbox.js";
import { mapboxAccessToken } from "../../access_tokens";
import { easeCubicOut, easeLinear } from "d3-ease";
import circle from "@turf/circle";

export const getElevations = async (coordinatePath, arrayStep = 10) => {
  const elevationCoordinates = coordinatePath.filter((element, index) => {
    return index % arrayStep === 0;
  });

  const responses = await Promise.all(
    elevationCoordinates.map(([lng, lat]) =>
      fetch(
        `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?&access_token=${mapboxAccessToken}`
      ).then((response) => response.json())
    )
  );

  const data = responses
    .map((res) => res.features.slice(-1)[0].properties.ele)
    .map((d, i, n) => {
      if (d) {
        return d;
      } else if (i === 0) {
        return n[i + 1];
      } else {
        return n[i - 1];
      }
    });

  return data;
};

export const getElevationsMapQuery = (coordinatePath, map, arrayStep = 10) => {
  const elevationCoordinates = coordinatePath.filter((element, index) => {
    return index % arrayStep === 0;
  });

  return elevationCoordinates.map((d) =>
    map.queryTerrainElevation(d, { exaggerated: true })
  );
};

export const addFeatureExtrusions = ({
  map,
  formatterFunction,
  featureSet,
  layerID,
  color,
  markerRadius,
  markerHeight = 50,
}) => {
  if (featureSet === null) {
    return;
  }

  if (map.getLayer(layerID)) {
    map.removeLayer(layerID);
  }

  if (map.getSource(layerID)) {
    map.removeSource(layerID);
  }

  featureSet.features.forEach((d) => {
    d.properties.original_center = d.geometry.coordinates;
    d.geometry = circle(d.geometry.coordinates, markerRadius, {
      steps: 30,
    }).geometry;
  });

  map.addSource(layerID, {
    type: "geojson",
    data: featureSet,
  });

  map.addLayer({
    id: layerID,
    source: layerID,
    type: "fill-extrusion",
    paint: {
      "fill-extrusion-color": color,
      "fill-extrusion-opacity": 0.8,
      "fill-extrusion-height": markerHeight,
      "fill-extrusion-base": 0,
    },
  });

  map.on("click", layerID, (e) => {
    if (
      (layerID === "wqp-points" ||
        layerID === "wade-points" ||
        layerID === "ca-gage-points") &&
      map
        .queryRenderedFeatures(e.point)
        .some((feature) => feature.source === "nwis-points")
    ) {
      return;
    }

    if (e.features.length > 0) {
      new mapbox.Popup({
        closeButton: false,
        closeOnClick: true,
        maxWidth: 400,
      })
        .setLngLat(e.lngLat)
        .setHTML(formatterFunction({ feature: e.features[0] }))
        .addTo(map);
    }
  });

  return;
};

export const addTopoLayer = ({ map }) => {
  map.addSource("mapbox-dem", {
    type: "raster-dem",
    url: "mapbox://mapbox.mapbox-terrain-dem-v1",
    tileSize: 512,
    maxzoom: 14,
  });

  // add the DEM source as a terrain layer with exaggerated height
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });

  map.addLayer({
    id: "sky",
    type: "sky",
    paint: {
      "sky-type": "atmosphere",
      "sky-atmosphere-sun": [0.0, 0.0],
      "sky-atmosphere-sun-intensity": 15,
    },
  });
};

export const addBuildingLayer = ({ map }) => {
  // reference: https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/

  // Insert the layer beneath any symbol layer.
  const layers = map.getStyle().layers;
  const labelLayerId = layers.find(
    (layer) => layer.type === "symbol" && layer.layout["text-field"]
  ).id;

  // The 'building' layer in the Mapbox Streets
  // vector tileset contains building height data
  // from OpenStreetMap.
  map.addLayer(
    {
      id: "add-3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 15,
      paint: {
        "fill-extrusion-color": "#aaa",

        // Use an 'interpolate' expression to
        // add a smooth transition effect to
        // the buildings as the user zooms in.
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          0,
          12.05,
          ["get", "height"],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          0,
          12.05,
          ["get", "min_height"],
        ],
        "fill-extrusion-opacity": 0.6,
      },
    },
    labelLayerId
  );
};

export const clearRiverLines = ({ map, sourceID = "route" }) => {
  if (map.getLayer(sourceID)) {
    map.removeLayer(sourceID);
  }

  if (map.getSource(sourceID)) {
    map.removeSource(sourceID);
  }
};

export const drawFlowPath = ({
  map,
  featureData,
  lineColor = "steelblue",
  lineWidth = 3,
  sourceID = "route",
}) => {
  clearRiverLines({ map, sourceID });
  addRivers({ map, featureData, lineColor, lineWidth, sourceID });
};

export const addRivers = ({
  map,
  featureData,
  lineColor = "steelblue",
  lineWidth = 1,
  sourceID = "route",
}) => {
  const features = featureData.map((river) => {
    // Some rivers in some files have multiple linestrings (such as the Mississippi)...
    // their coordinates will be a triple-nested array instead of a double-nested
    const featureType = Array.isArray(river.geometry.coordinates[0][0])
      ? "MultiLineString"
      : "LineString";

    return {
      type: "Feature",
      properties: river.properties,
      geometry: {
        type: featureType,
        coordinates: river.geometry.coordinates,
      },
    };
  });

  map.addSource(sourceID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features,
    },
  });

  map.addLayer({
    id: sourceID,
    type: "line",
    source: sourceID,
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": lineColor,
      "line-width": lineWidth,
    },
  });
};

// This method and the two below it come from here: https://github.com/mapbox/impact-tools/blob/master/journey-animation-sequence/js/fly-in-and-rotate.js
// Written by @chriswhong and I think will solve the seam on the fly to path run issue that has been buggin me for forever
export const flyInAndRotate = async ({
  map,
  targetLngLat,
  duration,
  startAltitude,
  endAltitude,
  startBearing,
  endBearing,
  startPitch,
  endPitch,
  prod,
}) => {
  return new Promise(async (resolve) => {
    let start;

    var currentAltitude;
    var currentBearing;
    var currentPitch;

    // the animation frame will run as many times as necessary until the duration has been reached
    const frame = async (time) => {
      if (!start) {
        start = time;
      }

      // otherwise, use the current time to determine how far along in the duration we are
      let animationPhase = (time - start) / duration;

      // because the phase calculation is imprecise, the final zoom can vary
      // if it ended up greater than 1, set it to 1 so that we get the exact endAltitude that was requested
      if (animationPhase > 1) {
        animationPhase = 1;
      }

      currentAltitude =
        startAltitude +
        (endAltitude - startAltitude) * easeCubicOut(animationPhase);
      // rotate the camera between startBearing and endBearing
      currentBearing =
        startBearing +
        (endBearing - startBearing) * easeCubicOut(animationPhase);

      currentPitch =
        startPitch + (endPitch - startPitch) * easeCubicOut(animationPhase);

      // compute corrected camera ground position, so the start of the path is always in view
      var correctedPosition = computeCameraPosition(
        currentPitch,
        currentBearing,
        targetLngLat,
        currentAltitude
      );

      // set the pitch and bearing of the camera
      const camera = map.getFreeCameraOptions();
      camera.setPitchBearing(currentPitch, currentBearing);

      // set the position and altitude of the camera
      camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
        correctedPosition,
        currentAltitude
      );

      // apply the new camera options
      map.setFreeCameraOptions(camera);

      // when the animationPhase is done, resolve the promise so the parent function can move on to the next step in the sequence
      if (animationPhase === 1) {
        resolve({
          bearing: currentBearing,
          altitude: currentAltitude,
        });

        // return so there are no further iterations of this frame
        return;
      }

      await window.requestAnimationFrame(frame);
    };

    await window.requestAnimationFrame(frame);
  });
};

// Comment from @chriswhong below
// amazingly simple, via https://codepen.io/ma77os/pen/OJPVrP
export function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

let previousCameraPosition;
export const computeCameraPosition = (
  pitch,
  bearing,
  targetPosition,
  altitude,
  smooth = false
) => {
  var bearingInRadian = bearing / 57.29;
  var pitchInRadian = (90 - pitch) / 57.29;

  var lngDiff =
    ((altitude / Math.tan(pitchInRadian)) * Math.sin(-bearingInRadian)) / 70000; // ~70km/degree longitude
  var latDiff =
    ((altitude / Math.tan(pitchInRadian)) * Math.cos(-bearingInRadian)) /
    110000; // 110km/degree latitude

  var correctedLng = targetPosition.lng + lngDiff;
  var correctedLat = targetPosition.lat - latDiff;

  const newCameraPosition = {
    lng: correctedLng,
    lat: correctedLat,
  };

  if (smooth) {
    if (previousCameraPosition) {
      const SMOOTH_FACTOR = 0.95;
      newCameraPosition.lng = lerp(
        newCameraPosition.lng,
        previousCameraPosition.lng,
        SMOOTH_FACTOR
      );
      newCameraPosition.lat = lerp(
        newCameraPosition.lat,
        previousCameraPosition.lat,
        SMOOTH_FACTOR
      );
    }
  }

  previousCameraPosition = newCameraPosition;

  return newCameraPosition;
};
