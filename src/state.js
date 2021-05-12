import { writable } from 'svelte/store';

const coordinates = writable([[], []]);
const riverPath = writable(null);
const currentLocation = writable(null);
const featureGroups = writable([]);
const activeFeatureIndex = writable(null);

const vizState = writable("uninitialized");

export { coordinates, riverPath, currentLocation, vizState, featureGroups, activeFeatureIndex };
