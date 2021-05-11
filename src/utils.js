import bearing from '@turf/bearing';
import { point } from '@turf/helpers';
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


export { bearingBetween, contructCoordinateQuadtree, roundToDigits };