import { register } from '../../../server/auth.js';

export const onRequestPost = ({ request, env }) => register(request, env);
