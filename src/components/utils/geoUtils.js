import { lineString, polygon } from "@turf/helpers";
import lineDistance from "@turf/line-distance";
import destination from "@turf/destination";
import bearing from '@turf/bearing';
import { point, points } from "@turf/helpers";
import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import pointsWithinPolygon from "@turf/points-within-polygon";
import intersect from "@turf/intersect";

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

export const getFeaturesOnRoute = (stoppingFeatures, flowlines) => {
    const fullPath = lineString(flowlines.map(d => d.geometry.coordinates).flat());
    const pathBoundingBox = bboxPolygon(bbox(fullPath));

    return stoppingFeatures.filter(d => {
        if (d.geometry.type === "MultiPolygon") {
            d.geometry.coordinates.forEach(poly => {
                const intersection = intersect(pathBoundingBox, polygon(poly));

                if (intersection !== null) {
                    return true;
                }
            })
        }
        else {
            const intersection = intersect(pathBoundingBox, polygon(d.geometry.coordinates));

            if (intersection !== null) {
                return true;
            }
        }     
           
        return false;
    });
}

const correctInterruptingLakes = (namedFlowlines) => {
    // Take a dynamic programming approach, instead of a functional one to save an extra layer of iterations
    let lastFeatureId = null;
    let lastFeatureName = null;
    let currentFeature = null;
    
    namedFlowlines.forEach((flowline, i) => {
        const lastFlowline = namedFlowlines[i-1];

        if (flowline.properties.renamed_inland === true
            && lastFlowline
            && lastFlowline.properties.renamed_inland !== true
        ) {
            lastFeatureId = lastFlowline.properties.feature_id;
            lastFeatureName = lastFlowline.properties.feature_name;
        }
        else if (flowline.properties.renamed_inland !== true
            && flowline.properties.feature_name === lastFeatureName
            && ((lastFlowline && lastFlowline.properties.renamed_inland === true) || flowline.properties.feature_id === currentFeature)
        ) {
            currentFeature = flowline.properties.feature_id;
            flowline.properties.feature_id = lastFeatureId + '-copy';
        }
    })

    return namedFlowlines;
}

export const assignParentFeatureNames = (flowlines, nameOverrides, inlandFeatures) => {
    flowlines.forEach((feature) => {
        const { nameid, levelpathi } = feature.properties;

        if (nameid === "unknown") {
            feature.properties.feature_name = `Unidentified River ${feature.properties.levelpathi}`;
            feature.properties.feature_id = levelpathi;
        }
        else {
            feature.properties.feature_name = nameid
            feature.properties.feature_id = nameid;
        }

        const overrideEntry = nameOverrides[levelpathi];
        if (overrideEntry) {
            feature.properties.feature_name = overrideEntry.feature_name;
            feature.properties.feature_id = overrideEntry.feature_name; 
        }
    });

    const mappedFlowlines = Object.fromEntries(flowlines.map(d => [d.properties.comid, d]));

    const inlandFeaturePolygons = inlandFeatures.map(d => polygon(d.geometry.coordinates, d.properties));
    const flowlineStartingPoints = {
        "type": "FeatureCollection",
        "features": flowlines.map(flowline => point(flowline.geometry.coordinates[0], flowline.properties))
    };

    inlandFeaturePolygons.forEach(inlandPolygon => {
        const pointsWithin = pointsWithinPolygon(flowlineStartingPoints, inlandPolygon);
        
        pointsWithin.features.forEach(intersectingPoint => {
            const correspondingFlowline = mappedFlowlines[intersectingPoint.properties.comid];

            correspondingFlowline.properties.feature_name = inlandPolygon.properties.stop_feature_name;
            correspondingFlowline.properties.feature_id = inlandPolygon.properties.stop_feature_name;
            correspondingFlowline.properties.renamed_inland = true;
        });
    });

    const namedFlowlines = Object.values(mappedFlowlines).sort((a, b) => b.properties.hydroseq - a.properties.hydroseq);
    
    // If some, but less than four of the final flowlines have been renamed with the stopping feature,
    // this is probably a stub at the end (e.g. Gulf of Mexico (0km) on some Louisiana paths) and
    // we should rename it with the last non-stopping feature
    const copyFlowline = namedFlowlines.slice(-4)[0];
    const finalFlowline = namedFlowlines[namedFlowlines.length - 1];
    if (
        finalFlowline.properties.renamed_inland === true
        && finalFlowline.properties.feature_name !== copyFlowline.properties.feature_name
    ) {
        namedFlowlines.slice(-3).forEach((d, i) => {
            if (d.properties.renamed_inland && d.properties.feature_name === finalFlowline.properties.feature_name) {
                d.properties.renamed_inland = copyFlowline.properties.renamed_inland;
                d.properties.feature_id = copyFlowline.properties.feature_id;
                d.properties.feature_name = copyFlowline.properties.feature_name;
            }
        })
    };

    // This corrects for instances of river1 -> lake -> river1, by assigning a new, unique "copy" id
    // to the next instance of a river so that it will be represented in the unique features array later on
    const correctedNamedFlowlines = correctInterruptingLakes(namedFlowlines);

    return correctedNamedFlowlines;
}