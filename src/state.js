import { writable } from 'svelte/store';

const coordinates = writable([[], []]);

const featureGroups = writable([]);
const activeFeatureIndex = writable(-1);

const stoppingFeature = writable(null);
const startLocation = writable(null);

export { coordinates, featureGroups, activeFeatureIndex, stoppingFeature, startLocation };
