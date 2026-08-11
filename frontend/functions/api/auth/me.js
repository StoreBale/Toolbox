import { me } from '../../../server/auth.js';

export const onRequestGet = ({ request, env }) => me(request, env);
