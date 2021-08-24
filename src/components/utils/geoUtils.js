import { lineString } from "@turf/helpers";
import lineDistance from "@turf/line-distance";
import destination from "@turf/destination";
import bearing from '@turf/bearing';
import { point } from "@turf/helpers";

export const bearingBetween = (coordinate1, coordinate2) => { 
    const point1 = point(coordinate1);
    const point2 = point(coordinate2);

    return bearing(point1, point2);
}

export const pathSmoother = (coordinateSet, smoothingCoefficient = 1) => {
    const setLength = coordinateSet.length;
    const smoothedCoordinatePath = coordinateSet.map(
        (coordinate, index) => {
            const coordinateGroup = coordinateSet.slice(
                Math.max(0, index - smoothingCoefficient),
                index + 1 + smoothingCoefficient
            );
            const lng =
                coordinateGroup
                    .map((d) => d[0])
                    .reduce((a, b) => a + b, 0) / coordinateGroup.length;
            const lat =
                coordinateGroup
                    .map((d) => d[1])
                    .reduce((a, b) => a + b, 0) / coordinateGroup.length;

            return [lng, lat];
        }
    );

    return smoothedCoordinatePath;
};

export const calculatePitch = (elevation, distance) =>
    90 - Math.atan(elevation / distance) * (180 / Math.PI);

export const pathDistance = (coordinateSet) =>
    lineDistance(lineString(coordinateSet));

export const projectDistance = (fromCoordinate, toCoordinate, distance) => {
    const bearing = bearingBetween(fromCoordinate, toCoordinate);
    return destination(fromCoordinate, distance, bearing).geometry
        .coordinates;
};

export const calculateCameraPath = (
    coordinatePath,
    cameraTargetDistance,
    routeDistance
) => {
    const cameraPathCoordinates = coordinatePath.slice(
        0,
        -cameraTargetDistance
    );
    const distanceGap = routeDistance - pathDistance(cameraPathCoordinates);

    return cameraPathCoordinates.map((coordinate, index) => {
        return projectDistance(
            coordinatePath[index + cameraTargetDistance],
            coordinate,
            distanceGap
        );
    });
};

export const findArtificialCameraPoint = ({
    distanceGap,
    originPoint,
    targetPoint,
}) => {
    const bearing = bearingBetween(targetPoint, originPoint);
    return destination(targetPoint, distanceGap, bearing).geometry
        .coordinates;
};