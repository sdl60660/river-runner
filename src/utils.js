import bearing from '@turf/bearing';
import * as d3 from 'd3';

// Derived from this StackOverflow post: https://stackoverflow.com/questions/36096188/is-there-a-way-to-calculate-the-bearing-from-one-point-to-another
const bearingBetween = (coordinate1, coordinate2) => {
    const point1 = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [coordinate1[0], coordinate1[1]]
      }
    };
    const point2 = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [coordinate2[0], coordinate2[1]]
      }
    };

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


export { bearingBetween, contructCoordinateQuadtree, roundToDigits };