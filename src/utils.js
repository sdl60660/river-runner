import bearing from '@turf/bearing';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import pointToLineDistance from '@turf/point-to-line-distance';
import polygonToLine from '@turf/polygon-to-line';
import { point, polygon } from '@turf/helpers';

import { titleCase } from "title-case";
import * as d3 from 'd3';

const bearingBetween = (coordinate1, coordinate2) => { 
    const point1 = point(coordinate1);
    const point2 = point(coordinate2);

    return bearing(point1, point2);
}


const contructCoordinateQuadtree = (coordinateSet) => {
    const tree = d3.quadtree()
        .x(d => d.lat)
        .y(d => d.lng)
        .addAll(coordinateSet);

    return tree;
}


const roundToDigits = (val, digits=0) => {
    const divider = Math.pow(10, digits);
    return Math.round(val * divider) / divider;
}

const getDataBounds = (linestringData, coordinatesExtracted=false) => {
  const allCoordinates = coordinatesExtracted ? linestringData : linestringData.map(river => river.geometry.coordinates).flat();

  return [
      [d3.min(allCoordinates, d => d[0]), d3.min(allCoordinates, d => d[1])],
      [d3.max(allCoordinates, d => d[0]), d3.max(allCoordinates, d => d[1])]
  ]
}

// Returns distance in meters (negative values for points inside) from a point to the edges of a polygon
// This function comes from here: https://github.com/Turfjs/turf/issues/1743
const distanceToPolygon = ({ startPoint, targetPolygon }) => {
    if (targetPolygon.type === "Feature") { targetPolygon = targetPolygon.geometry }
    
    let distance;

    // console.log(targetPolygon);
    if (targetPolygon.type === "MultiPolygon") {
      distance = targetPolygon.coordinates
        .map(coords => distanceToPolygon({ startPoint, targetPolygon: polygon(coords).geometry }))
        .reduce((smallest, current) => (current < smallest ? current : smallest));
    }
    else {

      if (targetPolygon.coordinates.length > 1) {
        // Has holes
        const [exteriorDistance, ...interiorDistances] = targetPolygon.coordinates.map(coords =>
          distanceToPolygon({ startPoint, targetPolygon: polygon([coords]).geometry })
        );

        if (exteriorDistance < 0) {
          // point is inside the exterior polygon shape
          const smallestInteriorDistance = interiorDistances.reduce(
            (smallest, current) => (current < smallest ? current : smallest)
          );

          if (smallestInteriorDistance < 0) {
            // point is inside one of the holes (therefore not actually inside this shape)
            distance = smallestInteriorDistance * -1;
          }
          else {
            // find which is closer, the distance to the hole or the distance to the edge of the exterior, and set that as the inner distance.
            distance = smallestInteriorDistance < exteriorDistance * -1
              ? smallestInteriorDistance * -1
              : exteriorDistance;
          }
        }
        else {
          distance = exteriorDistance;
        }
      }
      
      else {
        // The actual distance operation - on a normal, hole-less polygon (converted to meters)
        distance = pointToLineDistance(startPoint, polygonToLine(targetPolygon)) * 1000;
        if (booleanPointInPolygon(startPoint, targetPolygon)) {
          distance = distance * -1;
        }
      }
    }
  return distance
}

const fallbackCopyTextToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    const msg = successful ? 'successful' : 'unsuccessful';
    console.log('Fallback: Copying text command was ' + msg);
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}

const copyTextToClipboard = (text) => {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    console.log('Async: Copying to clipboard was successful!');
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });
}

const stateAbbreviations = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

const formatPopupTitleCase = (rawText) => {

  let correctedText = rawText.slice();
  // Check for commas without spaces after (seems to happen a lot with these)
  for (let i=0; i < rawText.length; i++) {
    if (rawText[i] === ',' && i+1 < rawText.length && rawText[i+1] !== " ") {
      correctedText = correctedText.substr(0, i+1) + ' ' + correctedText.substr(i+1);
    }
  }

  // This will use the library's default titlecase rules, which are close, but miss a few cases
  const firstPass = titleCase(correctedText.toLowerCase());

  return firstPass.split(" ").map(word => {
    // If a word/segment ends with a dot (acroynm), is two letters or less and not in library's codec (probably a direction/state name), or contains a number, we'll want uppercase
    if (word.slice(-1)[0] === '.' || (word.length <= 2 && /[A-Z]/.test(word)) || /\d/.test(word)) {
      return word.toUpperCase();
    }
    // Otherwise stick with default titelcase
    else {
      return word
    }
  }).join(" ")
}

export { bearingBetween, contructCoordinateQuadtree, roundToDigits, getDataBounds, distanceToPolygon, copyTextToClipboard, stateAbbreviations, formatPopupTitleCase };