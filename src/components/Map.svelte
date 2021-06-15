<script>
	import { tick, onMount } from 'svelte';
	import { mapbox } from '../mapbox.js';
	import { mapboxAccessToken } from '../access_tokens';
	import * as d3 from 'd3';
	import { parse } from 'node-html-parser';

	import along from '@turf/along';
	import { feature, featureCollection, lineString, point } from '@turf/helpers';
	import lineDistance from '@turf/line-distance';
	import distance from '@turf/distance';
	import destination from '@turf/destination';
	import lineSplit from '@turf/line-split';
	import length from '@turf/length';
	import circle from '@turf/circle';

	import { bearingBetween, distanceToPolygon, getDataBounds } from '../utils';
	import { coordinates, stoppingFeature } from '../state';
	
	import Prompt from './Prompt.svelte';
	import NavigationInfo from './NavigationInfo.svelte';
	import LocatorMap from './LocatorMap.svelte';
	import ContactBox from './ContactBox.svelte';
	import Controls from './Controls.svelte';

	export let bounds;
	export let stateBoundaries;
	export let activeNWISSites;
	export let stoppingFeatures;
	export let featureData = undefined;
	export let visibleIndex;
	export let mapStyle;
	export let addTopo;

	const urlParams = new URLSearchParams(window.location.search);
	let startingSearch = urlParams.has('lat') ? { lngLat: { lat: +urlParams.get('lat'), lng: +urlParams.get('lng') }}: null;

	let container;
	let map;
	let mapBounds = bounds;
	let runSettings = {};

	let aborted = false;
	let vizState = "uninitialized";

	let riverPath;
	let currentLocation;
	let startCoordinates;
	let featureGroups = [];
	let activeFeatureIndex = -1;
	let totalLength;

	let phaseJump;
	
	// Zoom level won't be adjustable on mobile, but it will be set slightly higher to avoid jiterriness
	let altitudeMultiplier = window.innerWidth > 600 ? 0.7 : 1.1;
	let altitudeChange = false;
	let paused = false;
	let playbackSpeed = 1;
	// let pitchMutiplier = 1; // this one might be a bad idea

	onMount( async () => {
		await tick();

		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://unpkg.com/mapbox-gl/dist/mapbox-gl.css';

		link.onload = () => {
			map = new mapbox.Map({
				container,
				style: mapStyle || 'mapbox://styles/mapbox/light-v10',
				center: [0, 0],
				zoom: 9
			});

			map.fitBounds(bounds, { animate: false, padding: 30 });
			map.setMaxBounds(map.getBounds());
			mapBounds = map.getBounds();

            map.on('load', () => {
				// If there's feature data passed in as a prop (doesn't really happen anymore), render rivers on load
				if (featureData) {
					addRivers({ map, featureData, lineWidth: 1 });
				}

				// Add 3D topo layer if flag is set (should basically always be)
				if (addTopo) {
					addTopoLayer({ map });
				}

				// Add geocoder search bar to search for location/address instead of clicking
				const geocoder = initGeocoder({ map });	

				// Initialize and add explicit zoom controls in top-left corner, if not on mobile
				const nav = new mapbox.NavigationControl({
					showCompass: false,
					visualizePitch: true
				});
				if (window.innerWidth > 600) {
					map.addControl(nav, 'top-left');
				}
				
				// If starting coordinates were passed in as a parameter (from a shared link), load starting path
				if (startingSearch) {
					initRunner({ map, e: startingSearch });
					startingSearch = null;
				}
            });

			map.on('click', async (e) => {
				if (vizState === "uninitialized") {
					initRunner({ map, e });
				}
			});
        };

		document.head.appendChild(link);

		return () => {
			map.remove();
			link.parentNode.removeChild(link);
		};
	});

	const initGeocoder = ({ map }) => {
		const geocoder = new MapboxGeocoder({
			accessToken: mapboxAccessToken,
			countries: 'us',
			bbox: bounds.flat(),
			mapboxgl: mapbox,
			placeholder: "Search for any location",
			marker: false,
			flyTo: false
		});

		if (window.innerWidth < 600 ) {
			geocoder.setLimit(4);
		}

		geocoder.on('result', (e) => { 
			const result = e.result;
			result.lngLat = {
				lng: result.geometry.coordinates[0],
				lat: result.geometry.coordinates[1]
			};
			geocoder.clear();

			initRunner({ map, e: result });
		});

		const position = window.innerWidth > 600 ? 'top-right' : 'bottom-left';
		map.addControl(geocoder, position);				
	}

	const initRunner = async ({ map, e }) => {
		// If a click is in the middle of processing, just return
		if (map.interactive === false) {
			return;
		}

		// Turn off map interactivity
		map.interactive = false;
		map.scrollZoom.disable();
		d3.select(".mapboxgl-ctrl-geocoder").style("display", "none");
		d3.select(".mapboxgl-ctrl-top-left").style("display", "none");

		currentLocation = e.lngLat;
		startCoordinates = e.lngLat;
		
		// Use the NLDI API to find the closest flowline coordinate to the click
		const closestFeature = await findClosestFeature(e);

		// If no feature can be found, even after rounding coordinates off, send error message and reset
		if ( !closestFeature ) {
			vizState = "error";
			resetMapState({ map, error: true });
			return;
		}

		// Get downstream flowline path from origin point, as well as NWIS Sites, Reference Gages, WQP Sites, WaDE Sites
		const featureTypes = ['flowlines', 'nwissite', 'ref_gage', 'wqp', 'wade'];
		let [flowlinesData, nwisData, refgageData, wqpData, wadeData] = await Promise.all(
			featureTypes.map(siteType => getSiteData(closestFeature, siteType))
		);

		// nwisData.features = appendNWISImageData(nwisData.features);
		nwisData.features.forEach( feature => {
			feature.properties.display_image = activeNWISSites.includes(feature.properties.identifier.slice(5));
		})

		addFeatureExtrusions({ map, featureSet: nwisData, formatterFunction: nwisPopupFormat, layerID: 'nwis-points', color: 'green', markerRadius: 0.1, markerHeight: 80 });
		addFeatureExtrusions({ map, featureSet: wqpData, formatterFunction: wqpPopupFormat, layerID: 'wqp-points', color: 'yellow', markerRadius: 0.06 });
		addFeatureExtrusions({ map, featureSet: wadeData, formatterFunction: wadePopupFormat, layerID: 'wade-points', color: '#9e0e0e', markerRadius: 0.06 });
		// addFeaturePopups({ map, featureSet: wadeData, filterIndex: 100 });

		// Append VAA data from firebase to flowline data
		flowlinesData.features = await addVAAData(flowlinesData.features);
		
		// Find the parent features of flowlines along the path
		totalLength = flowlinesData.features[0].properties.pathlength > 0 ? flowlinesData.features[0].properties.pathlength : undefined;
		const riverFeatures = getFeatureGroups(flowlinesData);
		featureGroups = riverFeatures;

		// Find start and end points
		const startRiver = flowlinesData.features[0];
		const originPoint = startRiver.geometry.coordinates[0];
		const destinationPoint = flowlinesData.features.slice(-1)[0].geometry.coordinates.slice(-1)[0];

		// console.log('Clicked on:', e.lngLat, 'Closest point:', originPoint);

		// Construct full coordinate path by taking the first coordinate in each flowline (each coordinate in the flowline is an unnecessary level of detail)
		const coordinatePath = flowlinesData.features.length > 3 ? [flowlinesData.features[0].geometry.coordinates[0], ...flowlinesData.features.map( feature => feature.geometry.coordinates.slice(-1)[0] ) ]
															 : flowlinesData.features.map( feature => feature.geometry.coordinates).flat().filter((d,i) => i % 2 === 0);

		// Update props used by child components
		riverPath = [{ geometry: { coordinates: coordinatePath }}];
		currentLocation = originPoint;
		vizState = "calculating";

		// Determine stopping feature by finding closest feature in stopping feature dataset
		const pathStoppingFeature = determineStoppingFeature({ destinationPoint, stoppingFeatures });
		stoppingFeature.update(() => pathStoppingFeature);
		
		// Draw river lines from flowline features. Combining them aboids mapbox simplification on low zoom levels that creates a choppy looking flow path.
		const combinedFlowlines = flowlinesData.features[0];
		combinedFlowlines.geometry.coordinates = flowlinesData.features.map(a => a.geometry.coordinates).flat();
		drawFlowPath({ map, featureData: [combinedFlowlines], lineWidth: 3 });

		let terrainElevationMultiplier = 1;
		let cameraBaseAltitude = 3600;
		const elevationArrayStep = Math.min((coordinatePath.length/2) - 1, 100);

		// const elevations = await getElevations(coordinatePath, elevationArrayStep);
		let elevations = getElevationsMapQuery(coordinatePath, elevationArrayStep);
		if (elevations.includes(null)) {
			elevations = await getElevations(coordinatePath, elevationArrayStep);
			cameraBaseAltitude = 4300;
			terrainElevationMultiplier = 1.25;
		}

		// Take base altitude and then adjust up based on the elevation of the first coordinate
		// The multiplier is necessary for higher elevations since they tend to be mountainous areas, as well, requiring additional height for the camera
		const initialElevation = cameraBaseAltitude + altitudeMultiplier*terrainElevationMultiplier*Math.round(elevations[0]);
		const targetPitch = 67;
		const distanceGap = initialElevation*Math.tan(targetPitch * Math.PI/180) / 1000;

		// Create smoothed path by averaging coordinates with their neighbors. This helps reduce horizontal movement with bendy rivers.
		// const smoothedPath = pathSmoother(coordinatePath, Math.min(9, Math.floor(coordinatePath.length / 2)));
		const smoothedPath = pathSmoother(coordinatePath, Math.min(Math.floor(9*altitudeMultiplier), Math.floor(coordinatePath.length / 2)));

		const routeDistance = pathDistance(smoothedPath);
		const trueRouteDistance = pathDistance(coordinatePath);

		let firstBearingPoint = along(
			lineString(smoothedPath),
			routeDistance * 0.00005
		).geometry.coordinates;

		if (firstBearingPoint === smoothedPath[0]) {
			firstBearingPoint = smoothedPath[1];
		}
		const cameraStart = findArtificialCameraPoint({ distanceGap: altitudeMultiplier*distanceGap, originPoint: smoothedPath[0], targetPoint: firstBearingPoint}) 

		// console.log('Distances:', routeDistance, cameraRouteDistance, trueRouteDistance);
		const initialBearing = bearingBetween( cameraStart, smoothedPath[0] );

		// We'll calculate the pitch based on the altitude/distance from camera to target
		const cameraPitch = calculatePitch(initialElevation, 1000*distance(cameraStart, smoothedPath[0]));

		// Pre-calculate initial camera center/zoom based on starting coordinates, so that flyTo fucntion can end in correct place
		const { zoom, center } = precalculateInitialCamera({ map, cameraStart, initialElevation, initialBearing, cameraPitch });

		runSettings = { zoom, center, cameraBaseAltitude, cameraPitch, coordinatePath, initialBearing, smoothedPath, routeDistance, distanceGap, elevations, terrainElevationMultiplier, riverFeatures };
		startRun({ map, ...runSettings });
		
		// When using the vizState change/return instead of startRun, it displays the overview before automatically starting the run
		// This is probably ideal in an ideal world, but I'm worried too many users will just miss the run functionality entirely
		// vizState = "overview";
		// map.scrollZoom.enable();

		// return;
	}

	const startRun = ({ map, zoom, center, cameraBaseAltitude, cameraPitch, coordinatePath, initialBearing, smoothedPath, routeDistance, distanceGap, elevations, terrainElevationMultiplier, riverFeatures }) => {		
		map.scrollZoom.disable();

		altitudeMultiplier = 0.7;
		paused = false;
		playbackSpeed = 1;

		// Fly to clicked point and pitch camera (initial "raindrop" animation)
		map.flyTo({center, zoom, speed: 0.9, curve: 1, pitch: cameraPitch, bearing: initialBearing,
			easing(t) {
				return t;
			}
		});

		vizState = "running";
		// const locationTracerPoint = addLocationMarker({ map, origin: coordinatePath[0] });

		// Maintain a consistent speed using the route distance. The higher the speed coefficient, the slower the runner will move.
		const speedCoefficient = smoothedPath.length < 50 ? 200 : 175 - 5*(cameraPitch - 70);
		const animationDuration = Math.round(speedCoefficient*routeDistance);

		map.once('moveend', () => {
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
				riverFeatures
			});
		});
	}

	const findClosestFeature = async (e) => {
		let closestFeature;
		let resultFound = false;
		let roundingDigits = 6;
		while (resultFound === false && roundingDigits >= 0) {
			roundingDigits -= 1;

			try {
				const closestFeatureURL = `https://labs.waterdata.usgs.gov/api/nldi/linked-data/comid/position?coords=POINT%28${e.lngLat.lng.toFixed(roundingDigits)}%20${e.lngLat.lat.toFixed(roundingDigits)}%29`;
				const coordinateResponse = await fetch(closestFeatureURL)
				const data = await coordinateResponse.json()
				closestFeature = data.features[0];
				
				resultFound = true;
			}
			catch {
				console.log(`Error while rounding coordinates to ${roundingDigits} digits. Trying again with less precise coordinates.`);
			}
		}

		return closestFeature;
	}

	// const getDownStreamFlowlines = async (closestFeature) => {
	// 	const flowlinesURL = closestFeature.properties.navigation + '/DM/flowlines?f=json&distance=6000';
	// 	const flowlinesResponse = await fetch(flowlinesURL);
	// 	const flowlinesData = await flowlinesResponse.json();
	// 	return flowlinesData;
	// }

	const getSiteData = async (closestFeature, siteType) => {
		const siteURL = closestFeature.properties.navigation + '/DM/' + siteType + '?f=json&distance=6000';
		const response = await fetch(siteURL);

		try {
			const data = await response.json();
			return data;
		}
		catch {
			return null;
		}		
	};

	const determineStoppingFeature = ({ destinationPoint, stoppingFeatures }) => {
		let minDistance = 10000000;
		let closestFeature = null;
		let oceanDistance = null;

		// Find the distance from each polygon in the stop feature dataset
		stoppingFeatures.forEach(feature => {
			const featureDistance = distanceToPolygon({ startPoint: destinationPoint, targetPolygon: feature });

			if (featureDistance < minDistance) {
				minDistance = featureDistance;
				closestFeature = feature;
			}

			if (feature.properties.stop_feature_type === "ocean") {
				oceanDistance = featureDistance;
			}
		})

		// If the closest feature in the stop feature set is more than 10 km away, this is landing on an unidentified inland water feature
		if (minDistance > 10000 && closestFeature.properties.stop_feature_type !== "ocean") {
			return "Inland Water Feature";
		}
		// Sometimes there's a large inlet/bay that creates artificial distance between the destination point and my imperfect ocean shapefile polygon
		// It may then think that another feature, like a lake is the "stop feature", (this happens in the Alabama gulf, for example).
		// We're going to say that if the ocean is within 50km of the stop point, it's very likely the true end point
		else if (closestFeature.properties.stop_feature_type === "ocean" || oceanDistance < 50000) {
			if (closestFeature.properties.stop_feature_name === "San Francisco Bay") {
				return "San Francisco Bay"
			}

			// Gulf of Mexico: lng < -82 && lat < 31
			// Chesapeake Bay: -75.6 > lng > -77.68 && 39.61 > lat > 37.79
			// Otherwise split by Texas, basically, between Atlantic/Pacific
			return (
				destinationPoint[0] < -82 && destinationPoint[1] < 31) ? "Gulf of Mexico" :
				(destinationPoint[0] < -75.63300750 && destinationPoint[0] > -77.684621 && destinationPoint[1] > 37.793247 && destinationPoint[1] < 39.61332 ) ? "Chesapeake Bay" :
				destinationPoint[0] > -100 ? "Atlantic Ocean" :
				"Pacific Ocean";
		}
		else {
			return closestFeature.properties.stop_feature_name;
		}
	}

	const getPartialDistance = (fullLine, splitCoordinate) => {
		const index = fullLine.findIndex(d => d === splitCoordinate);
		return index === 0 ? 0 : length(lineString(fullLine.slice(0, index)))
	}

	const getFeatureGroups = (flowlinesData) => {
		const featurePoints = flowlinesData.features.filter( feature => feature.properties.feature_id );
		const featureNames = featurePoints.map( feature => feature.properties.feature_id );
		let uniqueFeatureNames = featureNames.filter((item, i, ar) => ar.indexOf(item) === i);
		const fullDistance = flowlinesData.features[0].properties.pathlength;

		// This fixes a rare, but frustrating bug, where because I don't sample each flowline for VAA data, and because...
		// I assume once a feature starts that it continues until the next unique feature, this function gets confused by...
		// Long rivers sandwiching small unnames features, like the snake river in Idaho, and thinks that the small feature interruption
		// Is the new main feature until it hits the next unique feature name. This is sort of difficult to explain, but just trust that it's necessary.
		uniqueFeatureNames = uniqueFeatureNames.filter((name, i) => {
			if (i === 0) {
				return true;
			}
			else {
				const firstOccurence = featurePoints.findIndex(point => point.properties.feature_id === name);
				const featureData = featurePoints.find(point => point.properties.feature_id === name);

				const sandwichOccurence = featurePoints.slice(firstOccurence).findIndex(point => point.properties.feature_id === uniqueFeatureNames[i-1]);
				const surroundingFeatureData = featurePoints.slice(firstOccurence).find(point => point.properties.feature_id === uniqueFeatureNames[i-1]);

				if ( sandwichOccurence > 0 && surroundingFeatureData.properties.streamlvl === featureData.properties.streamlvl) {
					return false;
				}
				else {
					return true;
				}
			}
		});

		let riverFeatures = uniqueFeatureNames.map((feature, index) => {
			
			const featureData = flowlinesData.features.find(item => item.properties.feature_id === feature);
			const featureIndex = flowlinesData.features.findIndex(item => item.properties.feature_id === feature);

			return ({
				feature_data_index: featureIndex,
				progress: fullDistance === -999 ? (featureIndex / flowlinesData.features.length) : ((fullDistance - featureData.properties.pathlength) / fullDistance),
				name: featureData.properties.feature_name,
				distance_from_destination: featureData.properties.pathlength === -9999 ? 0 : featureData.properties.pathlength,
				index,
				stream_level: featureData.properties.streamlvl,
				active: false
			})
		});

		// Because I'm not sampling every flowline, sometimes I get weird results at the end of the flowpath where, for example, there's a flowline
		// that's part of the Mississippi Delta, but isn't technically isn't grouped under the Mississippi river, and it considers it the last step
		// Here, I'm going to treat anyting with streamlevel 1 (which means it's a terminal feature) as the last feature in the sequence, but add an 
		// exception case for paths that stop at inland lakes, just in case their last feature isn't encoded as stream level 1
		let trueStopFeatureIndex = riverFeatures.findIndex(feature => feature.stream_level === 1);
		if (trueStopFeatureIndex === -1) {
			trueStopFeatureIndex = riverFeatures.length-1;
		};
		riverFeatures = riverFeatures.slice(0, trueStopFeatureIndex+1);

		riverFeatures.forEach( (feature, i) => {
			if (i === riverFeatures.length - 1) {
				feature.length_km = Math.round(feature.distance_from_destination);
				feature.stop_point = null;

				feature.feature_data = [ { geometry: { coordinates: flowlinesData.features.slice(feature.feature_data_index).map( feature => feature.geometry.coordinates ).flat() }} ];
			}
			else {
				const featureLength = feature.distance_from_destination - riverFeatures[i+1].distance_from_destination;
				feature.length_km = Math.round(featureLength);
				feature.stop_point = riverFeatures[i+1].progress;

				feature.feature_data = [ { geometry: { coordinates: flowlinesData.features.slice(feature.feature_data_index, riverFeatures[i+1].feature_data_index).map( feature => feature.geometry.coordinates ).flat() }} ];
			}
		})

		return riverFeatures;
	}

	// const appendNWISImageData = async (features) => {

	// 	features.forEach(async (feature) => {
	// 		const request = await fetch(feature.properties.uri);
	// 		const text = await request.text();

	// 		const root = parse(text);
	// 		const jsonLD = root.querySelector("script[type='application/ld+json']");
	// 		const imageURL = JSON.parse(jsonLD.text).image;

	// 		console.log(imageURL);
	// 		feature.imageURL = imageURL;
	// 	})

	// 	return features;
	// }

	const addFeatureExtrusions = ({ map, formatterFunction, featureSet, layerID, color, markerRadius, markerHeight=50 }) => {
		if ( featureSet === null ) {
			return;
		}
		
		if (map.getLayer(layerID)) {
			map.removeLayer(layerID);
		}

		if (map.getSource(layerID)) {
			map.removeSource(layerID);
		}


		featureSet.features.forEach(d => {
			d.properties.original_center = d.geometry.coordinates;
			d.geometry = circle(d.geometry.coordinates, markerRadius, { steps: 30 }).geometry;
		});

		map.addSource(layerID, {
			'type': 'geojson',
			'data': featureSet
		});

		map.addLayer({
			'id': layerID,
			'source': layerID,
			'type': 'fill-extrusion',
			'paint': {
				'fill-extrusion-color': color,
				'fill-extrusion-opacity': 0.8,
				'fill-extrusion-height': markerHeight,
				'fill-extrusion-base': 0
			},
		});

		map.on('click', layerID, (e) => {
			if ((layerID === "wqp-points" || layerID === "wade-points") && 
				map.queryRenderedFeatures(e.point).some(feature => feature.source === 'nwis-points')) {
					return;
			}

			if (e.features.length > 0) {
				new mapbox.Popup({ closeButton: false, closeOnClick: true, maxWidth: 400 })
					.setLngLat(e.lngLat)
					.setHTML(
						formatterFunction({ feature: e.features[0] })
					)
					.addTo(map);
			}
		});

		return;
	}

	const nwisPopupFormat = ({ feature }) => {
		console.log('NWIS', feature.properties);
		const siteNumber = feature.properties.identifier.slice(5);
		return feature.properties.display_image ?
		`
			<div style="text-align: center">
				<h3><strong>${feature.properties.name} (<a target="_blank" href="https://geoconnex.us/usgs/monitoring-location/${siteNumber}">${siteNumber}</a>)</strong></h3>
				<img src="https://waterdata.usgs.gov/nwisweb/graph?agency_cd=USGS&site_no=${siteNumber}&parm_cd=00065&period=7" alt="NWIS streamgage data for site ${siteNumber}" />
			</div>
		`
		:
		`
			<div style="text-align: center">
				<h3><strong>${feature.properties.name} (<a target="_blank" href="https://geoconnex.us/usgs/monitoring-location/${siteNumber}">${siteNumber}</a>)</strong></h3>
				<em>[No chart data available]</em>
			</div>
		`
		;
	}

	const wqpPopupFormat = ({ feature }) => {
		// console.log('WQP', feature.properties);
		const identifier = feature.properties.identifier;
		const portalLink = feature.properties.uri.replace("https://www.waterqualitydata.us/provider/", "https://geoconnex.us/wqp/");
		const dataLink = `https://www.waterqualitydata.us/data/Result/search?siteid=${identifier}`;

		return `
			<div style="padding: 0 1rem; display: flex; flex-direction: column;">
				<h3 style="margin: 0.5rem 0; justify-self: center;"><strong>Water Quality Portal Site (${feature.properties.name})</strong></h3>
				<a target="_blank" href="${portalLink}">Portal Site Metadata</a></li>
				<a target="_blank" href="${dataLink}">Water Quality Sample Data</a>
			</div>
		`;
	}

	const wadePopupFormat = ({ feature }) => {
		return `<span>Water Data Exchange Water Point of Diversion: <a target="_blank" href="${feature.properties.uri}">${feature.properties.identifier}</a></span>`;
	}

	const addFeaturePopups = ({ map, featureSet, filterIndex=100 }) => {
		featureSet.features.filter((d, i) => i % filterIndex === 0).forEach(site => {
			const popup = new mapbox.Popup({ closeButton: false, closeOnClick: false, maxWidth: 400 })
				.setLngLat(site.properties.original_center)
				.setHTML(`<span>Water Data Exchange Water Point of Diversion: <a href="${site.properties.uri}">${site.properties.identifier}</a></span>`)
				.addTo(map);
		})
	}

	const addLocationMarker = ({ map, origin, pointID='location-marker' }) => {
		if (map.getLayer(pointID)) {
			map.removeLayer(pointID);
		}

		if (map.getSource(pointID)) {
			map.removeSource(pointID);
		}

		const point = {
			'type': 'FeatureCollection',
			'features': [
				{
					'type': 'Feature',
					'properties': {},
					'geometry': {
						'type': 'Point',
						'coordinates': origin
					}
				}
			]
		};

		map.addSource(pointID, {
			'type': 'geojson',
			'data': point
		});

		map.addLayer({
			'id': pointID,
			'source': pointID,
			'type': 'circle',
			'paint': {
				'circle-radius': {
					'base': 2,
					'stops': [
						[7, 2],
						[14, 10]
					]
				},
				'circle-color': "#ff0000"
			}
		});

		return point;
	}

	const getFeatureVAA = async (feature, index, thinningIndex) => {
		if (index > 50 && index % thinningIndex !== 0) {
			return feature;
		}
		else {
			const baseUrl = 'https://river-runner-20db3-default-rtdb.firebaseio.com/';
			const response = await fetch(baseUrl + feature.properties.nhdplus_comid + '.json');
			const featureData = await response.json();

			feature.properties = {
				...feature.properties,
				...featureData,
				// feature_name: featureData.gnis_name || `Unnamed River/Stream (${featureData.levelpathid})`
				feature_name: featureData.gnis_name || `Unnamed River/Stream`,
				feature_id: featureData.gnis_name || featureData.levelpathid
			};

			return feature;
		}
	}

	const addVAAData = (flowlineFeatures) => {
		const thinningIndex = Math.ceil(flowlineFeatures.length / 250);
		return Promise.all(
			flowlineFeatures.map(async (feature, i) => await getFeatureVAA(feature, i, thinningIndex))
		)
	}

	const createArticialCameraPoints = (smoothedPath, coordinatePath, cameraTargetIndexGap, originPoint) => {
		const firstPointsBearing = bearingBetween( coordinatePath[(Math.min(coordinatePath.length-1, 10))], coordinatePath[0] );
		const pointDistances = smoothedPath.slice(0, Math.min(80, smoothedPath.length-1)).map((coordinate, index) => {
			return distance(coordinate, smoothedPath[index+1]);
		});  
		const averagePointDistance = pointDistances.reduce((a,b) => a + b, 0) / pointDistances.length; 

		return [...Array(cameraTargetIndexGap).keys()].reverse().map(index => {
			const offsetDistance = averagePointDistance*(index+1);
			return destination(originPoint, offsetDistance, firstPointsBearing).geometry.coordinates;
		})
	}
	
	const positionCamera = ({ map, cameraCoordinates, elevation, pitch, bearing }) => {
		const camera = map.getFreeCameraOptions();
			
		// set the position and altitude of the camera
		camera.position = mapbox.MercatorCoordinate.fromLngLat(
			{
				lng: cameraCoordinates[0],
				lat: cameraCoordinates[1]
			},
			elevation
		);

		camera.setPitchBearing(pitch, bearing);
		map.setFreeCameraOptions(camera);
	}

	const precalculateInitialCamera = ({ map, cameraStart, initialElevation, initialBearing, cameraPitch }) => {
		// Store current camera info
		const currentZoom = map.getZoom();
		const currentCenter = map.getCenter();
		const currentBearing = map.getBearing();
		const currentPitch = map.getPitch();

		// Position the camera how it will be positioned on the first tick of the run
		positionCamera({ map, cameraCoordinates: cameraStart, elevation: initialElevation, bearing: initialBearing, pitch: cameraPitch });

		// Log the zoom/center
		const zoom = map.getZoom();
		const center = map.getCenter();

		// Send the camera back to where it came from, without user seeing anything
		map.jumpTo({
			zoom: currentZoom,
			center: currentCenter,
			bearing: currentBearing,
			pitch: currentPitch
		});

		// Return zoom and center so that we can fly to the exact start point and it won't be jarring when the run starts
		return { zoom, center }
	}

	const pathDistance = (coordinateSet) => lineDistance(lineString(coordinateSet));

	const pathSmoother = (coordinateSet, smoothingCoefficient=1) => {
		const setLength = coordinateSet.length;
		const smoothedCoordinatePath = coordinateSet.map((coordinate, index) => {
			const coordinateGroup = coordinateSet.slice(Math.max(0, index-smoothingCoefficient), index+1+smoothingCoefficient);
			const lng = coordinateGroup.map(d => d[0]).reduce((a, b) => a + b, 0) / coordinateGroup.length;
			const lat = coordinateGroup.map(d => d[1]).reduce((a, b) => a + b, 0) / coordinateGroup.length;

			return [lng, lat];
		});

		return smoothedCoordinatePath;
	}

	const projectDistance = ( fromCoordinate, toCoordinate, distance ) => {
		const bearing = bearingBetween(fromCoordinate, toCoordinate);
		return destination(fromCoordinate, distance, bearing).geometry.coordinates;
	}

	const calculatePitch = (elevation, distance) => (90 - Math.atan(elevation / distance) * (180 / Math.PI));

	const calculateCameraPath = (coordinatePath, cameraTargetDistance, routeDistance) => {
		const cameraPathCoordinates = coordinatePath.slice(0, -cameraTargetDistance);
		const distanceGap = routeDistance - pathDistance(cameraPathCoordinates);

		return cameraPathCoordinates.map((coordinate, index) => {
			return projectDistance(coordinatePath[index + cameraTargetDistance], coordinate, distanceGap);
		})
	}

	const runRiver = ({ map, animationDuration, cameraBaseAltitude=4300, cameraPitch=70, distanceGap, coordinatePath, elevations, terrainElevationMultiplier, riverFeatures }) => {
		let start;

		const startPoints = riverFeatures.map(d => d.progress);
		let startPoint = startPoints[0];

		const stopPoints = riverFeatures.map(d => d.stop_point)
		let stopPoint = stopPoints[0];
		activeFeatureIndex = 0;
		
		let route = pathSmoother(coordinatePath, Math.min(Math.floor(9*altitudeMultiplier), Math.floor(coordinatePath.length / 2)));
		let routeDistance = pathDistance(route);

		let phase = 0;
		let tick = 0;
		let lastTime;
		let phaseGap = distanceGap / routeDistance;

		// This adjusts the run speed based on the altitude. It seems *very* complicated, but it's the closest I've come to keeping perceptual speed consistent.
		let speedCoefficient = (1 / Math.pow((1 + 1.1*Math.log(altitudeMultiplier)), 1.25) );

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
				route = pathSmoother(coordinatePath, Math.min(Math.floor(9*altitudeMultiplier), Math.floor(coordinatePath.length / 2)));
				routeDistance = pathDistance(route);

				phaseGap = distanceGap / routeDistance;

				// This adjusts the run speed based on the altitude. It seems *very* complicated, but it's the closest I've come to keeping perceptual speed consistent.
				speedCoefficient = (1 / Math.pow((1 + 1.1*Math.log(altitudeMultiplier)), 1.25) );

				altitudeChange = false;
			}

			// phase determines how far through the animation we are
			if (!paused) {
				phase += playbackSpeed*((time - lastTime) / (animationDuration*speedCoefficient));
			}

			// If rewinding and user rewinds past the start, this will puase it and keep it from bugging out
			if (phase < 0) {
				phase = 0;
				playbackSpeed = 1;
				paused = true;
			}

			lastTime = time;

			const adjustedTargetPhase = altitudeMultiplier*phaseGap + phase;

			// When finished, exit animation loop and zoom out to show ending point
			if (phase > 1 || aborted === true) {
				exitNavigation({ map, coordinatePath });
				return;
			}

			// When you hit next feature group, adjust index
			if (stopPoint && phase >= stopPoint) {
				activeFeatureIndex += 1;
				startPoint = stopPoint;
				stopPoint = stopPoints[activeFeatureIndex]
			}

			// If winding in reverse, and encountering a feature group change, do the reverse
			if (startPoint && phase <= startPoint) {
				activeFeatureIndex -= 1;
				stopPoint = startPoint
				startPoint = startPoints[activeFeatureIndex];
			}

			// Calculate camera elevation using the base elevation and the elevation at the specific coordinate point
			const elevationLast = elevations[Math.floor(elevations.length*phase)];
			const elevationNext = elevations[Math.ceil(elevations.length*phase)] || elevations[(Math.ceil(elevations.length*phase) - 1)];
			const elevationStepProgress = elevations.length*phase - Math.floor(elevations.length*phase);

			const elevationEstimate = elevationLast + ((elevationNext - elevationLast)*elevationStepProgress);
			const tickElevation = altitudeMultiplier*cameraBaseAltitude + terrainElevationMultiplier*Math.round(elevationEstimate);

			let alongTarget = along(
				lineString(route),
				routeDistance * (phase === 0 ? 0.00005 : phase)
			).geometry.coordinates;

			if (alongTarget === route[0]) { alongTarget = route[1] };

			const alongCamera = (phase - altitudeMultiplier*phaseGap) < 0 ?
				findArtificialCameraPoint({ distanceGap: altitudeMultiplier*distanceGap, originPoint: route[0], targetPoint: alongTarget}) 
				:
				along(
					lineString(route),
					routeDistance * (phase - altitudeMultiplier*phaseGap)
				).geometry.coordinates;

			const bearing = bearingBetween( alongCamera, alongTarget);
			// console.log( (phase - altitudeMultiplier*phaseGap), alongCamera, bearing)

			// Generate/position a camera along route, pointed in direction of target point at set pitch
			positionCamera({ map, cameraCoordinates: alongCamera, elevation: tickElevation, pitch: cameraPitch, bearing });

			// This will update the location of the marker on the locator map
			if (tick % 5 === 0) {
				currentLocation = alongTarget;
			}
			tick += 1;

			window.requestAnimationFrame(frame);
		}
		
		window.requestAnimationFrame(frame);
	}

	const exitNavigation = ({ map, coordinatePath }) => {
		if (!aborted) {
			activeFeatureIndex += 1;
		}
		else {
			activeFeatureIndex = -1;
		}

		aborted = false;
		const bounds = getDataBounds(coordinatePath, true);

		map.fitBounds(bounds, {
			bearing: 0,
			pitch: 0,
			padding: 70,
			maxZoom: 12,
			offset: window.innerWidth < 600 ? [0,-20] : [0,0] // On mobile, the search bar will get in the way so we actually want it a little off center
		})

		map.once('moveend', () => {
			vizState = "overview";
			// map.interactive = true;
			map.scrollZoom.enable();
			// resetMapState({ map });
		})
	};

	const findArtificialCameraPoint = ({ distanceGap, originPoint, targetPoint}) => {
		const bearing = bearingBetween(targetPoint, originPoint);
		return destination(targetPoint, distanceGap, bearing).geometry.coordinates;
	} 

	const resetMapState = ({ map, error=false }) => {
		map.interactive = true;
		map.scrollZoom.enable();
		aborted = false;

		clearRiverLines({ map });

		currentLocation = undefined;
		activeFeatureIndex = -1;

		if (error) {
			setTimeout(() => { vizState = "uninitialized"; }, 2000)
		}
		else {
			vizState = "uninitialized";
		}

		d3.select(".mapboxgl-ctrl-geocoder").style("display", "block");
		d3.select(".mapboxgl-ctrl-top-left").style("display", "block");
	}

	const getElevationsMapQuery = (coordinatePath, arrayStep=10) => {
		const elevationCoordinates = coordinatePath.filter((element, index) => {
			return index % arrayStep === 0;
		})

		return elevationCoordinates.map((d) => map.queryTerrainElevation(d, { exaggerated: true }));
	}

	const getElevations = async (coordinatePath, arrayStep=10) => {

		const elevationCoordinates = coordinatePath.filter((element, index) => {
			return index % arrayStep === 0;
		})

		const responses = await Promise.all(
			elevationCoordinates.map(
				([lng, lat]) => fetch(`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?&access_token=${mapboxAccessToken}`)
					.then(response => response.json())
			)
		)

		const data = responses.map(res => res.features.slice(-1)[0].properties.ele)
			.map((d, i, n) => {
				if (d) {
					return d;
				}
				else if (i === 0) {
					return n[(i+1)]
				}
				else {
					return n[(i-1)]
				}
			});

		console.log(data);
			
		return data;
	}

	const clearRiverLines = ({ map, sourceID="route"}) => {
		if (map.getLayer(sourceID)) {
			map.removeLayer(sourceID);
		}

		if (map.getSource(sourceID)) {
			map.removeSource(sourceID);
		}
	}

	const drawFlowPath = ({ map, featureData, lineColor="steelblue", lineWidth=2, sourceID='route'}) => {
		clearRiverLines({ map, sourceID })
		addRivers({ map, featureData, lineColor, lineWidth, sourceID });
	}

	const addRivers = ({ map, featureData, lineColor="steelblue", lineWidth=1, sourceID='route' }) => {
		const features = featureData.map((river) => {
			// Some rivers in some files have multiple linestrings (such as the Mississippi)...
			// their coordinates will be a triple-nested array instead of a double-nested
			const featureType = Array.isArray(river.geometry.coordinates[0][0]) ? 'MultiLineString' : 'LineString';

			return ({
				type: 'Feature',
				properties: river.properties,
				geometry: {
					type: featureType,
					coordinates: river.geometry.coordinates
				}
			})
		});
						
		map.addSource(sourceID, {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features
			}
		});

		map.addLayer({
			id: sourceID,
			type: 'line',
			source: sourceID,
			layout: {
				'line-join': 'round',
				'line-cap': 'round'
			},
			paint: {
				'line-color': lineColor,
				'line-width': lineWidth
			}
		});
	}

	const highlightRiverFeature = (featureIndex) => {
		drawFlowPath({
			map,
			featureData: featureGroups[featureIndex].feature_data,
			lineColor: "yellow",
			lineWidth: 4,
			sourceID: "highlighted-section"
		});
	}

	const resetRiverHighlight = () => {
		clearRiverLines({ map, sourceID: 'highlighted-section' });
	}

	const addTopoLayer = ({ map }) => {
		map.addSource('mapbox-dem', {
			'type': 'raster-dem',
			'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
			'tileSize': 512,
			'maxzoom': 14
		});

		// add the DEM source as a terrain layer with exaggerated height
		map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.7 });

		map.addLayer({
			'id': 'sky',
			'type': 'sky',
			'paint': {
			'sky-type': 'atmosphere',
			'sky-atmosphere-sun': [0.0, 0.0],
			'sky-atmosphere-sun-intensity': 15
			}
		});
	}

	const handleResize = () => {
		mapBounds = map.getBounds();
	};

	const exitFunction = () => {
		aborted = true;
	}

	const handleJump = (e) => {
		activeFeatureIndex = e.detail.featureIndex;
		phaseJump = e.detail.pathProgress;
	}

	const jumpIndex = (direction) => {
		if (direction === "forward" && activeFeatureIndex+1 < featureGroups.length) {
			activeFeatureIndex = Math.min(activeFeatureIndex+1, featureGroups.length - 1);
			phaseJump = featureGroups[activeFeatureIndex].progress;
		} 
		else if (direction === "backward" && activeFeatureIndex-1 >= 0) {
			activeFeatureIndex = Math.max( activeFeatureIndex-1, 0);
			phaseJump = featureGroups[activeFeatureIndex].progress;
		}
	}

	const setAltitudeMultipier = (e) => {
		// console.log(e.target.value);
		altitudeChange = true;
		altitudeMultiplier = e.target.value;
	}

	const togglePause = () => {
		if (playbackSpeed !== 1) {
			playbackSpeed = 1;
			paused = false;
		}
		else {
			paused = !paused;
		}
	}

	const setPlaybackSpeed = (newVal) => {
		paused = false;
		playbackSpeed = newVal;
	}

	$: coordinates.update(() => {
		if (mapBounds._sw) {
			return [
				[mapBounds._sw.lat, mapBounds._ne.lat],
				[mapBounds._sw.lng, mapBounds._ne.lng]
			];
		}
	});

</script>

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

	@media only screen and (min-width: 601px) {
		.right-column {
			display: flex;
			position: absolute;
			right: 3rem;
			top: 3rem;
			z-index: 20;
			flex-direction: column;
			gap: 1rem;
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

<svelte:window on:resize={handleResize} />

<div class="map-wrapper" style="opacity: {visibleIndex ? 1 : 0}" bind:this={container}>
	{#if map}
		<slot />
	{/if}
</div>

<Prompt {vizState} {currentLocation} />
<LocatorMap {bounds} {stateBoundaries} visibleIndex={null} {riverPath} {currentLocation} {vizState} {activeFeatureIndex} {featureGroups} />
<ContactBox {vizState} />

<div class="right-column">
	<NavigationInfo
		on:highlight-feature={(e) => highlightRiverFeature(e.detail.featureIndex)}
		on:remove-highlight={resetRiverHighlight}
		on:run-path={() => { startRun({ map, ...runSettings }) }}
		on:exit-path={() => resetMapState({ map })}
		on:abort-run={exitFunction}
		on:progress-set={(e) => handleJump(e) }
		{vizState} {activeFeatureIndex} {featureGroups} {totalLength} {startCoordinates}
	/>
	<Controls {setAltitudeMultipier} {altitudeMultiplier} {jumpIndex} {playbackSpeed} {setPlaybackSpeed} {paused} {togglePause} {activeFeatureIndex} {vizState} featureGroupLength={featureGroups.length} />
</div>