import mapbox from 'mapbox-gl';
import { secondaryToken } from './access_tokens';

mapbox.accessToken = secondaryToken;

export { mapbox };