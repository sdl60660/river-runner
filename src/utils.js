import bearing from '@turf/bearing';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import pointToLineDistance from '@turf/point-to-line-distance';
import polygonToLine from '@turf/polygon-to-line';

import { point, polygon } from '@turf/helpers';
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


export { bearingBetween, contructCoordinateQuadtree, roundToDigits, getDataBounds, distanceToPolygon };