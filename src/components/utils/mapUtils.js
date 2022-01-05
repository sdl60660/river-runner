import {
  nwisPopupFormat,
  wqpPopupFormat,
  caGagePopupFormat,
  wadePopupFormat,
} from "./popupFormats";

import { addFeatureExtrusions } from "./mapboxUtils";

export const sendQueryData = async (lat, lng, startingSearch, query_error=false) => {
  const queryData = {
    lat,
    lng,
    from_share_link: startingSearch === true,
    query_error
  };

  fetch("https://river-runner-name-suggestions.herokuapp.com/api/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(queryData),
  });
};

export const basicSiteTypeData = {
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

export const fetchNLDI = async (closestFeature, featureTypes, map, activeNWISSites) => {
  let [flowlinesData, nwisData, caGageData, wqpData, wadeData] = await Promise.all(
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
      d.properties.weblink = weblinkData[i] === null ? null : weblinkData[i].properties.weblink;
    });

    caGageData.features = caGageData.features.slice().filter((d) => d.properties.weblink !== null);
  }

  // For each site type that exists on a given run, plot it the points and add them to a data array for the legend to use
  siteTypes = [];
  [nwisData, wqpData, wadeData, caGageData].forEach((featureSet) => {
    if (featureSet && featureSet.features.length > 0) {
      const sourceName = featureSet.features[0].properties.sourceName;

      siteTypes.push(sourceName);
      const siteData = siteTypeData[sourceName];

      addFeatureExtrusions({ map, featureSet, ...siteData });
    }
  });

  return flowlinesData;
};

export const getSiteData = async (closestFeature, siteType) => {
  const siteURL =
    closestFeature.properties.navigation + "/DM/" + siteType + "?f=json&distance=6000";
  const response = await fetch(siteURL);

  try {
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
};

export const getFeatureVAA = async (feature, index, thinningIndex) => {
  if (index > 50 && index % thinningIndex !== 0) {
    return feature;
  }
  const baseUrl = "https://river-runner-20db3-default-rtdb.firebaseio.com/";
  const response = await fetch(baseUrl + feature.properties.nhdplus_comid + ".json");
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

export const addVAAData = (flowlineFeatures) => {
  const thinningIndex = Math.ceil(flowlineFeatures.length / 250);
  return Promise.all(
    flowlineFeatures.map(async (feature, i) => await getFeatureVAA(feature, i, thinningIndex))
  );
};

export const findClosestFeature = async (e) => {
  let closestFeature;
  let resultFound = false;
  let roundingDigits = 6;
  while (resultFound === false && roundingDigits >= 0) {
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

export const getTickElevation = (
  phase,
  elevations,
  altitudeMultiplier,
  cameraBaseAltitude,
  terrainElevationMultiplier
) => {
  const elevationLast = elevations[Math.floor(elevations.length * phase)];
  const elevationNext =
    elevations[Math.ceil(elevations.length * phase)] ||
    elevations[Math.ceil(elevations.length * phase) - 1];
  const elevationStepProgress = elevations.length * phase - Math.floor(elevations.length * phase);

  const elevationEstimate = elevationLast + (elevationNext - elevationLast) * elevationStepProgress;

  const tickElevation =
    altitudeMultiplier *
    (cameraBaseAltitude + terrainElevationMultiplier * Math.round(elevationEstimate));

  return tickElevation;
};

export const getFlowrateData = async (flowlineFeatures, thinningIndex = 4, bufferSize = 50) => {
  // Gather a sample of flowline flowrate data from firebase server, using thinningIndex
  const flowrateData = await Promise.all(
    flowlineFeatures.map(
      async (feature, i) => await getFeatureFlowrate(feature, i, thinningIndex, bufferSize)
    )
  );

  // Interpolate gathered data to fill values for flowlines filtered out by thinningIndex
  flowrateData.forEach((feature, i) => {
    if (i > bufferSize && i % thinningIndex !== 0) {
      const lastIndex = thinningIndex * Math.floor(i / thinningIndex);
      const nextIndex = thinningIndex * Math.ceil(i / thinningIndex);

      const lastValue = flowrateData[lastIndex].properties.flowrate;
      const nextValue = flowrateData[nextIndex] ? flowrateData[nextIndex].properties.flowrate : null;

      let interpolatedValue = nextValue
        ? lastValue + (nextValue - lastValue) * ((i % thinningIndex) / thinningIndex)
        : lastValue;
      interpolatedValue = Math.ceil(interpolatedValue);

      feature.properties.flowrate = interpolatedValue;
    }
  });

  return flowrateData;
};

export const getFeatureFlowrate = async (feature, index, thinningIndex, bufferSize = 50) => {
  if (index > bufferSize && index % thinningIndex !== 0) {
    return feature;
  }

  const baseUrl = "https://river-runner-flowrates.firebaseio.com/";
  const response = await fetch(baseUrl + feature.properties.nhdplus_comid + ".json");
  const featureData = await response.json();

  feature.properties = {
    ...feature.properties,
    flowrate: parseFloat(featureData.flowrate),
  };

  return feature;
};
