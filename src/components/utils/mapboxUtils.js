import { mapbox } from "../../mapbox.js";
import { mapboxAccessToken } from "../../access_tokens";
import { circle } from "@turf/circle";

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
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.7 });

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
  lineWidth = 2,
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
