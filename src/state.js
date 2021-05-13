import { writable } from 'svelte/store';

const coordinates = writable([[], []]);

const riverPath = writable(null);
const currentLocation = writable(null);

const featureGroups = writable([]);
const activeFeatureIndex = writable(-1);
const stoppingFeature = writable(null);
const startLocation = writable(null);

const vizState = writable("uninitialized");

export { coordinates, riverPath, currentLocation, vizState, featureGroups, activeFeatureIndex, stoppingFeature, startLocation };
