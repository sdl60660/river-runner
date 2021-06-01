import mapbox from 'mapbox-gl';
import mapboxAccessToken from './access_token';

mapbox.accessToken = mapboxAccessToken;

export { mapbox };