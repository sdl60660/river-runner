import { writable } from 'svelte/store';

const coordinates = writable([[], []]);
const riverPath = writable(null);
const currentLocation = writable(null);

const vizState = writable("uninitialized");

export { coordinates, riverPath, currentLocation, vizState };
