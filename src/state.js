import { writable } from 'svelte/store';

const coordinates = writable([[], []]);

const stoppingFeature = writable(null);
const startLocation = writable(null);

export { coordinates, stoppingFeature, startLocation };
